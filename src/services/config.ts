/**
 * Configuration Loader
 * Loads and validates antler.yaml from app data directory using Tauri FS plugin
 */

import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/plugin-shell";
import { load, dump } from "js-yaml";
import type { ConfigResult } from "@core/types/result";
import { ok, err, createConfigError } from "@core/types/result";
import { logConfig } from "./logging";

// ============================================================================
// Types
// ============================================================================

export interface GitHubConfig {
  readonly repository: string;
}

export interface TerminalSettings {
  readonly app?: string;           // e.g., "/Applications/iTerm.app" or "Terminal"
  readonly postOpenCommand?: string; // e.g., "bun run dev"
  readonly autoPromptClaude?: boolean; // Auto-prompt Claude with issue context when opening terminal
  readonly claudeStartupDelay?: number; // Milliseconds to wait for Claude to initialize before pasting prompt
}

export interface AntlerConfig {
  readonly github: GitHubConfig;
  readonly terminal?: TerminalSettings;
}

interface RawConfig {
  github?: {
    repository?: unknown;
  };
  terminal?: {
    app?: unknown;
    postOpenCommand?: unknown;
    autoPromptClaude?: unknown;
    claudeStartupDelay?: unknown;
  };
}

// ============================================================================
// Validation
// ============================================================================

const REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function validateRepository(repo: unknown): repo is string {
  return typeof repo === "string" && REPO_PATTERN.test(repo);
}

function validateTerminalSettings(terminal: unknown): TerminalSettings | undefined {
  if (!terminal || typeof terminal !== "object") {
    return undefined;
  }
  const t = terminal as RawConfig["terminal"];
  const result: { app?: string; postOpenCommand?: string; autoPromptClaude?: boolean; claudeStartupDelay?: number } = {};

  if (t?.app !== undefined && typeof t.app === "string" && t.app.trim()) {
    result.app = t.app.trim();
  }
  if (t?.postOpenCommand !== undefined && typeof t.postOpenCommand === "string" && t.postOpenCommand.trim()) {
    result.postOpenCommand = t.postOpenCommand.trim();
  }
  if (t?.autoPromptClaude !== undefined && typeof t.autoPromptClaude === "boolean") {
    result.autoPromptClaude = t.autoPromptClaude;
  }
  if (t?.claudeStartupDelay !== undefined && typeof t.claudeStartupDelay === "number" && t.claudeStartupDelay >= 500 && t.claudeStartupDelay <= 10000) {
    result.claudeStartupDelay = t.claudeStartupDelay;
  }

  return Object.keys(result).length > 0 ? Object.freeze(result) : undefined;
}

function validateConfig(raw: unknown): ConfigResult<AntlerConfig> {
  if (!raw || typeof raw !== "object") {
    return err(
      createConfigError("config_invalid", "Config must be an object")
    );
  }

  const config = raw as RawConfig;

  if (!config.github || typeof config.github !== "object") {
    return err(
      createConfigError("config_invalid", "Missing 'github' section in config")
    );
  }

  if (!validateRepository(config.github.repository)) {
    return err(
      createConfigError(
        "config_invalid",
        "Invalid repository format. Expected 'owner/repo'",
        `Got: ${String(config.github.repository)}`
      )
    );
  }

  const terminalSettings = validateTerminalSettings(config.terminal);

  const result: AntlerConfig = {
    github: Object.freeze({
      repository: config.github.repository,
    }),
    ...(terminalSettings && { terminal: terminalSettings }),
  };

  return ok(Object.freeze(result));
}

// ============================================================================
// Loader
// ============================================================================

const CONFIG_FILENAME = "antler.yaml";

/**
 * Get the full path to the global config file
 * Returns path in app data directory (e.g., ~/Library/Application Support/com.antler.app/antler.yaml)
 */
export async function getConfigLocation(): Promise<string> {
  const appData = await appDataDir();
  return `${appData}${CONFIG_FILENAME}`;
}

