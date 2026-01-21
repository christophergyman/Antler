/**
 * GitHub CLI Service
 * Fetches issues and PRs via the `gh` CLI
 */

import { spawn } from "child_process";
import type { GitHubResult } from "../types/result";
import { ok, err, createGitHubError } from "../types/result";
import type { GitHubInfo, GitHubComment, GitHubPR } from "../types/github";
import { createGitHubInfo, createGitHubComment, createGitHubPR } from "../types/github";
import { createCIStatus } from "../types/ci";

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of issues to fetch per request */
const MAX_ISSUES = 100;

/** Default timeout for gh commands (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

/** Number of concurrent PR fetches */
const PR_CONCURRENCY = 5;

// ============================================================================
// Raw Types (from gh CLI JSON output)
// ============================================================================

interface RawLabel {
  name: string;
}

interface RawUser {
  login: string;
}

interface RawComment {
  id: number;
  author: RawUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface RawIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: RawLabel[];
  assignees: RawUser[];
  milestone: { title: string } | null;
  createdAt: string;
  updatedAt: string;
  comments: RawComment[];
  author: RawUser;
}

interface RawStatusCheck {
  state: string;
  conclusion: string | null;
}

interface RawPR {
  number: number;
  url: string;
  state: string;
  headRefName: string;
  baseRefName: string;
  reviewRequests: { login: string }[];
  statusCheckRollup: RawStatusCheck[];
  mergeable: string;
  isDraft: boolean;
}

// ============================================================================
// Command Execution
// ============================================================================

function execGh(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<GitHubResult<string>> {
  return new Promise((resolve) => {
    let resolved = false;
    const proc = spawn("gh", args);

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill();
        resolve(
          err(
            createGitHubError(
              "command_failed",
              "Command timed out",
              `gh ${args.slice(0, 3).join(" ")}... exceeded ${timeoutMs}ms`
            )
          )
        );
      }
    }, timeoutMs);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve(
          err(
            createGitHubError(
              "gh_not_installed",
              "GitHub CLI not installed",
              "Install from https://cli.github.com"
            )
          )
        );
      } else {
        resolve(
          err(
            createGitHubError("command_failed", "Failed to execute gh command", error.message)
          )
        );
      }
    });

    proc.on("close", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve(ok(stdout));
      } else if (stderr.includes("not logged in") || stderr.includes("auth login")) {
        resolve(
          err(
            createGitHubError(
              "not_authenticated",
              "Not logged in to GitHub",
              "Run `gh auth login` to authenticate"
            )
          )
        );
      } else if (stderr.includes("Could not resolve") || stderr.includes("not found")) {
        resolve(
          err(
            createGitHubError(
              "repo_not_found",
              "Repository not found or inaccessible",
              stderr.trim()
            )
          )
        );
      } else if (stderr.includes("connect") || stderr.includes("network")) {
        resolve(
          err(createGitHubError("network_error", "Network error", stderr.trim()))
        );
      } else {
        resolve(
          err(
            createGitHubError(
              "command_failed",
              `gh command failed with exit code ${code}`,
              stderr.trim()
            )
          )
        );
      }
    });
  });
}

// ============================================================================
// Issue Fetching
// ============================================================================

const ISSUE_FIELDS = [
  "number",
  "title",
  "body",
  "state",
  "labels",
  "assignees",
  "milestone",
  "createdAt",
  "updatedAt",
  "comments",
  "author",
].join(",");

function mapComment(raw: RawComment): GitHubComment {
  return createGitHubComment({
    id: raw.id,
    author: raw.author.login,
    body: raw.body,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  });
}

function mapIssueToGitHubInfo(raw: RawIssue, repoOwner: string, repoName: string): GitHubInfo {
  return createGitHubInfo({
    repoOwner,
    repoName,
    issueNumber: raw.number,
    title: raw.title,
    body: raw.body,
    state: raw.state === "OPEN" ? "open" : "closed",
    labels: raw.labels.map((l) => l.name),
    assignees: raw.assignees.map((a) => a.login),
    milestone: raw.milestone?.title ?? null,
    comments: raw.comments.map(mapComment),
    issueCreatedAt: raw.createdAt,
    issueUpdatedAt: raw.updatedAt,
  });
}

