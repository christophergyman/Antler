/**
 * Port Allocation Service
 * Manages unique port assignments for worktrees
 */

import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { listWorktrees } from "./worktree";
import { logWorktree } from "./logging";

// ============================================================================
// Constants
// ============================================================================

const BASE_PORT = 3000;
const MAX_PORT = 3999;
const PORT_FILENAME = ".port";

// ============================================================================
// Port Management
// ============================================================================

/**
 * Get all ports currently in use by worktrees
 */
export async function getUsedPorts(repoRoot: string): Promise<number[]> {
  const result = await listWorktrees();
  if (!result.ok) {
    logWorktree("warn", "Failed to list worktrees for port check", {
      error: result.error.message,
    });
    return [];
  }

  const ports: number[] = [];

  for (const worktree of result.value) {
    // Only check worktrees in our .worktrees directory
    if (!worktree.path.includes(".worktrees/")) {
      continue;
    }

    try {
      const portFile = await join(worktree.path, PORT_FILENAME);
      const fileExists = await exists(portFile);

      if (fileExists) {
        const content = await readTextFile(portFile);
        const port = parseInt(content.trim(), 10);
        if (!isNaN(port)) {
          ports.push(port);
        }
      }
    } catch (error) {
      // Skip worktrees where we can't read the port file
      logWorktree("debug", "Could not read port file for worktree", {
        path: worktree.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return ports;
}

/**
 * Allocate the next available port for a worktree
 * Writes the port to a .port file in the worktree directory
 */
export async function allocatePort(repoRoot: string, worktreePath: string): Promise<number> {
  const usedPorts = new Set(await getUsedPorts(repoRoot));

  logWorktree("debug", "Finding available port", {
    usedPorts: Array.from(usedPorts),
    range: `${BASE_PORT}-${MAX_PORT}`,
  });

  // Find first available port
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (!usedPorts.has(port)) {
      // Write port to file in worktree
      const portFile = await join(worktreePath, PORT_FILENAME);
      await writeTextFile(portFile, String(port));

      logWorktree("info", "Port allocated", { port, worktreePath });
      return port;
    }
  }

  throw new Error(`No available ports in range ${BASE_PORT}-${MAX_PORT}`);
}

/**
 * Read the port assigned to a worktree
 */
export async function getWorktreePort(worktreePath: string): Promise<number | null> {
  try {
    const portFile = await join(worktreePath, PORT_FILENAME);
    const fileExists = await exists(portFile);

    if (!fileExists) {
      return null;
    }

    const content = await readTextFile(portFile);
    const port = parseInt(content.trim(), 10);
    return isNaN(port) ? null : port;
  } catch {
    return null;
  }
}

/**
 * Build command with PORT environment variable
 * e.g., "bun run dev" -> "PORT=3000 bun run dev"
 */
export function buildCommandWithPort(command: string, port: number): string {
  return `PORT=${port} ${command}`;
}
