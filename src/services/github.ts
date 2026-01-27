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

// ============================================================================
// Issue Update Operations
// ============================================================================

export interface UpdateIssueParams {
  title?: string;
  body?: string;
  addLabels?: string[];
  removeLabels?: string[];
  addAssignees?: string[];
  removeAssignees?: string[];
  milestone?: string | null;
}

/**
 * Update an issue's fields
 * Uses gh issue edit command
 */
export async function updateIssue(
  repo: string,
  issueNumber: number,
  params: UpdateIssueParams
): Promise<GitHubResult<void>> {
  const args = ["issue", "edit", String(issueNumber), "--repo", repo];

  if (params.title !== undefined) {
    args.push("--title", params.title);
  }
  if (params.body !== undefined) {
    args.push("--body", params.body);
  }
  if (params.addLabels && params.addLabels.length > 0) {
    args.push("--add-label", params.addLabels.join(","));
  }
  if (params.removeLabels && params.removeLabels.length > 0) {
    args.push("--remove-label", params.removeLabels.join(","));
  }
  if (params.addAssignees && params.addAssignees.length > 0) {
    args.push("--add-assignee", params.addAssignees.join(","));
  }
  if (params.removeAssignees && params.removeAssignees.length > 0) {
    args.push("--remove-assignee", params.removeAssignees.join(","));
  }
  if (params.milestone !== undefined) {
    if (params.milestone === null) {
      args.push("--milestone", "");
    } else {
      args.push("--milestone", params.milestone);
    }
  }

  logDataSync("info", "Updating issue", { issueNumber, changes: Object.keys(params) });

  const result = await execGh(args);
  if (!result.ok) return result;

  return ok(undefined);
}

/**
 * Add a comment to an issue
 */
export async function addIssueComment(
  repo: string,
  issueNumber: number,
  body: string
): Promise<GitHubResult<void>> {
  const args = [
    "issue",
    "comment",
    String(issueNumber),
    "--repo",
    repo,
    "--body",
    body,
  ];

  logDataSync("info", "Adding comment to issue", { issueNumber });

  const result = await execGh(args);
  if (!result.ok) return result;

  return ok(undefined);
}

// ============================================================================
// Repository Metadata Fetching
// ============================================================================

/**
 * Fetch available labels for a repository
 */
export async function fetchRepoLabels(repo: string): Promise<GitHubResult<string[]>> {
  const args = [
    "label",
    "list",
    "--repo",
    repo,
    "--json",
    "name",
    "--limit",
    "100",
  ];

  const result = await execGh(args);
  if (!result.ok) return result;

  try {
    const labels: { name: string }[] = JSON.parse(result.value);
    return ok(labels.map((l) => l.name));
  } catch (error) {
    return err(
      createGitHubError(
        "parse_error",
        "Failed to parse labels JSON",
        error instanceof Error ? error.message : String(error)
      )
    );
  }
}

/**
 * Fetch repository collaborators (users who can be assigned to issues)
 */
export async function fetchRepoCollaborators(repo: string): Promise<GitHubResult<string[]>> {
  const args = [
    "api",
    `repos/${repo}/collaborators`,
    "--jq",
    ".[].login",
  ];

  const result = await execGh(args);
  if (!result.ok) return result;

  // The output is newline-separated usernames
  const collaborators = result.value
    .trim()
    .split("\n")
    .filter((c) => c.length > 0);

  return ok(collaborators);
}

/**
 * Fetch open milestones for a repository
 */
export async function fetchRepoMilestones(repo: string): Promise<GitHubResult<string[]>> {
  const args = [
    "api",
    `repos/${repo}/milestones`,
    "--jq",
    ".[].title",
  ];

  const result = await execGh(args);
  if (!result.ok) return result;

  // The output is newline-separated milestone titles
  const milestones = result.value
    .trim()
    .split("\n")
    .filter((m) => m.length > 0);

  return ok(milestones);
}

/**
 * Create a new milestone
 */
