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
  const validation = validateConfig({ github: { repository: config.github.repository } });
  if (!validation.ok) {
    logConfig("error", "Config validation failed before save", { code: validation.error.code });
    return validation;
  }

  try {
    // Ensure AppData directory exists
    await mkdir("", { recursive: true, baseDir: BaseDirectory.AppData });

    const yamlContent = dump({ github: { repository: config.github.repository } });
    await writeTextFile(CONFIG_FILENAME, yamlContent, { baseDir: BaseDirectory.AppData });

    // Update cache
    cachedConfig = config;

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

let cachedConfig: AntlerConfig | null = null;

export async function getCachedConfig(): Promise<ConfigResult<AntlerConfig>> {
  if (cachedConfig) {
    return ok(cachedConfig);
  }

  const result = await loadConfig();
  if (result.ok) {
    cachedConfig = result.value;
  }
  return result;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

// ============================================================================
// Repository Root
// ============================================================================

let cachedRepoRoot: string | null = null;

/**
 * Get the repository root directory
 * Uses `git rev-parse --show-toplevel` to find the actual git root
 */
export async function getCurrentRepoRoot(): Promise<ConfigResult<string>> {
  if (cachedRepoRoot) {
    return ok(cachedRepoRoot);
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

    cachedRepoRoot = output.stdout.trim();
    logConfig("debug", "Found repo root", { path: cachedRepoRoot });
    return ok(cachedRepoRoot);
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
