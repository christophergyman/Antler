/**
 * Git Worktree Service
 * Creates and manages git worktrees for parallel work sessions
 */

import { exists, remove } from "@tauri-apps/plugin-fs";
import type { WorktreeResult } from "@core/types/result";
import { ok, err, createWorktreeError } from "@core/types/result";
import { logWorktree } from "./logging";
import { executeGit, type CommandResult } from "./commandExecutor";

// ============================================================================
// Constants
// ============================================================================

/** Directory where worktrees are stored (relative to repo root) */
const WORKTREES_DIR = ".worktrees";

/** Default timeout for git commands (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

// ============================================================================
// Branch Name Generation
// ============================================================================

/**
 * Generate a branch name from issue number and title
 * Format: {issueNumber}-{title-slug}
 * Example: 42-fix-login-bug
 *
 * Falls back to "issue" if title produces empty slug
 */
export function generateBranchName(issueNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "")     // Trim leading/trailing hyphens
    .slice(0, 50);               // Limit length

  // Use "issue" as fallback if slug is empty (e.g., title was all special chars)
  const finalSlug = slug || "issue";

  return `${issueNumber}-${finalSlug}`;
}

/**
 * Parse issue number from a branch name
 * Expects format: {issueNumber}-{anything}
 * Example: "42-fix-login-bug" -> 42
 *
 * Returns null if branch name doesn't match the expected pattern
 */
export function parseIssueNumberFromBranch(branchName: string): number | null {
  // Match pattern: digits followed by a hyphen at the start
  const match = branchName.match(/^(\d+)-/);
  if (!match) return null;

  const issueNumber = parseInt(match[1], 10);
  return isNaN(issueNumber) ? null : issueNumber;
}

/**
 * Get the worktree path for a given branch name
 */
export function getWorktreePath(repoRoot: string, branchName: string): string {
  return `${repoRoot}/${WORKTREES_DIR}/${branchName}`;
}

// ============================================================================
// Git Command Execution
// ============================================================================

/**
 * Map CommandResult to WorktreeResult, handling git-specific error codes
 */
function mapCommandResultToWorktreeResult(
  result: CommandResult,
  commandPreview: string
): WorktreeResult<string> {
  // Success
  if (result.exitCode === 0) {
    logWorktree("debug", "Git command succeeded", { command: commandPreview });
    return ok(result.stdout);
  }

  const stderr = result.stderr;

  // Handle timeout
  if (result.timedOut) {
    logWorktree("error", "Git command timed out", { command: commandPreview });
    return err(
      createWorktreeError(
        "worktree_create_failed",
        "Git command timed out",
        `${commandPreview} exceeded timeout`
      )
    );
  }

  // Handle branch already checked out
  if (stderr.includes("already checked out") || stderr.includes("is already used")) {
    logWorktree("error", "Branch already checked out", { command: commandPreview });
    return err(
      createWorktreeError(
        "branch_checked_out",
        "Branch is already checked out in another worktree",
        stderr.trim()
      )
    );
  }

  // Handle worktree already exists
  if (stderr.includes("already exists")) {
    logWorktree("error", "Worktree already exists", { command: commandPreview });
    return err(
      createWorktreeError(
        "worktree_exists",
        "Worktree already exists at this location",
        stderr.trim()
      )
    );
  }

  // Handle git not installed
  if (stderr.includes("ENOENT") || stderr.includes("not found")) {
    logWorktree("error", "Git not installed");
    return err(
      createWorktreeError(
        "git_not_installed",
        "Git is not installed",
        "Install git from https://git-scm.com"
      )
    );
  }

  // Generic command failure
  logWorktree("error", `Git command failed with exit code ${result.exitCode}`, {
    command: commandPreview,
    exitCode: result.exitCode,
    stderr: stderr.trim(),
  });
  return err(
    createWorktreeError(
      "worktree_create_failed",
      `Git command failed with exit code ${result.exitCode}`,
      stderr.trim()
    )
  );
}

/**
 * Execute a git command using the unified CommandExecutor
 */
async function execGit(
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  suppressErrorLog = false
): Promise<WorktreeResult<string>> {
  const commandPreview = `git ${args.slice(0, 4).join(" ")}${args.length > 4 ? "..." : ""}`;
  logWorktree("debug", `Executing: ${commandPreview}`);

  const result = await executeGit(args, { timeoutMs, suppressErrorLog });

  if (result.ok) {
    return mapCommandResultToWorktreeResult(result.value, commandPreview);
  }

  // Map CommandError to WorktreeError
  const error = result.error;
  switch (error.type) {
    case "cancelled":
      return err(createWorktreeError("worktree_create_failed", "Operation cancelled"));
    case "not_installed":
      return err(
        createWorktreeError(
          "git_not_installed",
          "Git is not installed",
          "Install git from https://git-scm.com"
        )
      );
    default:
      return err(createWorktreeError("worktree_create_failed", error.message, error.details));
  }
}

// ============================================================================
// Branch Operations
// ============================================================================

