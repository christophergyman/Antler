/**
 * Card - Represents a parallel work session with GitHub integration
 * Immutable by default, designed for parallel processing
 */

import type { GitHubInfo } from "./types/github";
import { createGitHubInfo, updateGitHubInfo } from "./types/github";
import { generateUid, generateName } from "./utils/uid";

// Re-export types for convenience
export type { GitHubInfo, GitHubComment, GitHubPR, LinkedIssue } from "./types/github";
export type { CIStatus } from "./types/ci";

// ============================================================================
// Card Types
// ============================================================================

export type CardStatus = "idle" | "active" | "paused" | "completed" | "error";

export interface Card {
  readonly name: string;
  readonly sessionUid: string;
  readonly status: CardStatus;
  readonly worktreeCreated: boolean;
  readonly github: GitHubInfo;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

export interface CreateCardOptions {
  name?: string;
  status?: CardStatus;
  worktreeCreated?: boolean;
  github?: Partial<GitHubInfo>;
}

export function createCard(options: CreateCardOptions = {}): Card {
  const now = new Date().toISOString();
  return Object.freeze({
    name: options.name ?? generateName(),
    sessionUid: generateUid(),
    status: options.status ?? "idle",
    worktreeCreated: options.worktreeCreated ?? false,
    github: createGitHubInfo(options.github),
    createdAt: now,
    updatedAt: now,
  });
}

// ============================================================================
// Update Functions (Immutable - returns new Card)
// ============================================================================

function touchUpdatedAt(card: Card): Card {
  return Object.freeze({
    ...card,
    updatedAt: new Date().toISOString(),
  });
}

export function updateCard<K extends keyof Pick<Card, "status" | "worktreeCreated">>(
  card: Card,
  key: K,
  value: Card[K]
): Card {
  return touchUpdatedAt(Object.freeze({ ...card, [key]: value }));
}

export function updateGitHub(
  card: Card,
  partial: Partial<GitHubInfo>
): Card {
  return touchUpdatedAt(
    Object.freeze({
      ...card,
      github: updateGitHubInfo(card.github, partial),
    })
  );
}

// ============================================================================
// Status Helpers
// ============================================================================

export function setStatus(card: Card, status: CardStatus): Card {
  return updateCard(card, "status", status);
}

export function activate(card: Card): Card {
  return setStatus(card, "active");
}

export function pause(card: Card): Card {
  return setStatus(card, "paused");
}

export function complete(card: Card): Card {
  return setStatus(card, "completed");
}

export function setError(card: Card): Card {
  return setStatus(card, "error");
}

// ============================================================================
// Worktree Helpers
// ============================================================================

export function setWorktreeCreated(card: Card, created: boolean): Card {
  return updateCard(card, "worktreeCreated", created);
}

export function markWorktreeCreated(card: Card): Card {
  return setWorktreeCreated(card, true);
}

export function markWorktreeRemoved(card: Card): Card {
  return setWorktreeCreated(card, false);
}

// ============================================================================
// Predicates
// ============================================================================

export function isActive(card: Card): boolean {
  return card.status === "active";
}

export function isIdle(card: Card): boolean {
  return card.status === "idle";
}

export function isCompleted(card: Card): boolean {
  return card.status === "completed";
}

export function hasError(card: Card): boolean {
  return card.status === "error";
}

export function hasWorktree(card: Card): boolean {
  return card.worktreeCreated;
}

export function hasPR(card: Card): boolean {
  return card.github.pr !== null;
}

export function hasIssue(card: Card): boolean {
  return card.github.issueNumber !== null;
}

// ============================================================================
// Serialization
// ============================================================================

export function toJSON(card: Card): string {
  return JSON.stringify(card);
}

export function fromJSON(json: string): Card {
  const parsed = JSON.parse(json);
  return Object.freeze({
    name: parsed.name,
    sessionUid: parsed.sessionUid,
    status: parsed.status,
    worktreeCreated: parsed.worktreeCreated,
    github: createGitHubInfo(parsed.github),
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  });
}

export function toJSONArray(cards: readonly Card[]): string {
  return JSON.stringify(cards);
}

export function fromJSONArray(json: string): Card[] {
  const parsed = JSON.parse(json);
  return parsed.map((item: unknown) => fromJSON(JSON.stringify(item)));
}
