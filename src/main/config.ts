/**
 * Configuration Loader
 * Loads and validates antler.yaml from project root
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { load } from "js-yaml";
import { app } from "electron";
import type { ConfigResult } from "./types/result";
import { ok, err, createConfigError } from "./types/result";

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

function getConfigPath(): string {
  // In development, use current working directory
  // In production, use app path
  const basePath = app.isPackaged ? app.getPath("userData") : process.cwd();
  return join(basePath, "antler.yaml");
}

export function loadConfig(): ConfigResult<AntlerConfig> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return err(
      createConfigError(
        "config_not_found",
        "Config file not found. Create antler.yaml in project root",
        `Expected at: ${configPath}`
      )
    );
  }

  let fileContent: string;
  try {
    fileContent = readFileSync(configPath, "utf-8");
  } catch (error) {
    return err(
      createConfigError(
        "config_not_found",
        "Failed to read config file",
        error instanceof Error ? error.message : String(error)
      )
    );
  }

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
}

