/**
 * Work Session Service
 * Orchestrates worktree creation and devcontainer startup
 */

import type { Card } from "@core/types/card";
import type { WorkSessionResult } from "@core/types/result";
import { ok, err, createWorkSessionError } from "@core/types/result";
import { checkPrerequisites } from "./prerequisites";
import {
  createWorktree,
  removeWorktree,
  generateBranchName,
  getWorktreePath,
} from "./worktree";
import {
  findAvailablePort,
  startDevcontainer,
  stopDevcontainer,
  hasDevcontainerConfig,
} from "./devcontainer";
import { logSystem, logUserAction } from "./logging";

// ============================================================================
// Types
// ============================================================================

export interface WorkSessionInfo {
  readonly branchName: string;
  readonly worktreePath: string;
  readonly port: number;
}

// ============================================================================
// Branch Name Resolution
// ============================================================================

/**
 * Get the branch name for a card
 * Uses PR branch if available, otherwise generates from issue number and title
 */
export function getBranchNameForCard(card: Card): string | null {
  // If card has a linked PR, use its branch name
  if (card.github.pr?.branchName) {
    return card.github.pr.branchName;
  }

  // If card has an issue number, generate branch name from it
  if (card.github.issueNumber !== null) {
    return generateBranchName(card.github.issueNumber, card.github.title);
  }

  // No branch name available
  return null;
}

// ============================================================================
// Work Session Lifecycle
// ============================================================================

/**
 * Start a work session for a card
 * Creates worktree and starts devcontainer
 */
export async function startWorkSession(
  repoRoot: string,
  card: Card,
  signal?: AbortSignal
): Promise<WorkSessionResult<WorkSessionInfo>> {
  logUserAction("work_session_start", "Starting work session", {
    cardId: card.sessionUid,
    cardName: card.name,
  });

  // Check for cancellation early
  if (signal?.aborted) {
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 1: Check prerequisites
  logSystem("debug", "Checking prerequisites");
  const prereqResult = await checkPrerequisites();

  if (!prereqResult.ok) {
    logSystem("error", "Prerequisites check failed", { error: prereqResult.error });
    return err(
      createWorkSessionError(
        "prerequisite_failed",
        prereqResult.error.message,
        prereqResult.error.details
      )
    );
  }

  // Check for cancellation
  if (signal?.aborted) {
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 2: Get branch name
  const branchName = getBranchNameForCard(card);

  if (!branchName) {
    return err(
      createWorkSessionError(
        "worktree_failed",
        "Cannot create worktree without issue or PR",
        "Card must have a linked issue or PR"
      )
    );
  }

  // Step 3: Check for devcontainer config before creating worktree
  // Check in the main repo first (worktree will inherit it)
  const hasConfig = await hasDevcontainerConfig(repoRoot);
  if (!hasConfig) {
    return err(
      createWorkSessionError(
        "devcontainer_failed",
        "No devcontainer.json found",
        `Repository must have a .devcontainer/devcontainer.json configuration`
      )
    );
  }

  // Check for cancellation
  if (signal?.aborted) {
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 4: Create worktree
  logSystem("debug", "Creating worktree", { branchName });
  const worktreeResult = await createWorktree(repoRoot, branchName, signal);

  if (!worktreeResult.ok) {
    logSystem("error", "Worktree creation failed", { error: worktreeResult.error });
    return err(
      createWorkSessionError(
        "worktree_failed",
        worktreeResult.error.message,
        worktreeResult.error.details
      )
    );
  }

  const worktreePath = worktreeResult.value.path;

  // Check for cancellation - cleanup worktree if cancelled
  if (signal?.aborted) {
    logSystem("info", "Cleaning up worktree after cancellation");
    await removeWorktree(repoRoot, branchName);
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 5: Find available port
  logSystem("debug", "Finding available port");
  const portResult = await findAvailablePort();

  if (!portResult.ok) {
    // Rollback: remove worktree
    logSystem("info", "Rolling back worktree due to port allocation failure");
    await removeWorktree(repoRoot, branchName);

    return err(
      createWorkSessionError(
        "devcontainer_failed",
        portResult.error.message,
        portResult.error.details
      )
    );
  }

  const port = portResult.value;

  // Check for cancellation - cleanup worktree if cancelled
  if (signal?.aborted) {
    logSystem("info", "Cleaning up worktree after cancellation");
    await removeWorktree(repoRoot, branchName);
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 6: Start devcontainer
  logSystem("debug", "Starting devcontainer", { worktreePath, port });
  const devcontainerResult = await startDevcontainer(worktreePath, port, signal);

  if (!devcontainerResult.ok) {
    // Rollback: remove worktree
    logSystem("info", "Rolling back worktree due to devcontainer failure");
    await removeWorktree(repoRoot, branchName);

    return err(
      createWorkSessionError(
        "devcontainer_failed",
        devcontainerResult.error.message,
        devcontainerResult.error.details
      )
    );
  }

  // Success!
  logUserAction("work_session_started", "Work session started successfully", {
    cardId: card.sessionUid,
    branchName,
    worktreePath,
    port,
  });

  return ok({
    branchName,
    worktreePath,
    port,
  });
}

/**
 * Stop a work session for a card
 * Stops devcontainer and removes worktree
 */
export async function stopWorkSession(
  repoRoot: string,
  card: Card
): Promise<WorkSessionResult<void>> {
  logUserAction("work_session_stop", "Stopping work session", {
    cardId: card.sessionUid,
    cardName: card.name,
    worktreePath: card.worktreePath,
  });

  const branchName = getBranchNameForCard(card);

  if (!branchName) {
    // No branch name means no worktree to clean up
    return ok(undefined);
  }

  const worktreePath = card.worktreePath ?? getWorktreePath(repoRoot, branchName);

  // Step 1: Stop devcontainer
  logSystem("debug", "Stopping devcontainer", { worktreePath });
  const stopResult = await stopDevcontainer(worktreePath);

  if (!stopResult.ok) {
    logSystem("warn", "Failed to stop devcontainer, continuing with cleanup", {
      error: stopResult.error,
    });
    // Continue with worktree removal even if devcontainer stop fails
  }

  // Step 2: Remove worktree
  logSystem("debug", "Removing worktree", { branchName });
  const removeResult = await removeWorktree(repoRoot, branchName);

  if (!removeResult.ok) {
    logSystem("error", "Failed to remove worktree", { error: removeResult.error });
    return err(
      createWorkSessionError(
        "worktree_failed",
        removeResult.error.message,
        removeResult.error.details
      )
    );
  }

  logUserAction("work_session_stopped", "Work session stopped successfully", {
    cardId: card.sessionUid,
    branchName,
  });

  return ok(undefined);
}