export async function fetchIssues(
  repo: string
): Promise<GitHubResult<GitHubInfo[]>> {
  const args = [
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    String(MAX_ISSUES),
    "--json",
    ISSUE_FIELDS,
  ];

  const result = await execGh(args);
  if (!result.ok) return result;

  let issues: RawIssue[];
  try {
    issues = JSON.parse(result.value);
  } catch (error) {
    return err(
      createGitHubError(
        "parse_error",
        "Failed to parse issues JSON",
        error instanceof Error ? error.message : String(error)
      )
    );
  }

  const [owner, name] = repo.split("/");
  const githubInfos = issues.map((issue) => mapIssueToGitHubInfo(issue, owner, name));

  return ok(githubInfos);
}

// ============================================================================
// PR Fetching
// ============================================================================

const PR_FIELDS = [
  "number",
  "url",
  "state",
  "headRefName",
  "baseRefName",
  "reviewRequests",
  "statusCheckRollup",
  "mergeable",
  "isDraft",
].join(",");

function mapStatusChecks(checks: RawStatusCheck[] | null) {
  if (!checks || checks.length === 0) {
    return createCIStatus({ state: "unknown" });
  }

  let passed = 0;
  let failed = 0;
  let pending = 0;

  for (const check of checks) {
    const conclusion = check.conclusion?.toUpperCase();
    if (conclusion === "SUCCESS") {
      passed++;
    } else if (conclusion === "FAILURE" || conclusion === "ERROR") {
      failed++;
    } else {
      pending++;
    }
  }

  let state: "passing" | "failing" | "pending" | "unknown";
  if (failed > 0) {
    state = "failing";
  } else if (pending > 0) {
    state = "pending";
  } else if (passed > 0) {
    state = "passing";
  } else {
    state = "unknown";
  }

  return createCIStatus({
    state,
    total: checks.length,
    passed,
    failed,
    pending,
  });
}

function mapPR(raw: RawPR): GitHubPR {
  const stateMap: Record<string, GitHubPR["state"]> = {
    OPEN: raw.isDraft ? "draft" : "open",
    CLOSED: "closed",
    MERGED: "merged",
  };

  return createGitHubPR({
    number: raw.number,
    url: raw.url,
    state: stateMap[raw.state] ?? "open",
    branchName: raw.headRefName,
    baseBranch: raw.baseRefName,
    reviewers: raw.reviewRequests?.map((r) => r.login) ?? [],
    ci: mapStatusChecks(raw.statusCheckRollup),
    mergeable: raw.mergeable === "MERGEABLE" ? true : raw.mergeable === "CONFLICTING" ? false : null,
    mergeConflicts: raw.mergeable === "CONFLICTING",
  });
}

export async function fetchLinkedPR(
  repo: string,
  issueNumber: number
): Promise<GitHubResult<GitHubPR | null>> {
  const args = [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--search",
    `linked:issue:${issueNumber}`,
    "--limit",
    "1",
    "--json",
    PR_FIELDS,
  ];

  const result = await execGh(args);
  if (!result.ok) return result;

  let prs: RawPR[];
  try {
    prs = JSON.parse(result.value);
  } catch (error) {
    return err(
      createGitHubError(
        "parse_error",
        "Failed to parse PR JSON",
        error instanceof Error ? error.message : String(error)
      )
    );
  }

  if (prs.length === 0) {
    return ok(null);
  }

  return ok(mapPR(prs[0]));
}

// ============================================================================
// Combined Fetch (Issues + PRs) - Parallel with concurrency limit
// ============================================================================

async function fetchPRForIssue(
  repo: string,
  issue: GitHubInfo
): Promise<GitHubInfo> {
  if (issue.issueNumber === null) {
    return issue;
  }

  const prResult = await fetchLinkedPR(repo, issue.issueNumber);

  // Silently skip on error - PR fetch is optional enhancement
  if (!prResult.ok || !prResult.value) {
    return issue;
  }

  return createGitHubInfo({ ...issue, pr: prResult.value });
}

export async function fetchIssuesWithPRs(
  repo: string
): Promise<GitHubResult<GitHubInfo[]>> {
  const issuesResult = await fetchIssues(repo);
  if (!issuesResult.ok) return issuesResult;

  const issues = issuesResult.value;
  const results: GitHubInfo[] = [];

  // Process in batches for controlled concurrency
  for (let i = 0; i < issues.length; i += PR_CONCURRENCY) {
    const batch = issues.slice(i, i + PR_CONCURRENCY);
    const batchPromises = batch.map((issue) => fetchPRForIssue(repo, issue));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return ok(results);
}
