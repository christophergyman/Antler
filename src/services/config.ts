/**
 * Configuration Loader
 * Loads and validates antler.yaml using Tauri FS plugin
 */

import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";
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

export interface AntlerConfig {
  readonly github: GitHubConfig;
}

interface RawConfig {
  github?: {
    repository?: unknown;
  };
}

// ============================================================================
// Validation
// ============================================================================

const REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function validateRepository(repo: unknown): repo is string {
  return typeof repo === "string" && REPO_PATTERN.test(repo);
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

  return ok(
    Object.freeze({
      github: Object.freeze({
        repository: config.github.repository,
      }),
    })
  );
}

// ============================================================================
// Loader
// ============================================================================

const CONFIG_FILENAME = "antler.yaml";

/**
 * Get current working directory via shell command
 */
async function getCurrentDir(): Promise<string> {
  const command = Command.create("run-pwd");
  const output = await command.execute();
  if (output.code !== 0) {
    throw new Error(`Failed to get cwd: ${output.stderr}`);
  }
  return output.stdout.trim();
}

/**
 * Get parent directory path (resolves without using ../)
 */
function getParentDir(path: string): string {
  const segments = path.split("/").filter(Boolean);
  segments.pop();
  return "/" + segments.join("/");
}

/**
 * Find config file path, checking cwd and parent directory
 * Handles the case where pwd returns src-tauri/ in dev mode
 */
async function findConfigPath(): Promise<string | null> {
  const cwd = await getCurrentDir();

  // Check cwd first (normal case)
  const cwdPath = `${cwd}/${CONFIG_FILENAME}`;
  if (await exists(cwdPath)) {
    logConfig("debug", "Config found in cwd", { path: cwdPath });
    return cwdPath;
  }

  // Check parent directory (handles src-tauri/ case in dev mode)
  const parentDir = getParentDir(cwd);
  const parentPath = `${parentDir}/${CONFIG_FILENAME}`;
  if (await exists(parentPath)) {
    logConfig("debug", "Config found in parent directory", { path: parentPath });
    return parentPath;
  }

  logConfig("debug", "Config not found", { checked: [cwdPath, parentPath] });
  return null;
}

/**
 * Load config from current working directory or parent
 * Uses the directory where the app was launched (project root in typical usage)
 */
export async function loadConfig(): Promise<ConfigResult<AntlerConfig>> {
  logConfig("debug", "Loading config");

  try {
    const configPath = await findConfigPath();

    if (!configPath) {
      const cwd = await getCurrentDir();
      logConfig("warn", "Config file not found", { cwd });
      return err(
        createConfigError(
          "config_not_found",
          "Config file not found. Create antler.yaml in project root",
          `Checked: ${cwd}/${CONFIG_FILENAME} and parent directory`
        )
      );
    }

    const fileContent = await readTextFile(configPath);

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
// Config Path
// ============================================================================

/**
 * Get the config file path
 * Returns the path where antler.yaml exists or should be created
 */
export async function getConfigFilePath(): Promise<string> {
  const configPath = await findConfigPath();
  if (configPath) {
    return configPath;
  }
  // Default to cwd if not found
  const cwd = await getCurrentDir();
  return `${cwd}/${CONFIG_FILENAME}`;
}

// ============================================================================
// Config Save
// ============================================================================

/**
 * Save config to antler.yaml
 */
export async function saveConfig(config: AntlerConfig): Promise<ConfigResult<void>> {
  logConfig("debug", "Saving config");

  // Validate before saving
  const validation = validateConfig({ github: { repository: config.github.repository } });
  if (!validation.ok) {
    logConfig("error", "Config validation failed before save", { code: validation.error.code });
    return validation;
  }

  try {
    const configPath = await getConfigFilePath();
    const yamlContent = dump({ github: { repository: config.github.repository } });

    await writeTextFile(configPath, yamlContent);
    clearConfigCache();

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
