/**
 * Card Types
 * Core type definitions for the Card structure
 * Separated to avoid circular dependencies with collection utilities
 */

import type { GitHubInfo } from "./github";

export type CardStatus = "idle" | "in_progress" | "waiting" | "done";

export type WorktreeOperation = "idle" | "creating" | "removing" | "error";

export interface Card {
  readonly name: string;
  readonly sessionUid: string;
  readonly status: CardStatus;
  readonly worktreeCreated: boolean;
  readonly hasError: boolean;
  readonly github: GitHubInfo;
  readonly createdAt: string;
  readonly updatedAt: string;
  // Worktree fields
  readonly worktreePath: string | null;
  readonly worktreeOperation: WorktreeOperation;
  readonly worktreeError: string | null;
  // Devcontainer fields
  readonly devcontainerRunning: boolean;
  readonly devcontainerPort: number | null;
}
