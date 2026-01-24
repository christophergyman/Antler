/**
 * Logging Service
 * Three-layer logging: console (dev), user activity tracking (DevTools), file persistence
 */

import { writeTextFile, mkdir, readDir, remove, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { LogLevel, LogCategory, LogEntry, UserActionType } from "@core/types/log";
import { createLogEntry, getSessionId } from "@core/types/log";
import type { CardStatus } from "@core/types/card";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Console log level - show all logs in development */
  consoleLevel: "debug" as LogLevel,
  /** Maximum number of log files to keep */
  maxLogFiles: 5,
  /** Log file prefix */
  filePrefix: "antler-",
  /** Logs subdirectory name */
  logsDir: "logs",
} as const;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// Console Colors (CSS for browser DevTools)
// ============================================================================

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: "color: #06b6d4", // cyan
  info: "color: #22c55e", // green
  warn: "color: #f59e0b", // amber
  error: "color: #ef4444", // red
};

const CATEGORY_STYLE = "color: #a855f7"; // purple
const DIM_STYLE = "color: #6b7280"; // gray
const RESET_STYLE = "color: inherit";

// ============================================================================
// State
// ============================================================================

let isInitialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the logger - creates logs directory
 */
export async function initLogger(): Promise<void> {
  if (isInitialized) return;

  try {
    // Ensure logs directory exists using BaseDirectory.AppData
    await mkdir(CONFIG.logsDir, { recursive: true, baseDir: BaseDirectory.AppData });

    isInitialized = true;
    logSystem("info", "Logger initialized", { logsDir: CONFIG.logsDir, sessionId: getSessionId() });

    // Clean up old log files
    await rotateLogFiles();
  } catch (error) {
    console.error("Failed to initialize logger:", error);
    // Continue without file logging
    isInitialized = true;
  }
}

/**
 * Shutdown logger - flush any pending writes
 */
export async function shutdownLogger(): Promise<void> {
  if (!isInitialized) return;

  logSystem("info", "Logger shutting down");
  isInitialized = false;
}

// ============================================================================
// Log File Management
// ============================================================================

/**
 * Get today's log file path (relative to AppData)
 */
function getLogFilePath(): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${CONFIG.logsDir}/${CONFIG.filePrefix}${today}.log`;
}

/**
 * Rotate log files - keep only the most recent files
 */
async function rotateLogFiles(): Promise<void> {
  try {
    const entries = await readDir(CONFIG.logsDir, { baseDir: BaseDirectory.AppData });
    const logFiles = entries
      .filter((e) => e.name?.startsWith(CONFIG.filePrefix) && e.name?.endsWith(".log"))
      .map((e) => e.name!)
      .sort()
      .reverse();

    // Delete files beyond the max count
    const filesToDelete = logFiles.slice(CONFIG.maxLogFiles);
    for (const file of filesToDelete) {
      await remove(`${CONFIG.logsDir}/${file}`, { baseDir: BaseDirectory.AppData });
    }

    if (filesToDelete.length > 0) {
      console.log(`[logging] Rotated ${filesToDelete.length} old log files`);
    }
  } catch (error) {
    console.error("Failed to rotate log files:", error);
  }
}

// ============================================================================
// Core Logging Functions
// ============================================================================

/**
 * Format log entry for console output (with CSS styling for browser DevTools)
 * Returns [formatString, ...styleArgs] for use with console.log
 */
function formatConsole(entry: LogEntry): [string, ...string[]] {
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const categoryStr = `[${entry.category}]`.padEnd(14);
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

  const format = `%c${entry.timestamp} %c${levelStr} %c${categoryStr} %c${entry.message}%c${contextStr}`;

  return [
    format,
    DIM_STYLE,                    // timestamp
    LEVEL_STYLES[entry.level],    // level
    CATEGORY_STYLE,               // category
    RESET_STYLE,                  // message
    DIM_STYLE,                    // context
  ];
}

/**
 * Format log entry for file output (plain text)
 */
function formatFile(entry: LogEntry): string {
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const categoryStr = `[${entry.category}]`.padEnd(14);
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

  return `${entry.timestamp} ${levelStr} ${categoryStr} ${entry.message}${contextStr}`;
}

/**
 * Write log entry to file (immediate write mode)
 */
async function writeToFile(entry: LogEntry): Promise<void> {
  const filePath = getLogFilePath();

  try {
    const line = formatFile(entry) + "\n";
    await writeTextFile(filePath, line, { append: true, baseDir: BaseDirectory.AppData });
  } catch (error) {
    // Silently fail file writes to avoid infinite loops
    console.error("Failed to write log:", error);
  }
}

/**
 * Check if a log level should be output based on configured level
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CONFIG.consoleLevel];
}

/**
 * Core log function - handles console and file output
 */
function log(level: LogLevel, category: LogCategory, message: string, context?: Record<string, unknown>): void {
  const entry = createLogEntry(level, category, message, context);

  // Console output with CSS styling
  if (shouldLog(level)) {
    const [format, ...styles] = formatConsole(entry);
    switch (level) {
      case "error":
        console.error(format, ...styles);
        break;
      case "warn":
        console.warn(format, ...styles);
        break;
      default:
        console.log(format, ...styles);
    }
  }

  // File output (async, fire-and-forget)
  if (isInitialized) {
    writeToFile(entry);
  }
}

// ============================================================================
// Category-Specific Logging
// ============================================================================

/**
 * Log system-level events
 */
export function logSystem(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "system", message, context);
}

/**
 * Log config-related events
 */
export function logConfig(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "config", message, context);
}

/**
 * Log data sync events (GitHub, API calls)
 */
export function logDataSync(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "data_sync", message, context);
}

/**
 * Log performance metrics
 */
export function logPerformance(message: string, durationMs: number, context?: Record<string, unknown>): void {
  log("info", "performance", message, { ...context, durationMs });
}

/**
 * Log user actions
 */
export function logUserAction(action: UserActionType, message: string, context?: Record<string, unknown>): void {
  log("info", "user_action", message, { ...context, action });
}

/**
 * Log worktree operations
 */
export function logWorktree(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "worktree", message, context);
}

/**
 * Log devcontainer operations
 */
export function logDevcontainer(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "devcontainer", message, context);
}

/**
 * Log Docker runtime events
 */
export function logDocker(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "docker", message, context);
}

/**
 * Log prerequisites checks
 */
export function logPrerequisites(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  log(level, "prerequisites", message, context);
}

// ============================================================================
// Convenience Logging Functions
// ============================================================================

/**
 * Log card status change (user action convenience)
 */
export function logCardStatusChange(cardId: string, from: CardStatus, to: CardStatus): void {
  logUserAction("card_status_change", `Card moved from ${from} to ${to}`, { cardId, from, to });
}

/**
 * Log data refresh (convenience)
 */
export function logDataRefresh(source: "mock" | "github", count: number): void {
  logUserAction("data_refresh", `Data refreshed from ${source}`, { source, count });
}

// ============================================================================
// Quick Logging (shorthand methods)
// ============================================================================

export function debug(message: string, context?: Record<string, unknown>): void {
  logSystem("debug", message, context);
}

export function info(message: string, context?: Record<string, unknown>): void {
  logSystem("info", message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
  logSystem("warn", message, context);
}

export function error(message: string, context?: Record<string, unknown>): void {
  logSystem("error", message, context);
}
