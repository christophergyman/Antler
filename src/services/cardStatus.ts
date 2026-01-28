/**
 * Card Status Persistence Service
 * Persists card statuses to app data directory for session restoration
 */

import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { CardStatus } from "@core/types/card";
import { logDataSync } from "./logging";

// ============================================================================
// Constants
// ============================================================================

const STATUS_FILENAME = "card-status.json";

// Valid statuses that can be persisted (excludes "idle" as that's the default)
const PERSISTABLE_STATUSES: readonly CardStatus[] = ["in_progress", "waiting", "done"];

// ============================================================================
// Types
// ============================================================================

interface CardStatusData {
  readonly byIssueNumber: Record<string, CardStatus>;
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Load all persisted card statuses from app data directory
 */
export async function loadCardStatuses(): Promise<Record<number, CardStatus>> {
  try {
    const fileExists = await exists(STATUS_FILENAME, { baseDir: BaseDirectory.AppData });

    if (!fileExists) {
      logDataSync("debug", "Card status file does not exist, returning empty");
      return {};
    }

    const content = await readTextFile(STATUS_FILENAME, { baseDir: BaseDirectory.AppData });
    const data: unknown = JSON.parse(content);

    if (!isValidStatusData(data)) {
      logDataSync("warn", "Invalid card status file format, returning empty");
      return {};
    }

    // Convert string keys back to numbers
    const result: Record<number, CardStatus> = {};
    for (const [key, status] of Object.entries(data.byIssueNumber)) {
      const issueNumber = parseInt(key, 10);
      if (!isNaN(issueNumber) && isValidStatus(status)) {
        result[issueNumber] = status;
      }
    }

    logDataSync("debug", "Loaded card statuses", { count: Object.keys(result).length });
    return result;
  } catch (error) {
    logDataSync("warn", "Failed to load card statuses", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/**
 * Save a card's status to persistent storage
 * Only persists non-idle statuses (idle is the default)
 */
export async function saveCardStatus(issueNumber: number, status: CardStatus): Promise<void> {
  if (status === "idle") {
    // Remove instead of saving idle status
    await removeCardStatus(issueNumber);
    return;
  }

  logDataSync("debug", "Saving card status", { issueNumber, status });

  try {
    // Load existing statuses
    const statuses = await loadCardStatuses();

    // Update with new status
    statuses[issueNumber] = status;

    // Save back to file
    await saveStatusFile(statuses);

    logDataSync("info", "Card status saved", { issueNumber, status });
  } catch (error) {
    logDataSync("error", "Failed to save card status", {
      issueNumber,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Remove a card's status from persistent storage
 * Called when a card returns to idle state (worktree removed)
 */
export async function removeCardStatus(issueNumber: number): Promise<void> {
  logDataSync("debug", "Removing card status", { issueNumber });

  try {
    // Load existing statuses
    const statuses = await loadCardStatuses();

    // Remove the entry if it exists
    if (!(issueNumber in statuses)) {
      logDataSync("debug", "Card status not found, nothing to remove", { issueNumber });
      return;
    }

    delete statuses[issueNumber];

    // Save back to file
    await saveStatusFile(statuses);

    logDataSync("info", "Card status removed", { issueNumber });
  } catch (error) {
    logDataSync("error", "Failed to remove card status", {
      issueNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get a single card's persisted status
 */
export async function getCardStatus(issueNumber: number): Promise<CardStatus | null> {
  const statuses = await loadCardStatuses();
  return statuses[issueNumber] ?? null;
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function saveStatusFile(statuses: Record<number, CardStatus>): Promise<void> {
  // Ensure AppData directory exists
  await mkdir("", { recursive: true, baseDir: BaseDirectory.AppData });

  // Build data structure
  const data: CardStatusData = {
    byIssueNumber: Object.fromEntries(
      Object.entries(statuses).map(([key, value]) => [key, value])
    ),
  };

  const content = JSON.stringify(data, null, 2);
  await writeTextFile(STATUS_FILENAME, content, { baseDir: BaseDirectory.AppData });
}

function isValidStatusData(data: unknown): data is CardStatusData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.byIssueNumber || typeof d.byIssueNumber !== "object") return false;
  return true;
}

function isValidStatus(status: unknown): status is CardStatus {
  return (
    typeof status === "string" &&
    (PERSISTABLE_STATUSES as readonly string[]).includes(status)
  );
}