/**
 * Reveal the config file in macOS Finder
 * Uses osascript (AppleScript) to reveal in Finder - this handles paths with .app in directory names correctly
 * Falls back to opening the directory if the file doesn't exist yet
 */
export async function revealConfigInFinder(): Promise<void> {
  const configPath = await getConfigLocation();
  logConfig("debug", "Revealing config in Finder", { path: configPath });

  // Check if file exists, if not reveal the directory instead
  const fileExists = await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });
  const targetPath = fileExists ? configPath : await appDataDir();

  // Use osascript to reveal in Finder (handles .app in path correctly)
  const command = Command.create("run-osascript", [
    "-e", `tell application "Finder" to reveal POSIX file "${targetPath}"`,
    "-e", `tell application "Finder" to activate`
  ]);

  const output = await command.execute();

  if (output.code !== 0) {
    logConfig("error", "Failed to reveal in Finder", {
      code: output.code,
      stderr: output.stderr
    });
  } else {
    logConfig("info", "Revealed config location in Finder", { path: targetPath, fileExists });
  }
}

/**
 * Load config from app data directory
 * The global config applies to the currently selected project
 */
export async function loadConfig(): Promise<ConfigResult<AntlerConfig>> {
  logConfig("debug", "Loading config from app data directory");

  try {
    const configExists = await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });

    if (!configExists) {
      const configPath = await getConfigLocation();
      logConfig("warn", "Config file not found", { path: configPath });
      return err(
        createConfigError(
          "config_not_found",
          "Config file not found",
          `Expected at: ${configPath}`
        )
      );
    }

    const fileContent = await readTextFile(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });

    let parsed: unknown;
    try {
      parsed = load(fileContent);
    } catch (error) {
      logConfig("error", "Failed to parse YAML config", { error: error instanceof Error ? error.message : String(error) });
      return err(
        createConfigError(
          "config_parse_error",
          "Failed to parse YAML config",
          error instanceof Error ? error.message : String(error)
        )
      );
    }

    const result = validateConfig(parsed);
    if (result.ok) {
      logConfig("info", "Config loaded successfully", { repo: result.value.github.repository });
      cachedConfig = result.value;
    } else {
      logConfig("error", "Config validation failed", { code: result.error.code });
    }
    return result;
  } catch (error) {
    logConfig("error", "Failed to read config file", { error: error instanceof Error ? error.message : String(error) });
    return err(
      createConfigError(
        "config_not_found",
        "Failed to read config file",
        error instanceof Error ? error.message : String(error)
      )
    );
  }
}

// ============================================================================
// Config Save
// ============================================================================

/**
 * Save config to app data directory
 */
export async function saveConfig(config: AntlerConfig): Promise<ConfigResult<void>> {
  logConfig("debug", "Saving config to app data directory");

  // Validate before saving
  const rawConfig: RawConfig = {
    github: { repository: config.github.repository },
    ...(config.terminal && { terminal: config.terminal }),
  };
  const validation = validateConfig(rawConfig);
  if (!validation.ok) {
    logConfig("error", "Config validation failed before save", { code: validation.error.code });
    return validation;
  }

  try {
    // Ensure AppData directory exists
    await mkdir("", { recursive: true, baseDir: BaseDirectory.AppData });

    // Build YAML content with optional terminal section
    const configData: Record<string, unknown> = {
      github: { repository: config.github.repository },
    };
    if (config.terminal) {
      configData.terminal = config.terminal;
    }

    const yamlContent = dump(configData);
    await writeTextFile(CONFIG_FILENAME, yamlContent, { baseDir: BaseDirectory.AppData });

    // Update cache
    cachedConfig = {
      value: config,
      timestamp: Date.now(),
    };

    const configPath = await getConfigLocation();
    logConfig("info", "Config saved successfully", { path: configPath, repo: config.github.repository });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logConfig("error", "Failed to save config", { error: message });
    return err(
      createConfigError(
        "config_parse_error",
        "Failed to save config file",
        message
      )
    );
  }
}

