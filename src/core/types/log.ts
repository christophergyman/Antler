/**
 * Logging Types
 * Type definitions for the logging system
 */

// ============================================================================
// Log Levels and Categories
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  | "user_action"
  | "data_sync"
  | "config"
  | "system"
  | "performance"
  | "worktree"
  | "devcontainer"
  | "docker"
  | "prerequisites"
  | "project";

// ============================================================================
// User Action Types
// ============================================================================

export type UserActionType =
  | "card_status_change"
  | "card_drag_start"
  | "card_drag_end"
  | "card_opened"
  | "card_updated"
  | "comment_added"
  | "data_refresh"
  | "data_source_toggle"
  | "modal_open"
  | "modal_close"
  | "worktree_start"
  | "worktree_stop"
  | "worktree_cancel"
  | "work_session_start"
  | "work_session_started"
  | "work_session_stop"
  | "work_session_stopped";

// ============================================================================
// Log Entry
// ============================================================================

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly category: LogCategory;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly sessionId: string;
}

// ============================================================================
// Factory Function
// ============================================================================

let sessionId: string | null = null;

/**
 * Get or create a session ID for the current app session
 */
export function getSessionId(): string {
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return sessionId;
}

/**
 * Create a new log entry with immutable properties
 */
export function createLogEntry(
  level: LogLevel,
  category: LogCategory,
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return Object.freeze({
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    context: context ? Object.freeze({ ...context }) : undefined,
    sessionId: getSessionId(),
  });
}
