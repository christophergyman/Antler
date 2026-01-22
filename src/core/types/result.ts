/**
 * Result Types
 * Type-safe error handling for async operations
 */

// ============================================================================
// Generic Result Type
// ============================================================================

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================================================
// Config Errors
// ============================================================================

export type ConfigErrorCode = "config_not_found" | "config_invalid" | "config_parse_error";

export interface ConfigError {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly details?: string;
}

export function createConfigError(
  code: ConfigErrorCode,
  message: string,
  details?: string
): ConfigError {
  return Object.freeze({ code, message, details });
}

// ============================================================================
// GitHub Errors
// ============================================================================

export type GitHubErrorCode =
  | "gh_not_installed"
  | "not_authenticated"
  | "repo_not_found"
  | "network_error"
  | "parse_error"
  | "command_failed";

export interface GitHubError {
  readonly code: GitHubErrorCode;
  readonly message: string;
  readonly details?: string;
}

export function createGitHubError(
  code: GitHubErrorCode,
  message: string,
  details?: string
): GitHubError {
  return Object.freeze({ code, message, details });
}

// ============================================================================
// Type Aliases
// ============================================================================

export type ConfigResult<T> = Result<T, ConfigError>;
export type GitHubResult<T> = Result<T, GitHubError>;
