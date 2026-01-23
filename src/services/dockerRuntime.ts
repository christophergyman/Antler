/**
 * Docker Runtime Service
 * Manages Docker runtime availability, auto-starting Colima on macOS
 */

import { platform } from "@tauri-apps/plugin-os";
import { Command } from "@tauri-apps/plugin-shell";
import { logDocker } from "./logging";

// ============================================================================
// Types
// ============================================================================

export type DockerRuntimeStatus =
  | "unknown"
  | "checking"
  | "starting"
  | "ready"
  | "failed";

// ============================================================================
// State
// ============================================================================

let status: DockerRuntimeStatus = "unknown";
let statusListeners: ((status: DockerRuntimeStatus) => void)[] = [];

// ============================================================================
// Status Management
// ============================================================================

export function getDockerRuntimeStatus(): DockerRuntimeStatus {
  return status;
}

export function onDockerRuntimeStatusChange(
  listener: (status: DockerRuntimeStatus) => void
): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

function setStatus(newStatus: DockerRuntimeStatus): void {
  status = newStatus;
  statusListeners.forEach((l) => l(newStatus));
}

// ============================================================================
// Docker Detection
// ============================================================================

async function isDockerRunning(): Promise<boolean> {
  try {
    const cmd = Command.create("run-docker", ["info"]);
    const output = await cmd.execute();
    return output.code === 0;
  } catch {
    return false;
  }
}

async function isColimaInstalled(): Promise<boolean> {
  try {
    const cmd = Command.create("run-colima", ["version"]);
    const output = await cmd.execute();
    return output.code === 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Ensures Docker runtime is available.
 * Call at app startup - runs in background, non-blocking.
 * On macOS, will auto-start Colima if Docker isn't running.
 */
export async function ensureDockerRuntime(): Promise<void> {
  setStatus("checking");

  // Check if Docker is already running
  if (await isDockerRunning()) {
    logDocker("info", "Docker runtime ready");
    setStatus("ready");
    return;
  }

  // On macOS, try to start Colima
  const currentPlatform = await platform();
  if (currentPlatform === "macos") {
    if (!(await isColimaInstalled())) {
      logDocker("warn", "Colima not installed - Docker not available");
      setStatus("failed");
      return;
    }

    setStatus("starting");
    logDocker("info", "Starting Colima in background");

    try {
      const command = Command.create("run-colima", ["start"]);
      const output = await command.execute();

      if (output.code === 0) {
        logDocker("info", "Colima started successfully");
        setStatus("ready");
      } else {
        logDocker("error", "Colima failed to start", { stderr: output.stderr });
        setStatus("failed");
      }
    } catch (error) {
      logDocker("error", "Colima start threw exception", {
        error: String(error),
      });
      setStatus("failed");
    }
  } else {
    // Non-macOS: Docker not running, can't auto-start
    logDocker("warn", "Docker not running on non-macOS platform");
    setStatus("failed");
  }
}
