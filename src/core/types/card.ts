/**
 * Card Types
 * Core type definitions for the Card structure
 * Separated to avoid circular dependencies with collection utilities
 */

import type { GitHubInfo } from "./github";

export type CardStatus = "idle" | "in_progress" | "waiting" | "done";

export interface Card {
  readonly name: string;
  readonly sessionUid: string;
  readonly status: CardStatus;
  readonly worktreeCreated: boolean;
  readonly hasError: boolean;
  readonly github: GitHubInfo;
  readonly createdAt: string;
  readonly updatedAt: string;
}
