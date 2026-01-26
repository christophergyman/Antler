/**
 * Devcontainer Service
 * Manages devcontainer lifecycle and port allocation
 */

import { Command } from "@tauri-apps/plugin-shell";
import { exists, readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import type { DevcontainerResult } from "@core/types/result";
import { ok, err, createDevcontainerError } from "@core/types/result";
import { logDevcontainer } from "./logging";
import { executeDocker, executeDevcontainer, type CommandResult } from "./commandExecutor";

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for devcontainer commands (5 minutes for build) */
const DEFAULT_TIMEOUT_MS = 300000;

/** Base port for devcontainer allocation */
const BASE_PORT = 3000;

/** Maximum port for devcontainer allocation */
const MAX_PORT = 3100;

/** Devcontainer config paths to check (in order of priority) */
const CONFIG_PATHS = ["devcontainer.json", ".devcontainer/devcontainer.json"];

// ============================================================================
// CLI Checks
// ============================================================================

/**
 * Check if devcontainer CLI is installed
 */
export async function checkDevcontainerCli(): Promise<DevcontainerResult<void>> {
  logDevcontainer("debug", "Checking devcontainer CLI installation");

  const result = await executeDevcontainer(["--version"]);

  if (result.ok && result.value.exitCode === 0) {
    logDevcontainer("debug", "Devcontainer CLI found", { version: result.value.stdout.trim() });
    return ok(undefined);
  }

  const errorDetails = result.ok ? result.value.stderr : result.error.details;
  const isNotInstalled = errorDetails?.includes("ENOENT") || errorDetails?.includes("not found") ||
    (result.ok === false && result.error.type === "not_installed");

  if (isNotInstalled) {
    return err(
      createDevcontainerError(
        "devcontainer_not_installed",
        "Devcontainer CLI is not installed",
        "Install with: npm install -g @devcontainers/cli"
      )
    );
  }

  return err(
    createDevcontainerError(
      "devcontainer_not_installed",
      "Failed to check devcontainer CLI",
      errorDetails ?? "Unknown error"
    )
  );
}

/**
 * Check if Docker daemon is running
 */
export async function checkDockerRunning(): Promise<DevcontainerResult<void>> {
  logDevcontainer("debug", "Checking Docker daemon");

  const result = await executeDocker(["info"]);

  if (result.ok && result.value.exitCode === 0) {
    logDevcontainer("debug", "Docker daemon is running");
    return ok(undefined);
  }

  const stderr = result.ok ? result.value.stderr : (result.error.details ?? "");
  const isNotInstalled = stderr.includes("ENOENT") || stderr.includes("not found") ||
    (result.ok === false && result.error.type === "not_installed");

  if (isNotInstalled) {
    return err(
      createDevcontainerError(
        "docker_not_running",
        "Docker is not installed",
        "Install Docker from https://docker.com"
      )
    );
  }

  if (stderr.includes("Cannot connect") || stderr.includes("Is the docker daemon running")) {
    return err(
      createDevcontainerError(
        "docker_not_running",
        "Docker daemon is not running",
        "Start Docker Desktop or the Docker daemon"
      )
    );
  }

  return err(
    createDevcontainerError(
      "docker_not_running",
      "Docker check failed",
      stderr.trim() || "Unknown error"
    )
  );
}

// ============================================================================
// Config Management
// ============================================================================

/**
 * Get the path where devcontainer config exists or should be created
 * Returns the first existing config path, or the root path if none exists
 */
export async function getDevcontainerConfigPath(workspacePath: string): Promise<string> {
  for (const relativePath of CONFIG_PATHS) {
    const fullPath = `${workspacePath}/${relativePath}`;
    try {
      if (await exists(fullPath)) {
        return fullPath;
      }
    } catch {
      // Continue checking other paths
    }
  }
  // Default to root devcontainer.json if none exists
  return `${workspacePath}/${CONFIG_PATHS[0]}`;
}

/**
 * Check if workspace has a devcontainer configuration
 */
export async function hasDevcontainerConfig(workspacePath: string): Promise<boolean> {
  for (const relativePath of CONFIG_PATHS) {
    const fullPath = `${workspacePath}/${relativePath}`;
    try {
      if (await exists(fullPath)) {
        return true;
      }
    } catch {
      // Continue checking other paths
    }
  }
  return false;
}

/**
 * Read devcontainer config content
 */
export async function readDevcontainerConfig(workspacePath: string): Promise<DevcontainerResult<string>> {
  logDevcontainer("debug", "Reading devcontainer config", { workspacePath });

  try {
    const configPath = await getDevcontainerConfigPath(workspacePath);

    // Check if the file exists
    if (!(await exists(configPath))) {
      return err(
        createDevcontainerError(
          "no_devcontainer_config",
          "No devcontainer.json found",
          `Checked paths: ${CONFIG_PATHS.join(", ")}`
        )
      );
    }

    const content = await readTextFile(configPath);
    logDevcontainer("debug", "Devcontainer config read successfully", { configPath });
    return ok(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDevcontainer("error", "Failed to read devcontainer config", { error: message });
    return err(
      createDevcontainerError(
        "no_devcontainer_config",
        "Failed to read devcontainer config",
        message
      )
    );
  }
}

/**
 * Save devcontainer config content
 */
export async function saveDevcontainerConfig(
  workspacePath: string,
  content: string
): Promise<DevcontainerResult<void>> {
  logDevcontainer("info", "Saving devcontainer config", { workspacePath });

  try {
    // Always save to root devcontainer.json for new configs
    const configPath = `${workspacePath}/${CONFIG_PATHS[0]}`;

    // Check if we need to update an existing config in .devcontainer/
    const existingPath = await getDevcontainerConfigPath(workspacePath);
    const targetPath = (await exists(existingPath)) ? existingPath : configPath;

    // Create parent directory if needed (for .devcontainer/)
    if (targetPath.includes(".devcontainer/")) {
      const dirPath = targetPath.substring(0, targetPath.lastIndexOf("/"));
      try {
        await mkdir(dirPath, { recursive: true });
      } catch {
        // Directory might already exist
      }
    }

    await writeTextFile(targetPath, content);
    logDevcontainer("info", "Devcontainer config saved successfully", { targetPath });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDevcontainer("error", "Failed to save devcontainer config", { error: message });
    return err(
      createDevcontainerError(
        "devcontainer_start_failed", // Reusing existing error code
        "Failed to save devcontainer config",
        message
      )
    );
  }
}

// ============================================================================
// Port Management
// ============================================================================

/**
 * Get list of ports currently in use by Docker containers
 */
export async function getUsedPorts(): Promise<DevcontainerResult<Set<number>>> {
  logDevcontainer("debug", "Getting used Docker ports");

  const result = await executeDocker(["ps", "--format", "{{.Ports}}"]);

  if (!result.ok || result.value.exitCode !== 0) {
    const errorDetails = result.ok ? result.value.stderr : (result.error.details ?? "Unknown error");
    logDevcontainer("warn", "Failed to get Docker ports", { error: errorDetails });
    // Return empty set on failure - we'll try to use ports anyway
    return ok(new Set<number>());
  }

  const usedPorts = new Set<number>();
  const lines = result.value.stdout.split("\n");

  for (const line of lines) {
    // Parse port mappings like "0.0.0.0:3000->3000/tcp" or "3000/tcp"
    const matches = line.matchAll(/(?:[\d.]+:)?(\d+)(?:->|\/)/g);
    for (const match of matches) {
      const portStr = match[1];
      if (portStr) {
        const port = parseInt(portStr, 10);
        if (!isNaN(port) && port >= 1 && port <= 65535) {
          usedPorts.add(port);
        }
      }
    }
  }

  logDevcontainer("debug", "Found used ports", { count: usedPorts.size, ports: Array.from(usedPorts) });
  return ok(usedPorts);
}

/**
 * Find an available port for a new devcontainer
 */
export async function findAvailablePort(): Promise<DevcontainerResult<number>> {
  const usedPortsResult = await getUsedPorts();

  if (!usedPortsResult.ok) {
    return usedPortsResult;
  }

  const usedPorts = usedPortsResult.value;

  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (!usedPorts.has(port)) {
      logDevcontainer("debug", "Found available port", { port });
      return ok(port);
    }
  }

  return err(
    createDevcontainerError(
      "no_available_ports",
      "No available ports in range",
      `All ports ${BASE_PORT}-${MAX_PORT} are in use. Stop some containers first.`
    )
  );
}

// ============================================================================
// Devcontainer Lifecycle
// ============================================================================

export interface DevcontainerInfo {
  readonly containerId: string;
  readonly port: number;
}

/**
 * Start a devcontainer for the given workspace
 */
export async function startDevcontainer(
  workspacePath: string,
  port: number,
  signal?: AbortSignal
): Promise<DevcontainerResult<DevcontainerInfo>> {
  logDevcontainer("info", "Starting devcontainer", { workspacePath, port });

  // Check for cancellation
  if (signal?.aborted) {
    return err(createDevcontainerError("devcontainer_start_failed", "Operation cancelled"));
  }

  // Check if devcontainer config exists
  const hasConfig = await hasDevcontainerConfig(workspacePath);
  if (!hasConfig) {
    return err(
      createDevcontainerError(
        "no_devcontainer_config",
        "No devcontainer.json found",
        `Expected config at ${workspacePath}/devcontainer.json or ${workspacePath}/.devcontainer/devcontainer.json`
      )
    );
  }

  const command = Command.create("run-devcontainer", [
    "up",
    "--workspace-folder",
    workspacePath,
    "--remote-env",
    `PORT=${port}`,
  ]);

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let child: Awaited<ReturnType<typeof command.spawn>> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Handle abort signal
  const abortHandler = () => {
    logDevcontainer("info", "Aborting devcontainer start");
    child?.kill();
  };

  try {
    command.stdout.on("data", (data) => {
      stdout += data;
    });
    command.stderr.on("data", (data) => {
      stderr += data;
    });

    const exitPromise = new Promise<number | null>((resolve) => {
      command.on("close", (data) => resolve(data.code));
      command.on("error", () => resolve(null));
    });

    child = await command.spawn();

    signal?.addEventListener("abort", abortHandler);

    timeoutId = setTimeout(() => {
      timedOut = true;
      child?.kill();
    }, DEFAULT_TIMEOUT_MS);

    const status = await exitPromise;

    if (signal?.aborted) {
      return err(createDevcontainerError("devcontainer_start_failed", "Operation cancelled"));
    }

    if (timedOut) {
      return err(
        createDevcontainerError(
          "devcontainer_start_failed",
          "Devcontainer start timed out",
          `Operation exceeded ${DEFAULT_TIMEOUT_MS / 1000} seconds`
        )
      );
    }

    if (status !== 0) {
      logDevcontainer("error", "Devcontainer start failed", { exitCode: status, stderr });
      return err(
        createDevcontainerError(
          "devcontainer_start_failed",
          "Failed to start devcontainer",
          stderr.trim() || stdout.trim()
        )
      );
    }

    // Try to extract container ID from output
    // devcontainer up outputs JSON with containerId
    let containerId = "unknown";
    try {
      // Look for JSON output
      const jsonMatch = stdout.match(/\{[^}]*"containerId"\s*:\s*"([^"]+)"[^}]*\}/);
      if (jsonMatch && jsonMatch[1]) {
        containerId = jsonMatch[1];
      }
    } catch {
      // Ignore parsing errors
    }

    logDevcontainer("info", "Devcontainer started successfully", { containerId, port });
    return ok({ containerId, port });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDevcontainer("error", "Failed to start devcontainer", { error: message });
    return err(
      createDevcontainerError(
        "devcontainer_start_failed",
        "Failed to start devcontainer",
        message
      )
    );
  } finally {
    // Ensure cleanup of timeout and abort handler
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener("abort", abortHandler);
    // Kill child process if still running (belt and suspenders)
    try {
      child?.kill();
    } catch {
      // Process may already be dead
    }
  }
}

