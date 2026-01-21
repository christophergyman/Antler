/**
 * Card Collection Utilities
 * Pure functions for parallel-safe operations on Card arrays
 */

import type { Card, CardStatus } from "../types/card";

// ============================================================================
// Filtering
// ============================================================================

export function filterByStatus(cards: readonly Card[], status: CardStatus): Card[] {
  return cards.filter((card) => card.status === status);
}

export function filterActive(cards: readonly Card[]): Card[] {
  return filterByStatus(cards, "active");
}

export function filterIdle(cards: readonly Card[]): Card[] {
  return filterByStatus(cards, "idle");
}

export function filterCompleted(cards: readonly Card[]): Card[] {
  return filterByStatus(cards, "completed");
}

export function filterPaused(cards: readonly Card[]): Card[] {
  return filterByStatus(cards, "paused");
}

export function filterWithWorktree(cards: readonly Card[]): Card[] {
  return cards.filter((card) => card.worktreeCreated);
}

export function filterWithoutWorktree(cards: readonly Card[]): Card[] {
  return cards.filter((card) => !card.worktreeCreated);
}

export function filterByRepo(cards: readonly Card[], repoFullName: string): Card[] {
  return cards.filter(
    (card) => `${card.github.repoOwner}/${card.github.repoName}` === repoFullName
  );
}

export function filterByLabel(cards: readonly Card[], label: string): Card[] {
  return cards.filter((card) => card.github.labels.includes(label));
}

export function filterByAssignee(cards: readonly Card[], assignee: string): Card[] {
  return cards.filter((card) => card.github.assignees.includes(assignee));
}

// ============================================================================
// Finding
// ============================================================================

export function findByUid(cards: readonly Card[], uid: string): Card | undefined {
  return cards.find((card) => card.sessionUid === uid);
}

export function findByName(cards: readonly Card[], name: string): Card | undefined {
  return cards.find((card) => card.name === name);
}

export function findByIssueNumber(
  cards: readonly Card[],
  issueNumber: number
): Card | undefined {
  return cards.find((card) => card.github.issueNumber === issueNumber);
}

export function findByPRNumber(
  cards: readonly Card[],
  prNumber: number
): Card | undefined {
  return cards.find((card) => card.github.pr?.number === prNumber);
}

export function findByBranch(
  cards: readonly Card[],
  branchName: string
): Card | undefined {
  return cards.find((card) => card.github.pr?.branchName === branchName);
}

// ============================================================================
// Batch Operations
// ============================================================================

export function updateAll(
  cards: readonly Card[],
  updater: (card: Card) => Card
): Card[] {
  return cards.map(updater);
}

export function updateWhere(
  cards: readonly Card[],
  predicate: (card: Card) => boolean,
  updater: (card: Card) => Card
): Card[] {
  return cards.map((card) => (predicate(card) ? updater(card) : card));
}

export function removeByUid(cards: readonly Card[], uid: string): Card[] {
  return cards.filter((card) => card.sessionUid !== uid);
}

export function removeWhere(
  cards: readonly Card[],
  predicate: (card: Card) => boolean
): Card[] {
  return cards.filter((card) => !predicate(card));
}

// ============================================================================
// Parallel Operations
// ============================================================================

export async function mapParallel<T>(
  cards: readonly Card[],
  fn: (card: Card) => Promise<T>
): Promise<T[]> {
  return Promise.all(cards.map(fn));
}

export async function mapParallelSettled<T>(
  cards: readonly Card[],
  fn: (card: Card) => Promise<T>
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(cards.map(fn));
}

export async function filterParallel(
  cards: readonly Card[],
  predicate: (card: Card) => Promise<boolean>
): Promise<Card[]> {
  const results = await Promise.all(
    cards.map(async (card) => ({ card, keep: await predicate(card) }))
  );
  return results.filter((r) => r.keep).map((r) => r.card);
}

export async function forEachParallel(
  cards: readonly Card[],
  fn: (card: Card) => Promise<void>
): Promise<void> {
  await Promise.all(cards.map(fn));
}

// ============================================================================
// Sorting (optimized with cached timestamps)
// ============================================================================

export function sortByCreated(
  cards: readonly Card[],
  order: "asc" | "desc" = "desc"
): Card[] {
  const withTime = cards.map((card) => ({
    card,
    time: new Date(card.createdAt).getTime(),
  }));
  withTime.sort((a, b) => a.time - b.time);
  const sorted = withTime.map((x) => x.card);
  return order === "desc" ? sorted.reverse() : sorted;
}

export function sortByUpdated(
  cards: readonly Card[],
  order: "asc" | "desc" = "desc"
): Card[] {
  const withTime = cards.map((card) => ({
    card,
    time: new Date(card.updatedAt).getTime(),
  }));
  withTime.sort((a, b) => a.time - b.time);
  const sorted = withTime.map((x) => x.card);
  return order === "desc" ? sorted.reverse() : sorted;
}

export function sortByName(
  cards: readonly Card[],
  order: "asc" | "desc" = "asc"
): Card[] {
  const sorted = [...cards].sort((a, b) => a.name.localeCompare(b.name));
  return order === "desc" ? sorted.reverse() : sorted;
}

export function sortByIssueNumber(
  cards: readonly Card[],
  order: "asc" | "desc" = "asc"
): Card[] {
  const sorted = [...cards].sort((a, b) => {
    const aNum = a.github.issueNumber ?? Infinity;
    const bNum = b.github.issueNumber ?? Infinity;
    return aNum - bNum;
  });
  return order === "desc" ? sorted.reverse() : sorted;
}

// ============================================================================
// Aggregation
// ============================================================================

export function countByStatus(cards: readonly Card[]): Record<CardStatus, number> {
  const counts: Record<CardStatus, number> = {
    idle: 0,
    active: 0,
    paused: 0,
    completed: 0,
    error: 0,
  };
  for (const card of cards) {
    counts[card.status]++;
  }
  return counts;
}

export function groupByStatus(cards: readonly Card[]): Record<CardStatus, Card[]> {
  const groups: Record<CardStatus, Card[]> = {
    idle: [],
    active: [],
    paused: [],
    completed: [],
    error: [],
  };
  for (const card of cards) {
    groups[card.status].push(card);
  }
  return groups;
}

export function groupByRepo(cards: readonly Card[]): Map<string, Card[]> {
  const groups = new Map<string, Card[]>();
  for (const card of cards) {
    const key = `${card.github.repoOwner}/${card.github.repoName}`;
    const existing = groups.get(key) ?? [];
    existing.push(card);
    groups.set(key, existing);
  }
  return groups;
}
