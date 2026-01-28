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
export type { Card, CardStatus, WorktreeOperation } from "./types/card";

// Import Card type for internal use
import type { Card, CardStatus, WorktreeOperation } from "./types/card";

// ============================================================================
// Validation
// ============================================================================

const VALID_STATUSES: readonly CardStatus[] = ["idle", "in_progress", "waiting", "done"];
const VALID_WORKTREE_OPERATIONS: readonly WorktreeOperation[] = ["idle", "creating", "removing", "error"];

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

  if (typeof o.hasError !== "boolean") {
    throw new Error("Invalid card: hasError must be a boolean");
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

  if (o.worktreePath !== null && typeof o.worktreePath !== "string") {
    throw new Error("Invalid card: worktreePath must be a string or null");
  }

  if (typeof o.worktreeOperation !== "string" || !VALID_WORKTREE_OPERATIONS.includes(o.worktreeOperation as WorktreeOperation)) {
    throw new Error(`Invalid card: worktreeOperation must be one of ${VALID_WORKTREE_OPERATIONS.join("|")}`);
  }

  if (o.worktreeError !== null && typeof o.worktreeError !== "string") {
    throw new Error("Invalid card: worktreeError must be a string or null");
  }

  if (o.port !== null && typeof o.port !== "number") {
    throw new Error("Invalid card: port must be a number or null");
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export interface CreateCardOptions {
  name?: string;
  status?: CardStatus;
  worktreeCreated?: boolean;
  hasError?: boolean;
  github?: Partial<GitHubInfo>;
  worktreePath?: string | null;
  worktreeOperation?: WorktreeOperation;
  worktreeError?: string | null;
  port?: number | null;
}

export function createCard(options: CreateCardOptions = {}): Card {
  const now = new Date().toISOString();
  const uid = generateUid();
  return Object.freeze({
    name: options.name ?? generateName(uid),
    sessionUid: uid,
    status: options.status ?? "idle",
    worktreeCreated: options.worktreeCreated ?? false,
    hasError: options.hasError ?? false,
    github: createGitHubInfo(options.github),
    createdAt: now,
    updatedAt: now,
    worktreePath: options.worktreePath ?? null,
    worktreeOperation: options.worktreeOperation ?? "idle",
    worktreeError: options.worktreeError ?? null,
    port: options.port ?? null,
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

export function updateCard<K extends keyof Pick<Card, "status" | "worktreeCreated" | "hasError">>(
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

export function setInProgress(card: Card): Card {
  return setStatus(card, "in_progress");
}

export function setWaiting(card: Card): Card {
  return setStatus(card, "waiting");
}

export function setDone(card: Card): Card {
  return setStatus(card, "done");
}

// ============================================================================
// Error Helpers
// ============================================================================

export function markError(card: Card): Card {
  return updateCard(card, "hasError", true);
}

export function clearError(card: Card): Card {
  return updateCard(card, "hasError", false);
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
// Worktree State Helpers
// ============================================================================

export function setWorktreeOperation(card: Card, operation: WorktreeOperation): Card {
  return touchUpdatedAt(Object.freeze({ ...card, worktreeOperation: operation }));
}

export function setWorktreePath(card: Card, path: string | null): Card {
  return touchUpdatedAt(Object.freeze({ ...card, worktreePath: path }));
}

export function setWorktreeError(card: Card, error: string | null): Card {
  return touchUpdatedAt(Object.freeze({ ...card, worktreeError: error }));
}

export function setPort(card: Card, port: number | null): Card {
  return touchUpdatedAt(Object.freeze({ ...card, port }));
}

export function startWorktreeCreation(card: Card): Card {
  return touchUpdatedAt(Object.freeze({
    ...card,
    worktreeOperation: "creating" as WorktreeOperation,
    worktreeError: null,
  }));
}

export function completeWorktreeCreation(card: Card, path: string, port: number): Card {
  return touchUpdatedAt(Object.freeze({
    ...card,
    worktreeCreated: true,
    worktreePath: path,
    worktreeOperation: "idle" as WorktreeOperation,
    worktreeError: null,
    port,
  }));
}

export function startWorktreeRemoval(card: Card): Card {
  return touchUpdatedAt(Object.freeze({
    ...card,
    worktreeOperation: "removing" as WorktreeOperation,
    worktreeError: null,
  }));
}

export function completeWorktreeRemoval(card: Card): Card {
  return touchUpdatedAt(Object.freeze({
    ...card,
    worktreeCreated: false,
    worktreePath: null,
    worktreeOperation: "idle" as WorktreeOperation,
    worktreeError: null,
    port: null,
  }));
}

export function setWorktreeErrorState(card: Card, error: string): Card {
  return touchUpdatedAt(Object.freeze({
    ...card,
    worktreeOperation: "error" as WorktreeOperation,
    worktreeError: error,
  }));
}

// ============================================================================
// Predicates
// ============================================================================

export function isInProgress(card: Card): boolean {
  return card.status === "in_progress";
}

export function isIdle(card: Card): boolean {
  return card.status === "idle";
}

export function isWaiting(card: Card): boolean {
  return card.status === "waiting";
}

export function isDone(card: Card): boolean {
  return card.status === "done";
}

export function hasError(card: Card): boolean {
  return card.hasError;
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

export function isWorktreeCreating(card: Card): boolean {
  return card.worktreeOperation === "creating";
}

export function isWorktreeRemoving(card: Card): boolean {
  return card.worktreeOperation === "removing";
}

export function hasWorktreeError(card: Card): boolean {
  return card.worktreeOperation === "error";
}

export function isWorktreeOperationInProgress(card: Card): boolean {
  return card.worktreeOperation === "creating" || card.worktreeOperation === "removing";
}

export function hasPort(card: Card): boolean {
  return card.port !== null;
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
    hasError: parsed.hasError as boolean,
    github: createGitHubInfo(parsed.github as Partial<GitHubInfo>),
    createdAt: parsed.createdAt as string,
    updatedAt: parsed.updatedAt as string,
    worktreePath: parsed.worktreePath as string | null,
    worktreeOperation: parsed.worktreeOperation as WorktreeOperation,
    worktreeError: parsed.worktreeError as string | null,
    port: parsed.port as number | null,
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
        hasError: item.hasError as boolean,
        github: createGitHubInfo(item.github as Partial<GitHubInfo>),
        createdAt: item.createdAt as string,
        updatedAt: item.updatedAt as string,
        worktreePath: item.worktreePath as string | null,
        worktreeOperation: item.worktreeOperation as WorktreeOperation,
        worktreeError: item.worktreeError as string | null,
        port: item.port as number | null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Invalid card at index ${index}: ${message}`);
    }
  });
}
