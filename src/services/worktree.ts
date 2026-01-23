/**
 * Git Worktree Service
 * Creates and manages git worktrees for parallel work sessions
 */

import { Command } from "@tauri-apps/plugin-shell";
import type { WorktreeResult } from "@core/types/result";
import { ok, err, createWorktreeError } from "@core/types/result";
import { logWorktree } from "./logging";

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
 */
export function generateBranchName(issueNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "")     // Trim leading/trailing hyphens
    .slice(0, 50);               // Limit length

  return `${issueNumber}-${slug}`;
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

async function execGit(
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<WorktreeResult<string>> {
  const commandPreview = `git ${args.slice(0, 4).join(" ")}${args.length > 4 ? "..." : ""}`;
  logWorktree("debug", `Executing: ${commandPreview}`);

  try {
    const command = Command.create("run-git", args);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let child: Awaited<ReturnType<typeof command.spawn>> | null = null;

    command.stdout.on("data", (data) => {
      stdout += data;
    });
    command.stderr.on("data", (data) => {
      stderr += data;
    });

    const exitPromise = new Promise<number | null>((resolve) => {
      command.on("close", (data) => resolve(data.code));
      command.on("error", () => resolve(null));
    });

    child = await command.spawn();

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child?.kill();
    }, timeoutMs);

    const status = await exitPromise;
    clearTimeout(timeoutId);

    if (timedOut) {
      logWorktree("error", "Git command timed out", { command: commandPreview, timeoutMs });
      return err(
        createWorktreeError(
          "worktree_create_failed",
          "Git command timed out",
          `${commandPreview} exceeded ${timeoutMs}ms`
        )
      );
    }

    if (status === 0) {
      logWorktree("debug", "Git command succeeded", { command: commandPreview });
      return ok(stdout);
    }

    // Handle specific errors
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

    logWorktree("error", `Git command failed with exit code ${status}`, {
      command: commandPreview,
      exitCode: status,
      stderr: stderr.trim()
    });
    return err(
      createWorktreeError(
        "worktree_create_failed",
        `Git command failed with exit code ${status}`,
        stderr.trim()
      )
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      logWorktree("error", "Git not installed");
      return err(
        createWorktreeError(
          "git_not_installed",
          "Git is not installed",
          "Install git from https://git-scm.com"
        )
      );
    }

    logWorktree("error", "Failed to execute git command", { error: errorMessage });
    return err(
      createWorktreeError("worktree_create_failed", "Failed to execute git command", errorMessage)
    );
  }
}

// ============================================================================
// Branch Operations
// ============================================================================

/**
 * Check if a branch exists (locally or remotely)
 */
async function branchExists(branchName: string): Promise<boolean> {
  const result = await execGit(["rev-parse", "--verify", branchName]);
  return result.ok;
}

/**
 * Check if a remote branch exists
 */
async function remoteBranchExists(branchName: string): Promise<boolean> {
  const result = await execGit(["ls-remote", "--heads", "origin", branchName]);
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

  // Check if branch exists
  const exists = await branchExists(branchName);
  const remoteExists = await remoteBranchExists(branchName);

  let result: WorktreeResult<string>;

  if (exists || remoteExists) {
    // Use existing branch
    logWorktree("debug", "Using existing branch", { branchName, local: exists, remote: remoteExists });
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
