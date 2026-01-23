/**
 * Configuration Loader
 * Loads and validates antler.yaml using Tauri FS plugin
 */

import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { load } from "js-yaml";
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
 * Load config from current working directory
 * Uses the directory where the app was launched (project root in typical usage)
 */
export async function loadConfig(): Promise<ConfigResult<AntlerConfig>> {
  logConfig("debug", "Loading config");

  try {
    // Use current working directory - where the app was launched from
    const cwd = await getCurrentDir();
    const configPath = `${cwd}/${CONFIG_FILENAME}`;

    const fileExists = await exists(configPath);

    if (!fileExists) {
      logConfig("warn", "Config file not found", { path: configPath });
      return err(
        createConfigError(
          "config_not_found",
          "Config file not found. Create antler.yaml in project root",
          `Expected: ${configPath}`
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