/**
 * Stop a devcontainer for the given workspace
 * Uses docker commands to stop containers associated with the workspace
 *
 * Stops all containers in parallel using Promise.allSettled to ensure
 * all containers are attempted even if some fail.
 */
export async function stopDevcontainer(
  workspacePath: string
): Promise<DevcontainerResult<void>> {
  logDevcontainer("info", "Stopping devcontainer", { workspacePath });

  try {
    // List containers with the workspace label
    const listResult = await executeDocker([
      "ps",
      "-q",
      "--filter",
      `label=devcontainer.local_folder=${workspacePath}`,
    ]);

    // Handle command execution failure
    if (!listResult.ok) {
      logDevcontainer("warn", "Failed to list containers", { error: listResult.error.message });
      // Return success - no containers to stop if we can't list them
      return ok(undefined);
    }

    if (listResult.value.exitCode !== 0 || !listResult.value.stdout.trim()) {
      // No containers found - that's okay
      logDevcontainer("debug", "No devcontainer found to stop", { workspacePath });
      return ok(undefined);
    }

    const containerIds = listResult.value.stdout.trim().split("\n").filter(Boolean);

    // Stop all containers in parallel, collecting results
    const stopPromises = containerIds.map(async (containerId) => {
      logDevcontainer("debug", "Stopping container", { containerId });
      const result = await executeDocker(["stop", containerId]);
      return { containerId, result };
    });

    const results = await Promise.allSettled(stopPromises);

    // Collect failures
    const failures: string[] = [];
    for (const result of results) {
      if (result.status === "rejected") {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failures.push(reason);
        logDevcontainer("warn", "Container stop promise rejected", { error: reason });
      } else if (!result.value.result.ok) {
        // executeDocker returned an error
        const errorMsg = result.value.result.error.message;
        failures.push(`Container ${result.value.containerId}: ${errorMsg}`);
        logDevcontainer("warn", "Container stop failed", {
          containerId: result.value.containerId,
          error: errorMsg,
        });
      } else if (result.value.result.value.exitCode !== 0) {
        const stderr = result.value.result.value.stderr.trim();
        failures.push(`Container ${result.value.containerId}: ${stderr}`);
        logDevcontainer("warn", "Container stop failed", {
          containerId: result.value.containerId,
          exitCode: result.value.result.value.exitCode,
          stderr,
        });
      }
    }

    // Report partial failures but still return success if at least some stopped
    if (failures.length > 0 && failures.length === containerIds.length) {
      // All containers failed to stop
      logDevcontainer("error", "All containers failed to stop", { failures });
      return err(
        createDevcontainerError(
          "devcontainer_stop_failed",
          "Failed to stop all containers",
          failures.join("; ")
        )
      );
    } else if (failures.length > 0) {
      // Some containers failed, but others succeeded - log warning and continue
      logDevcontainer("warn", "Some containers failed to stop", {
        workspacePath,
        failedCount: failures.length,
        totalCount: containerIds.length,
        failures,
      });
    }

    logDevcontainer("info", "Devcontainer stopped successfully", { workspacePath });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDevcontainer("error", "Failed to stop devcontainer", { error: message });
    return err(
      createDevcontainerError(
        "devcontainer_stop_failed",
        "Failed to stop devcontainer",
        message
      )
    );
  }
}
