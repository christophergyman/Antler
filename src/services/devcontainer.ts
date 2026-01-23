/**
 * Devcontainer Service
 * Manages devcontainer lifecycle and port allocation
 */

import { Command } from "@tauri-apps/plugin-shell";
import { exists } from "@tauri-apps/plugin-fs";
import type { DevcontainerResult } from "@core/types/result";
import { ok, err, createDevcontainerError } from "@core/types/result";
import { logDataSync } from "./logging";

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for devcontainer commands (5 minutes for build) */
const DEFAULT_TIMEOUT_MS = 300000;

/** Base port for devcontainer allocation */
const BASE_PORT = 3000;

/** Maximum port for devcontainer allocation */
const MAX_PORT = 3100;

/** Devcontainer config path relative to workspace */
const DEVCONTAINER_CONFIG_PATH = ".devcontainer/devcontainer.json";

// ============================================================================
// CLI Checks
// ============================================================================

/**
 * Check if devcontainer CLI is installed
 */
export async function checkDevcontainerCli(): Promise<DevcontainerResult<void>> {
  logDataSync("debug", "Checking devcontainer CLI installation");

  try {
    const command = Command.create("run-devcontainer", ["--version"]);
    const output = await command.execute();

    if (output.code === 0) {
      logDataSync("debug", "Devcontainer CLI found", { version: output.stdout.trim() });
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
  logDataSync("debug", "Checking Docker daemon");

  try {
    const command = Command.create("run-docker", ["info"]);
    const output = await command.execute();

    if (output.code === 0) {
      logDataSync("debug", "Docker daemon is running");
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
// Config Check
// ============================================================================

/**
 * Check if workspace has a devcontainer configuration
 */
export async function hasDevcontainerConfig(workspacePath: string): Promise<boolean> {
  const configPath = `${workspacePath}/${DEVCONTAINER_CONFIG_PATH}`;
  try {
    return await exists(configPath);
  } catch {
    return false;
  }
}

// ============================================================================
// Port Management
// ============================================================================

/**
 * Get list of ports currently in use by Docker containers
 */
export async function getUsedPorts(): Promise<DevcontainerResult<Set<number>>> {
  logDataSync("debug", "Getting used Docker ports");

  try {
    const command = Command.create("run-docker", ["ps", "--format", "{{.Ports}}"]);
    const output = await command.execute();

    if (output.code !== 0) {
      logDataSync("warn", "Failed to get Docker ports", { stderr: output.stderr });
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

    logDataSync("debug", "Found used ports", { count: usedPorts.size, ports: Array.from(usedPorts) });
    return ok(usedPorts);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDataSync("warn", "Failed to get used ports", { error: message });
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
      logDataSync("debug", "Found available port", { port });
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
  logDataSync("info", "Starting devcontainer", { workspacePath, port });

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
        `Expected config at ${workspacePath}/${DEVCONTAINER_CONFIG_PATH}`
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
      logDataSync("info", "Aborting devcontainer start");
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
      logDataSync("error", "Devcontainer start failed", { exitCode: status, stderr });
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

    logDataSync("info", "Devcontainer started successfully", { containerId, port });
    return ok({ containerId, port });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDataSync("error", "Failed to start devcontainer", { error: message });
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
  logDataSync("info", "Stopping devcontainer", { workspacePath });

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
      logDataSync("debug", "No devcontainer found to stop", { workspacePath });
      return ok(undefined);
    }

    const containerIds = listOutput.stdout.trim().split("\n").filter(Boolean);

    for (const containerId of containerIds) {
      logDataSync("debug", "Stopping container", { containerId });
      const stopCommand = Command.create("run-docker", ["stop", containerId]);
      await stopCommand.execute();
    }

    logDataSync("info", "Devcontainer stopped successfully", { workspacePath });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDataSync("error", "Failed to stop devcontainer", { error: message });
    return err(
      createDevcontainerError(
        "devcontainer_stop_failed",
        "Failed to stop devcontainer",
        message
      )
    );
  }
}
