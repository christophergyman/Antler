/**
 * Command Executor Service
 * Unified pattern for CLI command execution with retry, timeout, and cleanup
 */

import { Command } from "@tauri-apps/plugin-shell";
import { logSystem } from "./logging";

// ============================================================================
// Types
// ============================================================================

/** Command execution result */
export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
}

/** Options for command execution */
export interface CommandOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Base delay between retries in ms (default: 1000) */
  retryDelayMs?: number;
  /** Maximum delay between retries in ms (default: 10000) */
  maxRetryDelayMs?: number;
  /** Function to determine if error is retryable (default: network/timeout errors) */
  isRetryable?: (result: CommandResult) => boolean;
  /** Log category for logging */
  logCategory?: string;
}

/** Error types that can be determined from command output */
export type CommandErrorType =
  | "command_failed"
  | "timeout"
  | "cancelled"
  | "not_installed"
  | "network_error"
  | "unknown";

/** Structured error from command execution */
export interface CommandError {
  readonly type: CommandErrorType;
  readonly message: string;
  readonly details?: string;
  readonly result?: CommandResult;
}

/** Result type for command execution */
export type ExecuteResult =
  | { ok: true; value: CommandResult }
  | { ok: false; error: CommandError };

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_DELAY_MS = 10000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter: +/- 25%
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  // Clamp to max delay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Default function to determine if an error is retryable
 * Retries on: timeout, network errors, connection errors
 */
function defaultIsRetryable(result: CommandResult): boolean {
  if (result.timedOut) {
    return true;
  }
  const stderr = result.stderr.toLowerCase();
  return (
    stderr.includes("network") ||
    stderr.includes("connect") ||
    stderr.includes("timed out") ||
    stderr.includes("temporary failure") ||
    stderr.includes("could not resolve")
  );
}

/**
 * Create a command preview for logging
 */
function createCommandPreview(commandName: string, args: string[], maxArgs = 4): string {
  const preview = `${commandName} ${args.slice(0, maxArgs).join(" ")}`;
  return args.length > maxArgs ? `${preview}...` : preview;
}

// ============================================================================
// Command Executor
// ============================================================================

/**
 * Execute a CLI command with proper cleanup, timeout, and optional retry logic
 *
 * @param commandName - The Tauri shell command identifier (e.g., "run-gh", "run-git")
 * @param args - Command arguments
 * @param options - Execution options
 */
export async function executeCommand(
  commandName: string,
  args: string[],
  options: CommandOptions = {}
): Promise<ExecuteResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    retries = 0,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    maxRetryDelayMs = DEFAULT_MAX_RETRY_DELAY_MS,
    isRetryable = defaultIsRetryable,
    logCategory = "system",
  } = options;

  const commandPreview = createCommandPreview(
    commandName.replace("run-", ""),
    args
  );

  let lastResult: CommandResult | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    // Check for cancellation before each attempt
    if (signal?.aborted) {
      logSystem("debug", `Command cancelled: ${commandPreview}`, { category: logCategory });
      return {
        ok: false,
        error: {
          type: "cancelled",
          message: "Operation cancelled",
        },
      };
    }

    if (attempt > 0) {
      const delay = calculateBackoff(attempt - 1, retryDelayMs, maxRetryDelayMs);
      logSystem("debug", `Retry attempt ${attempt}/${retries} after ${Math.round(delay)}ms: ${commandPreview}`, {
        category: logCategory,
      });
      await sleep(delay);

      // Check for cancellation after delay
      if (signal?.aborted) {
        return {
          ok: false,
          error: {
            type: "cancelled",
            message: "Operation cancelled",
          },
        };
      }
    }

    const result = await executeOnce(commandName, args, timeoutMs, signal, logCategory, commandPreview);
    lastResult = result;

    // Success
    if (result.exitCode === 0) {
      logSystem("debug", `Command succeeded: ${commandPreview}`, { category: logCategory });
      return { ok: true, value: result };
    }

    // Check if we should retry
    const shouldRetry = attempt < retries && isRetryable(result);
    if (!shouldRetry) {
      break;
    }

    attempt++;
  }

  // All attempts failed
  return createErrorResult(lastResult, commandPreview, logCategory);
}

