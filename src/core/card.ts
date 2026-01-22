/**
 * Card - Represents a parallel work session with GitHub integration
 * Immutable by default, designed for parallel processing
 */

import type { GitHubInfo } from "./types/github";
import { createGitHubInfo, updateGitHubInfo } from "./types/github";
import { generateUid, generateName, isValidUid } from "./utils/uid";

// Re-export types for convenience
export type { GitHubInfo, GitHubComment, GitHubPR, LinkedIssue } from "./types/github";
export type { CIStatus } from "./types/ci";
export type { Card, CardStatus } from "./types/card";

// Import Card type for internal use
import type { Card, CardStatus } from "./types/card";

// ============================================================================
// Validation
// ============================================================================

const VALID_STATUSES: readonly CardStatus[] = ["idle", "active", "paused", "completed", "error"];

function validateCardObject(obj: unknown): asserts obj is Record<string, unknown> {
  if (!obj || typeof obj !== "object") {
    throw new Error("Invalid card: expected object");
  }

  const o = obj as Record<string, unknown>;

  if (typeof o.name !== "string" || o.name.length === 0) {
    throw new Error("Invalid card: name must be a non-empty string");
  }

  if (typeof o.sessionUid !== "string" || !isValidUid(o.sessionUid)) {
    throw new Error("Invalid card: sessionUid must be a valid UUID v4");
  }

  if (typeof o.status !== "string" || !VALID_STATUSES.includes(o.status as CardStatus)) {
    throw new Error(`Invalid card: status must be one of ${VALID_STATUSES.join("|")}`);
  }

  if (typeof o.worktreeCreated !== "boolean") {
    throw new Error("Invalid card: worktreeCreated must be a boolean");
  }

  if (!o.github || typeof o.github !== "object") {
    throw new Error("Invalid card: github must be an object");
  }

  if (typeof o.createdAt !== "string") {
    throw new Error("Invalid card: createdAt must be an ISO timestamp string");
  }

  if (typeof o.updatedAt !== "string") {
    throw new Error("Invalid card: updatedAt must be an ISO timestamp string");
  }
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
  const uid = generateUid();
  return Object.freeze({
    name: options.name ?? generateName(uid),
    sessionUid: uid,
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

export function isPaused(card: Card): boolean {
  return card.status === "paused";
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
  const parsed: unknown = JSON.parse(json);
  validateCardObject(parsed);

  return Object.freeze({
    name: parsed.name as string,
    sessionUid: parsed.sessionUid as string,
    status: parsed.status as CardStatus,
    worktreeCreated: parsed.worktreeCreated as boolean,
    github: createGitHubInfo(parsed.github as Partial<GitHubInfo>),
    createdAt: parsed.createdAt as string,
    updatedAt: parsed.updatedAt as string,
  });
}

export function toJSONArray(cards: readonly Card[]): string {
  return JSON.stringify(cards);
}

export function fromJSONArray(json: string): Card[] {
  const parsed: unknown = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error("Invalid cards: expected array");
  }

  return parsed.map((item: unknown, index: number) => {
    try {
      validateCardObject(item);
      return Object.freeze({
        name: item.name as string,
        sessionUid: item.sessionUid as string,
        status: item.status as CardStatus,
        worktreeCreated: item.worktreeCreated as boolean,
        github: createGitHubInfo(item.github as Partial<GitHubInfo>),
        createdAt: item.createdAt as string,
        updatedAt: item.updatedAt as string,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Invalid card at index ${index}: ${message}`);
    }
  });
}
