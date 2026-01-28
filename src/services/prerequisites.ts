/**
 * Prerequisites Service
 * Verifies required tools are installed
 */

import type { PrerequisiteResult } from "@core/types/result";
import { ok, err, createPrerequisiteError } from "@core/types/result";
import { logPrerequisites } from "./logging";
import { executeGit } from "./commandExecutor";

// ============================================================================
// Individual Checks
// ============================================================================

/**
 * Check if git is installed
 */
async function checkGit(): Promise<PrerequisiteResult<void>> {
  logPrerequisites("debug", "Checking git installation");

  const result = await executeGit(["--version"]);

  if (result.ok && result.value.exitCode === 0) {
    logPrerequisites("debug", "Git found", { version: result.value.stdout.trim() });
    return ok(undefined);
  }

  // Check error type from CommandExecutor
  if (!result.ok && result.error.type === "not_installed") {
    return err(
      createPrerequisiteError(
        "git_not_installed",
        "Git is not installed",
        "Install git from https://git-scm.com"
      )
    );
  }

  // Generic failure
  const details = result.ok ? result.value.stderr : (result.error.details ?? result.error.message);
  return err(
    createPrerequisiteError(
      "git_not_installed",
      "Failed to check git installation",
      details
    )
  );
}

// ============================================================================
// Prerequisites Check
// ============================================================================

export interface PrerequisiteStatus {
  readonly git: boolean;
}

/**
 * Check all prerequisites for worktree operations
 * Returns detailed error if any prerequisite is missing
 */
export async function checkPrerequisites(): Promise<PrerequisiteResult<PrerequisiteStatus>> {
  logPrerequisites("info", "Checking prerequisites");

  const gitResult = await checkGit();

  const status: PrerequisiteStatus = {
    git: gitResult.ok,
  };

  if (!gitResult.ok) {
    logPrerequisites("error", "Git not installed");
    return err(
      createPrerequisiteError(
        "git_not_installed",
        gitResult.error.message,
        gitResult.error.details
      )
    );
  }

  logPrerequisites("info", "All prerequisites satisfied", { ...status });
  return ok(status);
}

/**
 * Quick check if all prerequisites are available (without detailed errors)
 */
export async function hasAllPrerequisites(): Promise<boolean> {
  const result = await checkPrerequisites();
  return result.ok;
}