export async function createMilestone(
  repo: string,
  title: string
): Promise<GitHubResult<void>> {
  const args = [
    "api",
    `repos/${repo}/milestones`,
    "--method",
    "POST",
    "-f",
    `title=${title}`,
  ];

  logDataSync("info", "Creating milestone", { repo, title });

  const result = await execGh(args);
  if (!result.ok) return result;

  return ok(undefined);
}

// ============================================================================
// Issue Creation
// ============================================================================

export interface CreateIssueParams {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: string;
}

/**
 * Create a new GitHub issue
 * Uses gh issue create command
 */
export async function createIssue(
  repo: string,
  params: CreateIssueParams
): Promise<GitHubResult<GitHubInfo>> {
  const args = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    params.title,
  ];

  if (params.body) {
    args.push("--body", params.body);
  }
  if (params.labels && params.labels.length > 0) {
    args.push("--label", params.labels.join(","));
  }
  if (params.assignees && params.assignees.length > 0) {
    args.push("--assignee", params.assignees.join(","));
  }
  if (params.milestone) {
    args.push("--milestone", params.milestone);
  }

  logDataSync("info", "Creating issue", { repo, title: params.title });

  const result = await execGh(args);
  if (!result.ok) return result;

  // gh issue create returns the URL of the new issue
  // Extract issue number from URL (e.g., https://github.com/owner/repo/issues/123)
  const url = result.value.trim();
  const issueNumberMatch = url.match(/\/issues\/(\d+)$/);

  if (!issueNumberMatch || !issueNumberMatch[1]) {
    return err(
      createGitHubError(
        "parse_error",
        "Failed to extract issue number from response",
        url
      )
    );
  }

  const issueNumber = parseInt(issueNumberMatch[1], 10);
  const parts = repo.split("/");
  const owner = parts[0] ?? "";
  const name = parts[1] ?? "";

  // Return the new issue info
  const githubInfo = createGitHubInfo({
    repoOwner: owner,
    repoName: name,
    issueNumber,
    title: params.title,
    body: params.body ?? "",
    state: "open",
    labels: params.labels ?? [],
    assignees: params.assignees ?? [],
    milestone: params.milestone ?? null,
    issueCreatedAt: new Date().toISOString(),
    issueUpdatedAt: new Date().toISOString(),
  });

  logDataSync("info", "Issue created", { repo, issueNumber });

  return ok(githubInfo);
}

// ============================================================================
// Issue Templates
// ============================================================================

export interface IssueTemplate {
  name: string;
  about?: string;
  body: string;
  labels?: string[];
}

interface RawTemplateFile {
  name: string;
  path: string;
  download_url: string;
}

/**
 * Parse YAML frontmatter from a markdown template file (.md)
 * Returns the parsed name, about, labels, and body content
 */
