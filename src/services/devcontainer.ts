/**
 * Devcontainer Service
 * Manages devcontainer lifecycle and port allocation
 */

import { Command } from "@tauri-apps/plugin-shell";
import { exists, readTextFile, writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import type { DevcontainerResult } from "@core/types/result";
import { ok, err, createDevcontainerError } from "@core/types/result";
import { logDevcontainer } from "./logging";

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

  try {
    const command = Command.create("run-devcontainer", ["--version"]);
    const output = await command.execute();

    if (output.code === 0) {
      logDevcontainer("debug", "Devcontainer CLI found", { version: output.stdout.trim() });
      return ok(undefined);
    }

    return err(
      createDevcontainerError(
        "devcontainer_not_installed",
        "Devcontainer CLI not found",
        "Install with: npm install -g @devcontainers/cli"
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("ENOENT") || message.includes("not found")) {
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
        message
      )
    );
  }
}

/**
 * Check if Docker daemon is running
 */
export async function checkDockerRunning(): Promise<DevcontainerResult<void>> {
  logDevcontainer("debug", "Checking Docker daemon");

  try {
    const command = Command.create("run-docker", ["info"]);
    const output = await command.execute();

    if (output.code === 0) {
      logDevcontainer("debug", "Docker daemon is running");
      return ok(undefined);
    }

    if (output.stderr.includes("Cannot connect") || output.stderr.includes("Is the docker daemon running")) {
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
        output.stderr.trim()
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("ENOENT") || message.includes("not found")) {
      return err(
        createDevcontainerError(
          "docker_not_running",
          "Docker is not installed",
          "Install Docker from https://docker.com"
        )
      );
    }

    return err(
      createDevcontainerError(
        "docker_not_running",
        "Failed to check Docker status",
        message
      )
    );
  }
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

  try {
    const command = Command.create("run-docker", ["ps", "--format", "{{.Ports}}"]);
    const output = await command.execute();

    if (output.code !== 0) {
      logDevcontainer("warn", "Failed to get Docker ports", { stderr: output.stderr });
      // Return empty set on failure - we'll try to use ports anyway
      return ok(new Set<number>());
    }

    const usedPorts = new Set<number>();
    const lines = output.stdout.split("\n");

    for (const line of lines) {
      // Parse port mappings like "0.0.0.0:3000->3000/tcp" or "3000/tcp"
      const matches = line.matchAll(/(?:[\d.]+:)?(\d+)(?:->|\/)/g);
      for (const match of matches) {
        const portStr = match[1];
        if (portStr) {
          const port = parseInt(portStr, 10);
          if (!isNaN(port)) {
            usedPorts.add(port);
          }
        }
      }
    }

    logDevcontainer("debug", "Found used ports", { count: usedPorts.size, ports: Array.from(usedPorts) });
    return ok(usedPorts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDevcontainer("warn", "Failed to get used ports", { error: message });
    // Return empty set on error - we'll try to use ports anyway
    return ok(new Set<number>());
  }
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

  try {
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

    // Handle abort signal
    const abortHandler = () => {
      logDevcontainer("info", "Aborting devcontainer start");
      child?.kill();
    };
    signal?.addEventListener("abort", abortHandler);

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child?.kill();
    }, DEFAULT_TIMEOUT_MS);

    const status = await exitPromise;
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortHandler);

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
  }
}

/**
 * Stop a devcontainer for the given workspace
 * Uses docker commands to stop containers associated with the workspace
 */
export async function stopDevcontainer(
  workspacePath: string
): Promise<DevcontainerResult<void>> {
  logDevcontainer("info", "Stopping devcontainer", { workspacePath });

  try {
    // List containers with the workspace label
    const listCommand = Command.create("run-docker", [
      "ps",
      "-q",
      "--filter",
      `label=devcontainer.local_folder=${workspacePath}`,
    ]);

    const listOutput = await listCommand.execute();

    if (listOutput.code !== 0 || !listOutput.stdout.trim()) {
      // No containers found - that's okay
      logDevcontainer("debug", "No devcontainer found to stop", { workspacePath });
      return ok(undefined);
    }

    const containerIds = listOutput.stdout.trim().split("\n").filter(Boolean);

    for (const containerId of containerIds) {
      logDevcontainer("debug", "Stopping container", { containerId });
      const stopCommand = Command.create("run-docker", ["stop", containerId]);
      await stopCommand.execute();
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