// ============================================================================
// Config Cache
// ============================================================================

/** Cache TTL in milliseconds (5 minutes) */
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

let cachedConfig: CacheEntry<AntlerConfig> | null = null;

/**
 * Check if a cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CONFIG_CACHE_TTL_MS;
}

export async function getCachedConfig(): Promise<ConfigResult<AntlerConfig>> {
  if (isCacheValid(cachedConfig)) {
    return ok(cachedConfig.value);
  }

  const result = await loadConfig();
  if (result.ok) {
    cachedConfig = {
      value: result.value,
      timestamp: Date.now(),
    };
  }
  return result;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

// ============================================================================
// Config File Operations (for YAML Editor)
// ============================================================================

/**
 * Check if antler.yaml config file exists
 */
export async function configFileExists(): Promise<boolean> {
  return await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });
}

/**
 * Get raw YAML content as string (for editor display)
 */
export async function getConfigContent(): Promise<ConfigResult<string>> {
  try {
    const configExists = await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });

    if (!configExists) {
      const configPath = await getConfigLocation();
      return err(
        createConfigError(
          "config_not_found",
          "Config file not found",
          `Expected at: ${configPath}`
        )
      );
    }

    const content = await readTextFile(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });
    return ok(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logConfig("error", "Failed to read config content", { error: message });
    return err(
      createConfigError(
        "config_not_found",
        "Failed to read config file",
        message
      )
    );
  }
}

/**
 * Save raw YAML content to config file
 * Parses and validates YAML before saving
 */
export async function saveConfigContent(yamlString: string): Promise<ConfigResult<void>> {
  logConfig("debug", "Saving config content");

  // Parse YAML first to validate syntax
  let parsed: unknown;
  try {
    parsed = load(yamlString);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logConfig("error", "Invalid YAML syntax", { error: message });
    return err(
      createConfigError(
        "config_parse_error",
        "Invalid YAML syntax",
        message
      )
    );
  }

  // Validate config structure (but allow empty repository for initial setup)
  if (!parsed || typeof parsed !== "object") {
    return err(
      createConfigError("config_invalid", "Config must be an object")
    );
  }

  const config = parsed as RawConfig;

  if (!config.github || typeof config.github !== "object") {
    return err(
      createConfigError("config_invalid", "Missing 'github' section in config")
    );
  }

  // Repository can be empty string but must be a string if present
  if (config.github.repository !== undefined && typeof config.github.repository !== "string") {
    return err(
      createConfigError(
        "config_invalid",
        "Repository must be a string"
      )
    );
  }

  try {
    // Ensure AppData directory exists
    await mkdir("", { recursive: true, baseDir: BaseDirectory.AppData });

    // Write the raw YAML content (preserving user formatting)
    await writeTextFile(CONFIG_FILENAME, yamlString, { baseDir: BaseDirectory.AppData });

    // Clear cache so next load reads fresh data
    cachedConfig = null;

    const configPath = await getConfigLocation();
    logConfig("info", "Config content saved successfully", { path: configPath });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logConfig("error", "Failed to save config content", { error: message });
    return err(
      createConfigError(
        "config_parse_error",
        "Failed to save config file",
        message
      )
    );
  }
}

/**
 * Ensure config file exists, creating minimal template if not
 */
