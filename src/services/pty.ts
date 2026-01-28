/**
 * PTY Service
 * TypeScript wrapper for the Rust PTY commands
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PtyOptions, PtyHandle, AgentResult } from "@core/types";
import { ok, err, createAgentError } from "@core/types";
import { logWorktree } from "./logging";

// Event payload types from Rust
interface PtyDataEvent {
  id: number;
  data: string;
}

interface PtyExitEvent {
  id: number;
  code: number | null;
}

/**
 * Spawn a new PTY process
 */
export async function spawnPty(options: PtyOptions): Promise<AgentResult<PtyHandle>> {
  try {
    logWorktree("debug", "Spawning PTY", {
      cmd: options.cmd,
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
    });

    const id = await invoke<number>("spawn_pty", {
      options: {
        cmd: options.cmd,
        args: [...options.args],
        cwd: options.cwd,
        cols: options.cols,
        rows: options.rows,
        env: options.env ? { ...options.env } : {},
      },
    });

    logWorktree("info", "PTY spawned", { id, cmd: options.cmd });

    // Set up event listeners
    const dataListeners: Array<(data: string) => void> = [];
    const exitListeners: Array<(code: number | null) => void> = [];
    let dataUnlisten: UnlistenFn | null = null;
    let exitUnlisten: UnlistenFn | null = null;

    // Listen for data events
    dataUnlisten = await listen<PtyDataEvent>("pty-data", (event) => {
      if (event.payload.id === id) {
        for (const listener of dataListeners) {
          listener(event.payload.data);
        }
      }
    });

    // Listen for exit events
    exitUnlisten = await listen<PtyExitEvent>("pty-exit", (event) => {
      if (event.payload.id === id) {
        for (const listener of exitListeners) {
          listener(event.payload.code);
        }
        // Clean up listeners on exit
        cleanup();
      }
    });

    const cleanup = () => {
      if (dataUnlisten) {
        dataUnlisten();
        dataUnlisten = null;
      }
      if (exitUnlisten) {
        exitUnlisten();
        exitUnlisten = null;
      }
    };

    const handle: PtyHandle = {
      id,

      async write(data: string) {
        await invoke("write_pty", { id, data });
      },

      async resize(cols: number, rows: number) {
        await invoke("resize_pty", { id, cols, rows });
      },

      async kill() {
        logWorktree("info", "Killing PTY", { id });
        await invoke("kill_pty", { id });
        cleanup();
      },

      onData(callback: (data: string) => void) {
        dataListeners.push(callback);
        return () => {
          const index = dataListeners.indexOf(callback);
          if (index > -1) {
            dataListeners.splice(index, 1);
          }
        };
      },

      onExit(callback: (code: number | null) => void) {
        exitListeners.push(callback);
        return () => {
          const index = exitListeners.indexOf(callback);
          if (index > -1) {
            exitListeners.splice(index, 1);
          }
        };
      },
    };

    return ok(handle);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWorktree("error", "Failed to spawn PTY", { error: message });

    // Check for specific errors
    if (message.includes("command not found") || message.includes("No such file")) {
      return err(
        createAgentError(
          "claude_not_installed",
          "Claude CLI not found. Please install it first.",
          message
        )
      );
    }

    return err(createAgentError("spawn_failed", "Failed to spawn PTY process", message));
  }
}

/**
 * Get list of active PTY session IDs
 */
export async function listPtySessions(): Promise<number[]> {
  try {
    return await invoke<number[]>("list_pty_sessions");
  } catch {
    return [];
  }
}