/**
 * Execute a command once (no retries)
 */
async function executeOnce(
  commandName: string,
  args: string[],
  timeoutMs: number,
  signal: AbortSignal | undefined,
  logCategory: string,
  commandPreview: string
): Promise<CommandResult> {
  let child: Awaited<ReturnType<Command<string>["spawn"]>> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const command = Command.create(commandName, args);

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Set up listeners BEFORE spawning
    command.stdout.on("data", (data) => {
      stdout += data;
    });
    command.stderr.on("data", (data) => {
      stderr += data;
    });

    // Create exit promise
    const exitPromise = new Promise<number | null>((resolve) => {
      command.on("close", (data) => resolve(data.code));
      command.on("error", () => resolve(null));
    });

    // Spawn the process
    child = await command.spawn();

    // Set up abort handler
    const abortHandler = () => {
      logSystem("debug", `Aborting command: ${commandPreview}`, { category: logCategory });
      child?.kill();
    };
    signal?.addEventListener("abort", abortHandler);

    // Set up timeout
    timeoutId = setTimeout(() => {
      timedOut = true;
      logSystem("debug", `Command timed out after ${timeoutMs}ms: ${commandPreview}`, { category: logCategory });
      child?.kill();
    }, timeoutMs);

    // Wait for exit
    const exitCode = await exitPromise;

    // Clean up
    clearTimeout(timeoutId);
    timeoutId = null;
    signal?.removeEventListener("abort", abortHandler);

    return { stdout, stderr, exitCode, timedOut };
  } catch (error) {
    // Handle spawn errors
    const message = error instanceof Error ? error.message : String(error);
    return {
      stdout: "",
      stderr: message,
      exitCode: null,
      timedOut: false,
    };
  } finally {
    // Ensure cleanup
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    try {
      child?.kill();
    } catch {
      // Process may already be dead
    }
  }
}

/**
 * Create an error result from a command result
 */
function createErrorResult(
  result: CommandResult | null,
  commandPreview: string,
  logCategory: string
): ExecuteResult {
  if (!result) {
    logSystem("error", `Command failed with no result: ${commandPreview}`, { category: logCategory });
    return {
      ok: false,
      error: {
        type: "unknown",
        message: "Command failed with no result",
      },
    };
  }

  // Determine error type
  let type: CommandErrorType = "command_failed";
  let message = `Command failed with exit code ${result.exitCode}`;

  if (result.timedOut) {
    type = "timeout";
    message = "Command timed out";
  } else if (result.stderr.includes("ENOENT") || result.stderr.includes("not found")) {
    type = "not_installed";
    message = "Command not found";
  } else if (
    result.stderr.includes("network") ||
    result.stderr.includes("connect") ||
    result.stderr.includes("Could not resolve")
  ) {
    type = "network_error";
    message = "Network error";
  }

  logSystem("error", `${message}: ${commandPreview}`, {
    category: logCategory,
    exitCode: result.exitCode,
  });

  return {
    ok: false,
    error: {
      type,
      message,
      details: result.stderr.trim() || undefined,
      result,
    },
  };
}

// ============================================================================
// Specialized Executors
// ============================================================================

/**
 * Execute a gh CLI command
 */
export async function executeGh(
  args: string[],
  options: Omit<CommandOptions, "logCategory"> = {}
): Promise<ExecuteResult> {
  return executeCommand("run-gh", args, { ...options, logCategory: "data_sync" });
}

/**
 * Execute a git command
 */
export async function executeGit(
  args: string[],
  options: Omit<CommandOptions, "logCategory"> = {}
): Promise<ExecuteResult> {
  return executeCommand("run-git", args, { ...options, logCategory: "worktree" });
}

/**
 * Execute a docker command
 */
export async function executeDocker(
  args: string[],
  options: Omit<CommandOptions, "logCategory"> = {}
): Promise<ExecuteResult> {
  return executeCommand("run-docker", args, { ...options, logCategory: "docker" });
}

/**
 * Execute a devcontainer CLI command
 */
export async function executeDevcontainer(
  args: string[],
  options: Omit<CommandOptions, "logCategory"> = {}
): Promise<ExecuteResult> {
  return executeCommand("run-devcontainer", args, { ...options, logCategory: "devcontainer" });
}