/**
 * Check if a branch exists (locally or remotely)
 */
async function branchExists(branchName: string): Promise<boolean> {
  // suppressErrorLog: true because exit code 128 is expected when branch doesn't exist
  const result = await execGit(["rev-parse", "--verify", branchName], DEFAULT_TIMEOUT_MS, true);
  return result.ok;
}

/**
 * Check if a remote branch exists
 */
async function remoteBranchExists(branchName: string): Promise<boolean> {
  // suppressErrorLog: true because failure is expected when branch doesn't exist
  const result = await execGit(["ls-remote", "--heads", "origin", branchName], DEFAULT_TIMEOUT_MS, true);
  return result.ok && result.value.trim().length > 0;
}

// ============================================================================
// Worktree Operations
// ============================================================================

export interface WorktreeInfo {
  readonly path: string;
  readonly branchName: string;
}

/**
 * Create a git worktree for a branch
 * If the branch doesn't exist, creates it from the current HEAD
 */
export async function createWorktree(
  repoRoot: string,
  branchName: string,
  signal?: AbortSignal
): Promise<WorktreeResult<WorktreeInfo>> {
  const worktreePath = getWorktreePath(repoRoot, branchName);

  logWorktree("info", "Creating worktree", { branchName, path: worktreePath });

  // Check for cancellation
  if (signal?.aborted) {
    return err(createWorktreeError("worktree_create_failed", "Operation cancelled"));
  }

  // Check if worktree already exists in git - reuse it
  const gitKnowsWorktree = await worktreeExists(repoRoot, branchName);
  if (gitKnowsWorktree) {
    logWorktree("info", "Worktree already exists, reusing", { branchName, path: worktreePath });
    return ok({ path: worktreePath, branchName });
  }

  // Check if directory exists but git doesn't know about it (orphaned)
  const dirExists = await exists(worktreePath);
  if (dirExists) {
    logWorktree("warn", "Removing orphaned worktree directory", { branchName, path: worktreePath });
    try {
      await remove(worktreePath, { recursive: true });
    } catch (e) {
      return err(createWorktreeError(
        "worktree_create_failed",
        "Failed to remove orphaned worktree directory",
        String(e)
      ));
    }
  }

  // Check if branch exists
  const localBranchExists = await branchExists(branchName);
  const remoteExists = await remoteBranchExists(branchName);

  let result: WorktreeResult<string>;

  if (localBranchExists || remoteExists) {
    // Use existing branch
    logWorktree("debug", "Using existing branch", { branchName, local: localBranchExists, remote: remoteExists });
    result = await execGit(["worktree", "add", worktreePath, branchName]);
  } else {
    // Create new branch from current HEAD
    logWorktree("debug", "Creating new branch", { branchName });
    result = await execGit(["worktree", "add", "-b", branchName, worktreePath]);
  }

  if (!result.ok) {
    return result;
  }

  logWorktree("info", "Worktree created successfully", { branchName, path: worktreePath });
  return ok({ path: worktreePath, branchName });
}

/**
 * Remove a git worktree
 */
export async function removeWorktree(
  repoRoot: string,
  branchName: string
): Promise<WorktreeResult<void>> {
  const worktreePath = getWorktreePath(repoRoot, branchName);

  logWorktree("info", "Removing worktree", { branchName, path: worktreePath });

  // First try to remove the worktree
  const removeResult = await execGit(["worktree", "remove", worktreePath, "--force"]);

  if (!removeResult.ok) {
    logWorktree("error", "Failed to remove worktree", { branchName, error: removeResult.error.message });
    return err(
      createWorktreeError(
        "worktree_remove_failed",
        "Failed to remove worktree",
        removeResult.error.details
      )
    );
  }

  // Prune to clean up any stale references
  await execGit(["worktree", "prune"]);

  logWorktree("info", "Worktree removed successfully", { branchName });
  return ok(undefined);
}

/**
 * List all worktrees
 */
export async function listWorktrees(): Promise<WorktreeResult<WorktreeInfo[]>> {
  const result = await execGit(["worktree", "list", "--porcelain"]);

  if (!result.ok) {
    return result as WorktreeResult<WorktreeInfo[]>;
  }

  const worktrees: WorktreeInfo[] = [];
  const lines = result.value.split("\n");
  let currentPath = "";
  let currentBranch = "";

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice(9);
    } else if (line.startsWith("branch refs/heads/")) {
      currentBranch = line.slice(18);
      if (currentPath && currentBranch) {
        worktrees.push({ path: currentPath, branchName: currentBranch });
      }
    } else if (line === "") {
      currentPath = "";
      currentBranch = "";
    }
  }

  return ok(worktrees);
}

/**
 * Check if a worktree exists for a given branch
 */
export async function worktreeExists(
  repoRoot: string,
  branchName: string
): Promise<boolean> {
  const result = await listWorktrees();
  if (!result.ok) {
    return false;
  }

  const targetPath = getWorktreePath(repoRoot, branchName);
  return result.value.some((wt) => wt.path === targetPath);
}