function parseMarkdownTemplate(content: string): {
  name?: string;
  about?: string;
  labels?: string[];
  body: string;
} {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    // No frontmatter, entire content is the body
    return { body: content };
  }

  const frontmatter = frontmatterMatch[1] ?? "";
  const body = frontmatterMatch[2] ?? "";

  // Simple YAML parsing for name, about, and labels
  let name: string | undefined;
  let about: string | undefined;
  let labels: string[] | undefined;

  // Parse name
  const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  if (nameMatch?.[1]) {
    name = nameMatch[1];
  }

  // Parse about
  const aboutMatch = frontmatter.match(/^about:\s*["']?(.+?)["']?\s*$/m);
  if (aboutMatch?.[1]) {
    about = aboutMatch[1];
  }

  // Parse labels (can be array or comma-separated)
  const labelsMatch = frontmatter.match(/^labels:\s*\[?(.+?)\]?\s*$/m);
  if (labelsMatch?.[1]) {
    labels = labelsMatch[1]
      .split(",")
      .map((l) => l.trim().replace(/^["']|["']$/g, ""))
      .filter((l) => l.length > 0);
  }

  return { name, about, labels, body: body.trim() };
}

/**
 * YAML form element types for issue templates
 */
interface YamlFormElement {
  type: "markdown" | "input" | "textarea" | "dropdown" | "checkboxes";
  id?: string;
  attributes?: {
    label?: string;
    description?: string;
    placeholder?: string;
    value?: string;
    options?: string[];
  };
}

/**
 * Parse a YAML issue form template (.yml/.yaml)
 * Converts the body array of form elements into markdown
 */
function parseYamlTemplate(content: string): {
  name?: string;
  about?: string;
  labels?: string[];
  body: string;
} {
  // Parse top-level YAML fields using simple regex
  let name: string | undefined;
  let about: string | undefined;
  let labels: string[] | undefined;

  // Parse name
  const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  if (nameMatch?.[1]) {
    name = nameMatch[1];
  }

  // Parse description (maps to about)
  const descMatch = content.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  if (descMatch?.[1]) {
    about = descMatch[1];
  }

  // Parse labels (can be array on single line or multiline)
  const labelsInlineMatch = content.match(/^labels:\s*\[(.+?)\]\s*$/m);
  if (labelsInlineMatch?.[1]) {
    labels = labelsInlineMatch[1]
      .split(",")
      .map((l) => l.trim().replace(/^["']|["']$/g, ""))
      .filter((l) => l.length > 0);
  } else {
    // Try multiline array format
    const labelsBlockMatch = content.match(/^labels:\s*\n((?:\s*-\s*.+\n?)+)/m);
    if (labelsBlockMatch?.[1]) {
      labels = labelsBlockMatch[1]
        .split("\n")
        .map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, ""))
        .filter((l) => l.length > 0);
    }
  }

  // Extract and convert body elements to markdown
  const bodyContent = convertYamlBodyToMarkdown(content);

  return { name, about, labels, body: bodyContent };
}

/**
 * Convert YAML body array to markdown format
 * Handles: markdown, input, textarea, dropdown, checkboxes
 */
function convertYamlBodyToMarkdown(yamlContent: string): string {
  const markdownParts: string[] = [];

  // Find the body section
  const bodyMatch = yamlContent.match(/^body:\s*\n([\s\S]*?)(?=^[a-z]+:|$)/m);
  if (!bodyMatch?.[1]) {
    return "";
  }

  const bodySection = bodyMatch[1];

  // Split body into individual elements (each starting with "  - type:")
  const elementBlocks = bodySection.split(/(?=^\s*-\s*type:)/m).filter((b) => b.trim());

  for (const block of elementBlocks) {
    // Parse element type
    const typeMatch = block.match(/^\s*-?\s*type:\s*["']?(\w+)["']?/);
    if (!typeMatch?.[1]) continue;

    const type = typeMatch[1];

    // Parse attributes
    const labelMatch = block.match(/label:\s*["']?(.+?)["']?\s*$/m);
    const descMatch = block.match(/description:\s*["']?(.+?)["']?\s*$/m);
    const placeholderMatch = block.match(/placeholder:\s*["']?([\s\S]*?)["']?\s*(?=\n\s*\w+:|$)/m);
    const valueMatch = block.match(/value:\s*["']?([\s\S]*?)["']?\s*(?=\n\s*\w+:|$)/m);

    const label = labelMatch?.[1]?.trim();
    const description = descMatch?.[1]?.trim();
    const placeholder = placeholderMatch?.[1]?.trim();
    const value = valueMatch?.[1]?.trim();

    switch (type) {
      case "markdown":
        // Use the value as-is (it's already markdown)
        if (value) {
          markdownParts.push(value);
        }
        break;

      case "input":
        // Create a labeled section for short input
        if (label) {
          let section = `### ${label}`;
          if (description) {
            section += `\n\n${description}`;
          }
          if (placeholder) {
            section += `\n\n<!-- ${placeholder} -->`;
          }
          markdownParts.push(section);
        }
        break;

      case "textarea":
        // Create a labeled section for longer input
        if (label) {
          let section = `### ${label}`;
          if (description) {
            section += `\n\n${description}`;
          }
          if (placeholder) {
            section += `\n\n<!-- ${placeholder} -->`;
          } else if (value) {
            // Some templates use value as default content
            section += `\n\n${value}`;
          }
          markdownParts.push(section);
        }
        break;

      case "dropdown":
        // Create a section with options list
        if (label) {
          let section = `### ${label}`;
          if (description) {
            section += `\n\n${description}`;
          }
          // Parse options from the block
          const optionsMatch = block.match(/options:\s*\n((?:\s*-\s*.+\n?)+)/);
          if (optionsMatch?.[1]) {
            const options = optionsMatch[1]
              .split("\n")
              .map((l) => l.replace(/^\s*-\s*/, "").trim().replace(/^["']|["']$/g, ""))
              .filter((l) => l.length > 0);
            section += "\n\n**Options:**";
            for (const opt of options) {
              section += `\n- [ ] ${opt}`;
            }
          }
          markdownParts.push(section);
        }
        break;

      case "checkboxes":
        // Create a section with checkbox list
        if (label) {
          let section = `### ${label}`;
          if (description) {
            section += `\n\n${description}`;
          }
          // Parse options from the block
          const optionsMatch = block.match(/options:\s*\n((?:\s*-\s*(?:label:|required:)[\s\S]*?(?=\n\s*-\s*(?:label:|type:)|$))+)/);
          if (optionsMatch?.[1]) {
            const optionLabels = optionsMatch[1]
              .split(/(?=\s*-\s*label:)/)
              .map((opt) => {
                const optLabelMatch = opt.match(/label:\s*["']?(.+?)["']?\s*$/m);
                return optLabelMatch?.[1]?.trim();
              })
              .filter((l): l is string => !!l);
            for (const opt of optionLabels) {
              section += `\n- [ ] ${opt}`;
            }
          }
          markdownParts.push(section);
        }
        break;
    }
  }

  return markdownParts.join("\n\n");
}

/**
 * Fetch available issue templates from the repository
 * Returns empty array if no templates exist (graceful degradation)
 */
export async function fetchIssueTemplates(
  repo: string
): Promise<GitHubResult<IssueTemplate[]>> {
  logDataSync("debug", "Fetching issue templates", { repo });

  // First, list template files in .github/ISSUE_TEMPLATE/
  const listArgs = [
    "api",
    `repos/${repo}/contents/.github/ISSUE_TEMPLATE`,
    "--jq",
    ".[].name",
  ];

  const listResult = await execGh(listArgs, DEFAULT_TIMEOUT_MS, 0);

  if (!listResult.ok) {
    // No templates directory - this is normal, return empty array
    if (listResult.error.code === "command_failed") {
      logDataSync("debug", "No issue templates found", { repo });
      return ok([]);
    }
    return listResult;
  }

  // Parse file names (newline-separated)
  const fileNames = listResult.value
    .trim()
    .split("\n")
    .filter((f) => f.endsWith(".md") || f.endsWith(".yml") || f.endsWith(".yaml"));

  if (fileNames.length === 0) {
    return ok([]);
  }

  // Fetch each template's content
  const templates: IssueTemplate[] = [];

  for (const fileName of fileNames) {
    // Skip config.yml which configures the template chooser
    if (fileName === "config.yml" || fileName === "config.yaml") {
      continue;
    }

    const contentArgs = [
      "api",
      `repos/${repo}/contents/.github/ISSUE_TEMPLATE/${fileName}`,
      "--jq",
      ".content",
    ];

    const contentResult = await execGh(contentArgs, DEFAULT_TIMEOUT_MS, 0);

    if (!contentResult.ok) {
      logDataSync("warn", "Failed to fetch template", { repo, fileName });
      continue;
    }

    // Content is base64 encoded
    try {
      const base64Content = contentResult.value.trim();
      const content = atob(base64Content);

      // Use appropriate parser based on file extension
      const isYamlTemplate = fileName.endsWith(".yml") || fileName.endsWith(".yaml");
      const parsed = isYamlTemplate
        ? parseYamlTemplate(content)
        : parseMarkdownTemplate(content);

      templates.push({
        name: parsed.name ?? fileName.replace(/\.(md|yml|yaml)$/, ""),
        about: parsed.about,
        body: parsed.body,
        labels: parsed.labels,
      });
    } catch (error) {
      logDataSync("warn", "Failed to parse template", {
        repo,
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logDataSync("info", "Issue templates loaded", { repo, count: templates.length });

  return ok(templates);
}