export async function ensureConfigExists(): Promise<ConfigResult<void>> {
  const configExists = await exists(CONFIG_FILENAME, { baseDir: BaseDirectory.AppData });

  if (configExists) {
    logConfig("debug", "Config file already exists");
    return ok(undefined);
  }

  logConfig("info", "Creating initial config file");

  try {
    // Ensure AppData directory exists
    await mkdir("", { recursive: true, baseDir: BaseDirectory.AppData });

    const template = `github:
  repository: ""
`;

    await writeTextFile(CONFIG_FILENAME, template, { baseDir: BaseDirectory.AppData });

    const configPath = await getConfigLocation();
    logConfig("info", "Initial config file created", { path: configPath });
    return ok(undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logConfig("error", "Failed to create initial config", { error: message });
    return err(
      createConfigError(
        "config_parse_error",
        "Failed to create config file",
        message
      )
    );
  }
}

// ============================================================================
// Repository Root
// ============================================================================

let cachedRepoRoot: CacheEntry<string> | null = null;

/**
 * Get the repository root directory
 * Uses `git rev-parse --show-toplevel` to find the actual git root
 */
export async function getCurrentRepoRoot(): Promise<ConfigResult<string>> {
  if (isCacheValid(cachedRepoRoot)) {
    return ok(cachedRepoRoot.value);
  }

  try {
    const command = Command.create("run-git", ["rev-parse", "--show-toplevel"]);
    const output = await command.execute();

    if (output.code !== 0) {
      logConfig("error", "Failed to get repo root", { stderr: output.stderr });
      return err(
        createConfigError(
          "config_not_found",
          "Not in a git repository",
          output.stderr.trim()
        )
      );
    }

    const repoRoot = output.stdout.trim();
    cachedRepoRoot = {
      value: repoRoot,
      timestamp: Date.now(),
    };
    logConfig("debug", "Found repo root", { path: repoRoot });
    return ok(repoRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logConfig("error", "Failed to execute git command", { error: message });
    return err(
      createConfigError(
        "config_not_found",
        "Failed to determine repository root",
        message
      )
    );
  }
}

export function clearRepoRootCache(): void {
  cachedRepoRoot = null;
}

// ============================================================================
// Terminal Settings Getters
// ============================================================================

/**
 * Get the configured terminal app (e.g., "iTerm" or "/Applications/iTerm.app")
 * Returns null if not configured (will use system default)
 */
export async function getTerminalApp(): Promise<string | null> {
  const result = await getCachedConfig();
  if (!result.ok) {
    logConfig("debug", "Failed to get terminal app - config unavailable");
    return null;
  }
  const app = result.value.terminal?.app ?? null;
  logConfig("debug", "Retrieved terminal app setting", { app });
  return app;
}

/**
 * Get the post-open command to run after terminal opens
 * Returns null if not configured
 */
export async function getPostOpenCommand(): Promise<string | null> {
  const result = await getCachedConfig();
  if (!result.ok) {
    logConfig("debug", "Failed to get post-open command - config unavailable");
    return null;
  }
  const command = result.value.terminal?.postOpenCommand ?? null;
  logConfig("debug", "Retrieved post-open command setting", { hasCommand: Boolean(command) });
  return command;
}

/**
 * Get the auto-prompt Claude setting
 * When enabled, Claude will be invoked with the GitHub issue context when opening terminal
 * Returns false if not configured
 */
export async function getAutoPromptClaude(): Promise<boolean> {
  const result = await getCachedConfig();
  if (!result.ok) {
    logConfig("debug", "Failed to get auto-prompt Claude setting - config unavailable");
    return false;
  }
  const enabled = result.value.terminal?.autoPromptClaude ?? false;
  logConfig("debug", "Retrieved auto-prompt Claude setting", { enabled });
  return enabled;
}

/**
 * Get the Claude startup delay setting
 * Time in milliseconds to wait for Claude to initialize before pasting the prompt
 * Returns 2500ms as default if not configured
 */
export async function getClaudeStartupDelay(): Promise<number> {
  const result = await getCachedConfig();
  if (!result.ok) {
    logConfig("debug", "Failed to get Claude startup delay - config unavailable");
    return 2500;
  }
  const delay = result.value.terminal?.claudeStartupDelay ?? 2500;
  logConfig("debug", "Retrieved Claude startup delay setting", { delay });
  return delay;
}
