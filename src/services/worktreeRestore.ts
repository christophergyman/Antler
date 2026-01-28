/**
 * Worktree Restoration Service
 * Matches existing worktrees to cards and restores their state on app startup
 */

import type { Card, CardStatus } from "@core/types/card";
import { setStatus, completeWorktreeCreation } from "@core/card";
import { listWorktrees, parseIssueNumberFromBranch, type WorktreeInfo } from "./worktree";
import { getWorktreePort } from "./port";
import { loadCardStatuses } from "./cardStatus";
import { logDataSync } from "./logging";

// ============================================================================
// Types
// ============================================================================

export interface RestoreResult {
  /** All cards with worktree state restored where applicable */
  readonly cards: Card[];
  /** Worktrees that couldn't be matched to any card */
  readonly orphanedWorktrees: WorktreeInfo[];
  /** Statistics about the restoration */
  readonly stats: {
    readonly matched: number;
    readonly orphaned: number;
    readonly portReadErrors: number;
  };
}

interface WorktreeMatch {
  readonly card: Card;
  readonly worktree: WorktreeInfo;
  readonly matchedBy: "pr_branch" | "issue_number";
}

// ============================================================================
// Main Restoration Function
// ============================================================================

/**
 * Restore worktree state for cards on app startup
 *
 * 1. Lists all worktrees in .worktrees/ directory
 * 2. Matches each worktree to a card by PR branch name or issue number
 * 3. Reads persisted status and port for each match
 * 4. Returns cards with worktree state populated
 */
export async function restoreWorktreeState(
  cards: readonly Card[],
  repoRoot: string
): Promise<RestoreResult> {
  logDataSync("info", "Starting worktree state restoration", { cardCount: cards.length });

  // Get all worktrees
  const worktreesResult = await listWorktrees();
  if (!worktreesResult.ok) {
    logDataSync("warn", "Failed to list worktrees, skipping restoration", {
      error: worktreesResult.error.message,
    });
    return {
      cards: [...cards],
      orphanedWorktrees: [],
      stats: { matched: 0, orphaned: 0, portReadErrors: 0 },
    };
  }

  // Filter to only worktrees in .worktrees/ directory (exclude main repo)
  const antlerWorktrees = worktreesResult.value.filter((wt) =>
    wt.path.includes(".worktrees/")
  );

  if (antlerWorktrees.length === 0) {
    logDataSync("debug", "No worktrees found in .worktrees/ directory");
    return {
      cards: [...cards],
      orphanedWorktrees: [],
      stats: { matched: 0, orphaned: 0, portReadErrors: 0 },
    };
  }

  logDataSync("debug", "Found worktrees to match", { count: antlerWorktrees.length });

  // Load persisted statuses
  const persistedStatuses = await loadCardStatuses();
  logDataSync("debug", "Loaded persisted statuses", { count: Object.keys(persistedStatuses).length });

  // Match worktrees to cards
  const matches: WorktreeMatch[] = [];
  const matchedCardIds = new Set<string>();
  const matchedWorktreePaths = new Set<string>();

  for (const worktree of antlerWorktrees) {
    const match = findMatchingCard(cards, worktree, matchedCardIds);
    if (match) {
      matches.push(match);
      matchedCardIds.add(match.card.sessionUid);
      matchedWorktreePaths.add(worktree.path);
      logDataSync("debug", "Matched worktree to card", {
        branch: worktree.branchName,
        issueNumber: match.card.github.issueNumber,
        matchedBy: match.matchedBy,
      });
    }
  }

  // Find orphaned worktrees
  const orphanedWorktrees = antlerWorktrees.filter(
    (wt) => !matchedWorktreePaths.has(wt.path)
  );

  if (orphanedWorktrees.length > 0) {
    logDataSync("warn", "Found orphaned worktrees", {
      count: orphanedWorktrees.length,
      branches: orphanedWorktrees.map((wt) => wt.branchName),
    });
  }

  // Restore state for matched cards
  let portReadErrors = 0;
  const restoredCards = await Promise.all(
    cards.map(async (card) => {
      const match = matches.find((m) => m.card.sessionUid === card.sessionUid);
      if (!match) {
        return card;
      }

      // Read port from worktree
      const port = await getWorktreePort(match.worktree.path);
      if (port === null) {
        portReadErrors++;
        logDataSync("debug", "Could not read port for worktree", {
          path: match.worktree.path,
        });
      }

      // Get persisted status (fallback to "in_progress" if not found)
      const issueNumber = card.github.issueNumber;
      const persistedStatus = issueNumber !== null ? persistedStatuses[issueNumber] : null;
      const status: CardStatus = persistedStatus ?? "in_progress";

      // Restore worktree state
      let restoredCard = completeWorktreeCreation(card, match.worktree.path, port ?? 0);

      // If port was null, set it explicitly to null (completeWorktreeCreation requires a number)
      if (port === null) {
        restoredCard = Object.freeze({ ...restoredCard, port: null });
      }

      // Set the persisted status
      restoredCard = setStatus(restoredCard, status);

      logDataSync("info", "Restored card worktree state", {
        issueNumber,
        status,
        path: match.worktree.path,
        port,
      });

      return restoredCard;
    })
  );

  const stats = {
    matched: matches.length,
    orphaned: orphanedWorktrees.length,
    portReadErrors,
  };

  logDataSync("info", "Worktree restoration complete", stats);

  return {
    cards: restoredCards,
    orphanedWorktrees,
    stats,
  };
}

// ============================================================================
// Matching Logic
// ============================================================================

/**
 * Find a card that matches the given worktree
 * Priority:
 * 1. Match by PR branch name (exact match)
 * 2. Match by issue number parsed from branch name
 */
function findMatchingCard(
  cards: readonly Card[],
  worktree: WorktreeInfo,
  alreadyMatched: Set<string>
): WorktreeMatch | null {
  // Try matching by PR branch name first
  for (const card of cards) {
    if (alreadyMatched.has(card.sessionUid)) continue;

    if (card.github.pr?.branchName === worktree.branchName) {
      return {
        card,
        worktree,
        matchedBy: "pr_branch",
      };
    }
  }

  // Try matching by issue number from branch name
  const issueNumber = parseIssueNumberFromBranch(worktree.branchName);
  if (issueNumber === null) {
    return null;
  }

  for (const card of cards) {
    if (alreadyMatched.has(card.sessionUid)) continue;

    if (card.github.issueNumber === issueNumber) {
      return {
        card,
        worktree,
        matchedBy: "issue_number",
      };
    }
  }

  return null;
}
