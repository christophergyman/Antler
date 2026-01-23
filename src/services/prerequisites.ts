/**
 * Prerequisites Service
 * Verifies required tools are installed and running
 */

import { Command } from "@tauri-apps/plugin-shell";
import type { PrerequisiteResult } from "@core/types/result";
import { ok, err, createPrerequisiteError } from "@core/types/result";
import { checkDevcontainerCli, checkDockerRunning } from "./devcontainer";
import { logSystem } from "./logging";

// ============================================================================
// Individual Checks
// ============================================================================

/**
 * Check if git is installed
 */
async function checkGit(): Promise<PrerequisiteResult<void>> {
  logSystem("debug", "Checking git installation");

  try {
    const command = Command.create("run-git", ["--version"]);
    const output = await command.execute();

    if (output.code === 0) {
      logSystem("debug", "Git found", { version: output.stdout.trim() });
      return ok(undefined);
    }

    return err(
      createPrerequisiteError(
        "git_not_installed",
        "Git is not installed",
        "Install git from https://git-scm.com"
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("ENOENT") || message.includes("not found")) {
      return err(
        createPrerequisiteError(
          "git_not_installed",
          "Git is not installed",
          "Install git from https://git-scm.com"
        )
      );
    }

    return err(
      createPrerequisiteError(
        "git_not_installed",
        "Failed to check git installation",
        message
      )
    );
  }
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
  logSystem("info", "Checking prerequisites");

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
    logSystem("error", "Git not installed");
    return err(
      createPrerequisiteError(
        "git_not_installed",
        gitResult.error.message,
        gitResult.error.details
      )
    );
  }

  if (!devcontainerResult.ok) {
    logSystem("error", "Devcontainer CLI not installed");
    return err(
      createPrerequisiteError(
        "devcontainer_not_installed",
        devcontainerResult.error.message,
        devcontainerResult.error.details
      )
    );
  }

  if (!dockerResult.ok) {
    logSystem("error", "Docker not running");

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

  logSystem("info", "All prerequisites satisfied", { ...status });
  return ok(status);
}

/**
 * Quick check if all prerequisites are available (without detailed errors)
 */
export async function hasAllPrerequisites(): Promise<boolean> {
  const result = await checkPrerequisites();
  return result.ok;
}
