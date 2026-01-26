/**
 * Project Types
 * Type definitions for project selection and management
 */

import type { Result } from "./result";

// ============================================================================
// Project Settings
// ============================================================================

export interface ProjectSettings {
  readonly currentProject: string | null;
  readonly recentProjects: readonly string[];
}

// ============================================================================
// Project Info
// ============================================================================

export interface ProjectInfo {
  readonly path: string;
  readonly name: string;
  readonly isGitRepo: boolean;
}

// ============================================================================
// Project Errors
// ============================================================================

export type ProjectErrorCode =
  | "not_git_repo"
  | "path_not_found"
  | "read_failed"
  | "write_failed"
  | "clone_failed"
  | "dialog_cancelled"
  | "dialog_failed";

export interface ProjectError {
  readonly code: ProjectErrorCode;
  readonly message: string;
  readonly details?: string;
}

export function createProjectError(
  code: ProjectErrorCode,
  message: string,
  details?: string
): ProjectError {
  return Object.freeze({ code, message, details });
}

// ============================================================================
// Type Aliases
// ============================================================================

export type ProjectResult<T> = Result<T, ProjectError>;
