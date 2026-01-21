/**
 * Card Sync Service
 * Merges fetched GitHub issues with existing Cards
 */

import type { Card } from "../types/card";
import type { GitHubInfo } from "../types/github";
import { createCard, updateGitHub } from "../card";
import { findByIssueNumber } from "../utils/collection";

// ============================================================================
// Types
// ============================================================================

export interface SyncStats {
  readonly created: number;
  readonly updated: number;
  readonly preserved: number;
  readonly skipped: number;
}

export interface SyncResult {
  readonly cards: Card[];
  readonly stats: SyncStats;
}

// ============================================================================
// Sync Logic
// ============================================================================

/**
 * Sync Cards with fetched GitHub issues
 *
 * - If issue number matches existing Card: update GitHub data, preserve Card metadata
 * - If no match: create new Card
 * - Existing Cards without matching issues are preserved (not deleted)
 *
 * Returns cards and stats about the sync operation
 */
export function syncCards(
  existingCards: readonly Card[],
  issues: readonly GitHubInfo[]
): SyncResult {
  const updatedCards: Card[] = [];
  const processedIssueNumbers = new Set<number>();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Process each fetched issue
  for (const issue of issues) {
    if (issue.issueNumber === null) {
      skipped++;
      continue;
    }

    processedIssueNumbers.add(issue.issueNumber);

    const existingCard = findByIssueNumber(existingCards, issue.issueNumber);

    if (existingCard) {
      // Update existing Card with new GitHub data
      // Preserves: sessionUid, name, status, worktreeCreated, createdAt
      updatedCards.push(updateGitHub(existingCard, issue));
      updated++;
    } else {
      // Create new Card for this issue
      updatedCards.push(
        createCard({
          github: issue,
        })
      );
      created++;
    }
  }

  // Preserve existing Cards that weren't updated (no matching issue in fetch)
  let preserved = 0;
  for (const card of existingCards) {
    if (card.github.issueNumber !== null && processedIssueNumbers.has(card.github.issueNumber)) {
      // Already processed - skip
      continue;
    }
    // Keep cards without issue numbers or with issue numbers not in current fetch
    updatedCards.push(card);
    preserved++;
  }

  return {
    cards: updatedCards,
    stats: Object.freeze({ created, updated, preserved, skipped }),
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create Cards from GitHub issues (no merge, fresh creation)
 */
export function createCardsFromIssues(issues: readonly GitHubInfo[]): Card[] {
  return issues
    .filter((issue) => issue.issueNumber !== null)
    .map((issue) => createCard({ github: issue }));
}

/**
 * Find Cards that exist locally but not in fetched issues
 * Useful for detecting closed/deleted issues
 */
export function findOrphanedCards(
  existingCards: readonly Card[],
  issues: readonly GitHubInfo[]
): Card[] {
  const fetchedIssueNumbers = new Set(
    issues.filter((i) => i.issueNumber !== null).map((i) => i.issueNumber)
  );

  return existingCards.filter(
    (card) =>
      card.github.issueNumber !== null &&
      !fetchedIssueNumbers.has(card.github.issueNumber)
  );
}
