/**
 * Configuration Loader
 * Loads and validates antler.yaml using Tauri FS plugin
 */

import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";
import { load } from "js-yaml";
import type { ConfigResult } from "@core/types/result";
import { ok, err, createConfigError } from "@core/types/result";

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
 * Load config from current working directory
 * In Tauri, we use the App directory or Resource directory depending on context
 */
export async function loadConfig(): Promise<ConfigResult<AntlerConfig>> {
  // Try loading from current working directory (Resource in Tauri context)
  // For development, this will be the project root
  const configPath = CONFIG_FILENAME;

  try {
    // Check if file exists in Resource directory (project root during dev)
    const fileExists = await exists(configPath, { baseDir: BaseDirectory.Resource });

    if (!fileExists) {
      return err(
        createConfigError(
          "config_not_found",
          "Config file not found. Create antler.yaml in project root",
          `Expected: ${configPath}`
        )
      );
    }

    const fileContent = await readTextFile(configPath, { baseDir: BaseDirectory.Resource });

    let parsed: unknown;
    try {
      parsed = load(fileContent);
    } catch (error) {
      return err(
        createConfigError(
          "config_parse_error",
          "Failed to parse YAML config",
          error instanceof Error ? error.message : String(error)
        )
      );
    }

    return validateConfig(parsed);
  } catch (error) {
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
