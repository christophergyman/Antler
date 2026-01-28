/**
 * Work Session Service
 * Orchestrates worktree creation with port allocation
 */

import type { Card } from "@core/types/card";
import type { WorkSessionResult } from "@core/types/result";
import { ok, err, createWorkSessionError } from "@core/types/result";
import { checkPrerequisites } from "./prerequisites";
import {
  createWorktree,
  removeWorktree,
  generateBranchName,
} from "./worktree";
import { allocatePort } from "./port";
import { logWorktree, logPrerequisites, logUserAction } from "./logging";

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
 * Creates worktree and allocates a unique port
 *
 * Uses a cleanup tracking flag to prevent double cleanup when abort races
 * with async operation completion.
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

  // Track cleanup state to prevent double cleanup on abort race
  let cleanupPerformed = false;
  let worktreeCreated = false;
  let branchName: string | null = null;

  // Cleanup helper that ensures cleanup only happens once
  const performCleanup = async () => {
    if (cleanupPerformed || !worktreeCreated || !branchName) {
      return;
    }
    cleanupPerformed = true;
    logWorktree("info", "Cleaning up worktree", { branchName, cardId: card.sessionUid });
    await removeWorktree(repoRoot, branchName);
  };

  // Check for cancellation early
  if (signal?.aborted) {
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 1: Check prerequisites
  logPrerequisites("debug", "Checking prerequisites for work session");
  const prereqResult = await checkPrerequisites();

  if (!prereqResult.ok) {
    logPrerequisites("error", "Prerequisites check failed", {
      code: prereqResult.error.code,
      message: prereqResult.error.message,
      details: prereqResult.error.details,
      cardId: card.sessionUid,
    });
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
  branchName = getBranchNameForCard(card);

  if (!branchName) {
    return err(
      createWorkSessionError(
        "worktree_failed",
        "Cannot create worktree without issue or PR",
        "Card must have a linked issue or PR"
      )
    );
  }

  // Check for cancellation
  if (signal?.aborted) {
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 3: Create worktree
  logWorktree("info", "Creating worktree", { branchName, cardId: card.sessionUid });
  const worktreeResult = await createWorktree(repoRoot, branchName, signal);

  if (!worktreeResult.ok) {
    logWorktree("error", "Worktree creation failed", {
      code: worktreeResult.error.code,
      message: worktreeResult.error.message,
      details: worktreeResult.error.details,
      branchName,
      cardId: card.sessionUid,
    });
    return err(
      createWorkSessionError(
        "worktree_failed",
        worktreeResult.error.message,
        worktreeResult.error.details
      )
    );
  }

  // Mark worktree as created for cleanup tracking
  worktreeCreated = true;
  const worktreePath = worktreeResult.value.path;

  // Check for cancellation - cleanup worktree if cancelled
  if (signal?.aborted) {
    await performCleanup();
    return err(createWorkSessionError("cancelled", "Operation cancelled"));
  }

  // Step 4: Allocate port
  logWorktree("debug", "Allocating port for worktree", { worktreePath });
  let port: number;
  try {
    port = await allocatePort(repoRoot, worktreePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWorktree("error", "Port allocation failed, rolling back worktree", {
      message,
      branchName,
      cardId: card.sessionUid,
    });
    await performCleanup();
    return err(
      createWorkSessionError(
        "port_allocation_failed",
        "Failed to allocate port",
        message
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
 * Removes worktree (port file is automatically cleaned up with worktree)
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

  // Remove worktree (port file is inside worktree, so it's automatically deleted)
  logWorktree("info", "Removing worktree", { branchName, cardId: card.sessionUid });
  const removeResult = await removeWorktree(repoRoot, branchName);

  if (!removeResult.ok) {
    logWorktree("error", "Failed to remove worktree", {
      code: removeResult.error.code,
      message: removeResult.error.message,
      details: removeResult.error.details,
      branchName,
      cardId: card.sessionUid,
    });
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
