/**
 * Prerequisites Service
 * Verifies required tools are installed and running
 */

import type { PrerequisiteResult } from "@core/types/result";
import { ok, err, createPrerequisiteError } from "@core/types/result";
import { checkDevcontainerCli, checkDockerRunning } from "./devcontainer";
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
  readonly devcontainer: boolean;
  readonly docker: boolean;
}

/**
 * Check all prerequisites for worktree + devcontainer operations
 * Returns detailed error if any prerequisite is missing
 */
export async function checkPrerequisites(): Promise<PrerequisiteResult<PrerequisiteStatus>> {
  logPrerequisites("info", "Checking prerequisites");

  // Check all in parallel
  const [gitResult, devcontainerResult, dockerResult] = await Promise.all([
    checkGit(),
    checkDevcontainerCli(),
    checkDockerRunning(),
  ]);

  const status: PrerequisiteStatus = {
    git: gitResult.ok,
    devcontainer: devcontainerResult.ok,
    docker: dockerResult.ok,
  };

  // Return first error encountered (in order of importance)
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

  if (!devcontainerResult.ok) {
    logPrerequisites("error", "Devcontainer CLI not installed");
    return err(
      createPrerequisiteError(
        "devcontainer_not_installed",
        devcontainerResult.error.message,
        devcontainerResult.error.details
      )
    );
  }

  if (!dockerResult.ok) {
    logPrerequisites("error", "Docker not running");

    // Distinguish between not installed and not running
    if (dockerResult.error.message.includes("not installed")) {
      return err(
        createPrerequisiteError(
          "docker_not_installed",
          dockerResult.error.message,
          dockerResult.error.details
        )
      );
    }

    return err(
      createPrerequisiteError(
        "docker_not_running",
        dockerResult.error.message,
        dockerResult.error.details
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
