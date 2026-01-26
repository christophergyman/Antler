/**
 * Notification Types
 * Type definitions for the notification system
 */

import type { LogCategory } from "./log";

// ============================================================================
// Notification Type
// ============================================================================

export interface Notification {
  readonly id: string;
  readonly message: string;
  readonly category: LogCategory;
  readonly timestamp: string;
  readonly details?: string;
}

// ============================================================================
// Category Display Names
// ============================================================================

export const CATEGORY_DISPLAY_NAMES: Record<LogCategory, string> = {
  system: "System Error",
  config: "Configuration Error",
  data_sync: "Sync Error",
  user_action: "Action Error",
  performance: "Performance Error",
  worktree: "Worktree Error",
  devcontainer: "Devcontainer Error",
  docker: "Docker Error",
  prerequisites: "Setup Error",
  project: "Project Error",
} as const;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new notification with immutable properties
 */
export function createNotification(
  message: string,
  category: LogCategory,
  details?: string
): Notification {
  return Object.freeze({
    id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    category,
    timestamp: new Date().toISOString(),
    details: details ? Object.freeze(details) : undefined,
  });
}
