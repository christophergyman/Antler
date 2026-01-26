/**
 * GitHub CLI Service
 * Fetches issues and PRs via the `gh` CLI using Tauri shell plugin
 */

import type { GitHubResult } from "@core/types/result";
import { ok, err, createGitHubError } from "@core/types/result";
import type { GitHubInfo, GitHubComment, GitHubPR } from "@core/types/github";
import { createGitHubInfo, createGitHubComment, createGitHubPR } from "@core/types/github";
import { createCIStatus } from "@core/types/ci";
import { logDataSync } from "./logging";
import { executeGh } from "./commandExecutor";

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of issues to fetch per request */
const MAX_ISSUES = 100;

/** Default timeout for gh commands (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

/** Number of concurrent PR fetches */
const PR_CONCURRENCY = 5;

/** Number of retries for network operations */
const DEFAULT_RETRIES = 2;

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

/**
 * Map CommandError to GitHubError with GitHub-specific error codes
 * Handles authentication errors from gh CLI stderr when command execution fails
 */
function mapCommandErrorToGitHubError(
  errorType: string,
  message: string,
  details?: string
): ReturnType<typeof createGitHubError> {
  // Check for GitHub-specific authentication errors in the details
  if (details) {
    if (details.includes("not logged in") || details.includes("auth login")) {
      return createGitHubError(
        "not_authenticated",
        "Not logged in to GitHub",
        "Run `gh auth login` to authenticate"
      );
    }

    // Handle repository not found (GitHub-specific, not network error)
    if (details.includes("Could not resolve") && details.includes("repository")) {
      return createGitHubError(
        "repo_not_found",
        "Repository not found or inaccessible",
        details
      );
    }
  }

  // Map standard error types
  switch (errorType) {
    case "cancelled":
      return createGitHubError("command_failed", "Operation cancelled");
    case "not_installed":
      return createGitHubError(
        "gh_not_installed",
        "GitHub CLI not installed",
        "Install from https://cli.github.com"
      );
    case "network_error":
      return createGitHubError("network_error", message, details);
    case "timeout":
      return createGitHubError("command_failed", "Command timed out", details);
    default:
      return createGitHubError("command_failed", message, details);
  }
}

/**
 * Execute a gh command with retry support
 */
async function execGh(
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES
): Promise<GitHubResult<string>> {
  const commandPreview = `gh ${args.slice(0, 4).join(" ")}${args.length > 4 ? "..." : ""}`;
  logDataSync("debug", `Executing: ${commandPreview}`);

  const result = await executeGh(args, { timeoutMs, retries });

  if (result.ok) {
    // executeGh only returns ok when exitCode === 0
    return ok(result.value.stdout);
  }

  // Map CommandError to GitHubError with GitHub-specific handling
  const error = result.error;
  logDataSync("error", `Command failed: ${commandPreview}`, {
    type: error.type,
    message: error.message,
  });
  return err(mapCommandErrorToGitHubError(error.type, error.message, error.details));
}

// ============================================================================
// Authentication
// ============================================================================

/**
 * Check if user is authenticated with GitHub CLI
 * Returns username if authenticated, null if not
 */
export async function checkGitHubAuth(): Promise<GitHubResult<{ username: string } | null>> {
  const result = await execGh(["auth", "status", "--hostname", "github.com"]);

  if (!result.ok) {
    // Not authenticated is expected, not an error for this function
    if (result.error.code === "not_authenticated") {
      return ok(null);
    }
    return result;
  }

  // Parse username from output - format includes "Logged in to github.com account <username>"
  const match = result.value.match(/account\s+(\S+)/);
  if (match && match[1]) {
    return ok({ username: match[1] });
  }

  // Fallback: try to get username from gh api
  const userResult = await execGh(["api", "user", "--jq", ".login"]);
  if (userResult.ok) {
    const username = userResult.value.trim();
    if (username) {
      return ok({ username });
    }
  }

  // Authenticated but couldn't get username
  return ok({ username: "authenticated" });
}

/**
 * Initiate GitHub CLI authentication
 * Opens browser for OAuth flow using --web flag (non-interactive)
 */
export async function initiateGitHubAuth(): Promise<GitHubResult<void>> {
  logDataSync("info", "Initiating GitHub auth via browser");

  const result = await execGh(["auth", "login", "--web", "--hostname", "github.com"], 120000);

  if (!result.ok) {
    return result;
  }

  logDataSync("info", "GitHub auth completed");
  return ok(undefined);
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

  const parts = repo.split("/");
  const owner = parts[0] ?? "";
  const name = parts[1] ?? "";
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

  const firstPR = prs[0];
  if (!firstPR) {
    return ok(null);
  }

  return ok(mapPR(firstPR));
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
  // Use Promise.allSettled to handle partial failures gracefully
  for (let i = 0; i < issues.length; i += PR_CONCURRENCY) {
    const batch = issues.slice(i, i + PR_CONCURRENCY);
    const batchPromises = batch.map((issue) => fetchPRForIssue(repo, issue));
    const batchResults = await Promise.allSettled(batchPromises);

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result && result.status === "fulfilled") {
        results.push(result.value);
      } else if (result && result.status === "rejected") {
        // On rejection, use the original issue without PR data
        const originalIssue = batch[j];
        if (originalIssue) {
          logDataSync("warn", "Failed to fetch PR for issue, using issue without PR", {
            issueNumber: originalIssue.issueNumber,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
          results.push(originalIssue);
        }
      }
    }
  }

  return ok(results);
}
