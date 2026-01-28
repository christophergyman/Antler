/**
 * useSettings Hook
 * Manages state for all settings panel sections
 */

import { useState, useCallback, useEffect } from "react";
import {
  getCachedConfig,
  getCurrentRepoRoot,
  clearConfigCache,
  getConfigLocation,
  revealConfigInFinder,
  configFileExists,
  getConfigContent,
  saveConfigContent,
  getTerminalApp,
  getPostOpenCommand,
} from "@services/config";
import { checkGitHubAuth } from "@services/github";
import { logConfig, logDataSync } from "@services/logging";

interface SettingsState {
  // Config
  repository: string | null;
  configLocation: string | null;
  // Antler Config (YAML editor)
  hasAntlerConfig: boolean | null;
  antlerConfigContent: string | null;
  antlerConfigPath: string | null;
  // Git
  isGitRepo: boolean | null;
  repoRoot: string | null;
  // GitHub Auth
  isGitHubAuthenticated: boolean | null;
  gitHubUsername: string | null;
  isCheckingAuth: boolean;
  // Terminal
  terminalApp: string | null;
  postOpenCommand: string | null;
}

export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    repository: null,
    configLocation: null,
    hasAntlerConfig: null,
    antlerConfigContent: null,
    antlerConfigPath: null,
    isGitRepo: null,
    repoRoot: null,
    isGitHubAuthenticated: null,
    gitHubUsername: null,
    isCheckingAuth: true,
    terminalApp: null,
    postOpenCommand: null,
  });

  const checkConfig = useCallback(async () => {
    logConfig("debug", "Checking config");
    const [result, location] = await Promise.all([
      getCachedConfig(),
      getConfigLocation(),
    ]);
    if (result.ok) {
      setState((prev) => ({ ...prev, repository: result.value.github.repository, configLocation: location }));
      logConfig("debug", "Config loaded", { repository: result.value.github.repository });
    } else {
      setState((prev) => ({ ...prev, repository: null, configLocation: location }));
      logConfig("debug", "Config not found or invalid", { location });
    }
  }, []);

  const loadAntlerConfig = useCallback(async () => {
    logConfig("debug", "Loading antler.yaml config");
    const [hasConfig, contentResult, configPath] = await Promise.all([
      configFileExists(),
      getConfigContent(),
      getConfigLocation(),
    ]);

    setState((prev) => ({
      ...prev,
      hasAntlerConfig: hasConfig,
      antlerConfigContent: contentResult.ok ? contentResult.value : null,
      antlerConfigPath: configPath,
    }));
    logConfig("debug", "Antler config loaded", { hasConfig, configPath });
  }, []);

  const saveAntlerConfig = useCallback(async (content: string): Promise<void> => {
    logConfig("info", "Saving antler.yaml config");
    const result = await saveConfigContent(content);
    if (!result.ok) {
      logConfig("error", "Failed to save antler.yaml config", { error: result.error.message });
      throw new Error(result.error.message);
    }

    // Refresh config state after save
    await loadAntlerConfig();
    // Also refresh the parsed config
    clearConfigCache();
    await checkConfig();
    logConfig("info", "Antler config saved successfully");
  }, [loadAntlerConfig, checkConfig]);

  const checkGitRepo = useCallback(async () => {
    logConfig("debug", "Checking git repository");
    const result = await getCurrentRepoRoot();
    setState((prev) => ({
      ...prev,
      isGitRepo: result.ok,
      repoRoot: result.ok ? result.value : null,
    }));
    logConfig("debug", "Git repository check complete", { isGitRepo: result.ok, repoRoot: result.ok ? result.value : null });
  }, []);

  const checkAuth = useCallback(async () => {
    logDataSync("debug", "Checking GitHub authentication");
    setState((prev) => ({ ...prev, isCheckingAuth: true }));
    const result = await checkGitHubAuth();

    if (result.ok && result.value) {
      setState((prev) => ({
        ...prev,
        isGitHubAuthenticated: true,
        gitHubUsername: result.value?.username ?? null,
        isCheckingAuth: false,
      }));
      logDataSync("info", "GitHub authenticated", { username: result.value?.username });
    } else {
      setState((prev) => ({
        ...prev,
        isGitHubAuthenticated: false,
        gitHubUsername: null,
        isCheckingAuth: false,
      }));
      logDataSync("debug", "GitHub not authenticated");
    }
  }, []);

  const loadTerminalSettings = useCallback(async () => {
    logConfig("debug", "Loading terminal settings");
    const [app, command] = await Promise.all([
      getTerminalApp(),
      getPostOpenCommand(),
    ]);
    setState((prev) => ({
      ...prev,
      terminalApp: app,
      postOpenCommand: command,
    }));
    logConfig("debug", "Terminal settings loaded", { app, command });
  }, []);

  const saveTerminalSettings = useCallback(async (app: string, command: string): Promise<void> => {
    logConfig("info", "Saving terminal settings", { app, command });

    // Load current config content and update it
    const contentResult = await getConfigContent();
    if (!contentResult.ok) {
      // Create new config with terminal settings
      logConfig("debug", "Config file does not exist, creating new config");
      const newContent = `github:
  repository: ""
${app || command ? `terminal:
${app ? `  app: "${app}"\n` : ""}${command ? `  postOpenCommand: "${command}"\n` : ""}` : ""}`;
      await saveConfigContent(newContent);
    } else {
      // Parse and update existing config
      logConfig("debug", "Parsing existing YAML config for terminal settings update");
      try {
        const { load, dump } = await import("js-yaml");
        const parsed = load(contentResult.value) as Record<string, unknown>;

        // Update terminal section
        if (app || command) {
          parsed.terminal = {
            ...(app && { app }),
            ...(command && { postOpenCommand: command }),
          };
        } else {
          delete parsed.terminal;
        }

        const updatedContent = dump(parsed);
        logConfig("debug", "YAML config updated, saving to file");
        await saveConfigContent(updatedContent);
      } catch (yamlError) {
        const message = yamlError instanceof Error ? yamlError.message : String(yamlError);
        logConfig("error", "Failed to parse YAML config for terminal settings", { error: message });
        throw yamlError;
      }
    }

    // Refresh terminal settings after save
    logConfig("debug", "Clearing config cache and reloading terminal settings");
    clearConfigCache();
    await loadTerminalSettings();
    logConfig("info", "Terminal settings saved successfully");
  }, [loadTerminalSettings]);

  const refresh = useCallback(() => {
    logConfig("debug", "Refreshing all settings");
    clearConfigCache();
    checkConfig();
    loadAntlerConfig();
    checkGitRepo();
    checkAuth();
    loadTerminalSettings();
  }, [checkConfig, loadAntlerConfig, checkGitRepo, checkAuth, loadTerminalSettings]);

  const revealConfig = useCallback(async () => {
    await revealConfigInFinder();
  }, []);

  // Initial check
  useEffect(() => {
    refresh();
  }, []);

  return {
    ...state,
    refresh,
    saveAntlerConfig,
    saveTerminalSettings,
    revealConfig,
  };
}
