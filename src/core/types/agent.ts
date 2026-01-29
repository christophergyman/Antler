/**
 * Agent Types
 * Type definitions for Claude CLI agent sessions
 */

import type { Result } from "./result";

// ============================================================================
// Agent Session Types
// ============================================================================

export type AgentStatus = "starting" | "running" | "stopped" | "error";

export interface AgentSession {
  readonly id: string;
  readonly cardId: string;
  readonly worktreePath: string;
  readonly port: number | null;
  readonly status: AgentStatus;
  readonly pid: number | null;
  readonly createdAt: string;
  readonly error: string | null;
}

export function createAgentSession(
  cardId: string,
  worktreePath: string,
  port: number | null
): AgentSession {
  return Object.freeze({
    id: crypto.randomUUID(),
    cardId,
    worktreePath,
    port,
    status: "starting",
    pid: null,
    createdAt: new Date().toISOString(),
    error: null,
  });
}

export function updateAgentSession(
  session: AgentSession,
  updates: Partial<Pick<AgentSession, "status" | "pid" | "error">>
): AgentSession {
  return Object.freeze({
    ...session,
    ...updates,
  });
}

// ============================================================================
// PTY Types
// ============================================================================

export interface PtyOptions {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
  readonly env?: Readonly<Record<string, string>>;
}

export interface PtyHandle {
  readonly id: number;
  write: (data: string) => Promise<void>;
  resize: (cols: number, rows: number) => Promise<void>;
  kill: () => Promise<void>;
  onData: (callback: (data: string) => void) => () => void;
  onExit: (callback: (code: number | null) => void) => () => void;
}

// ============================================================================
// Agent Errors
// ============================================================================

export type AgentErrorCode =
  | "claude_not_installed"
  | "spawn_failed"
  | "pty_error"
  | "session_not_found"
  | "max_sessions_exceeded";

export interface AgentError {
  readonly code: AgentErrorCode;
  readonly message: string;
  readonly details?: string;
}

export function createAgentError(
  code: AgentErrorCode,
  message: string,
  details?: string
): AgentError {
  return Object.freeze({ code, message, details });
}

// ============================================================================
// Type Aliases
// ============================================================================

export type AgentResult<T> = Result<T, AgentError>;

// ============================================================================
// View Types
// ============================================================================

export type ViewType = "kanban" | "agent";
