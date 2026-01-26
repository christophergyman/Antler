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
} from "@services/config";
import { checkGitHubAuth } from "@services/github";
import {
  hasDevcontainerConfig,
  readDevcontainerConfig,
  saveDevcontainerConfig as saveDevcontainerConfigService,
  getDevcontainerConfigPath,
} from "@services/devcontainer";
import { getDockerRuntimeStatus, onDockerRuntimeStatusChange } from "@services/dockerRuntime";
import type { DockerRuntimeStatus } from "@services/dockerRuntime";
import { logConfig, logDocker, logPrerequisites, logDataSync } from "@services/logging";

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
  // Docker
  dockerStatus: DockerRuntimeStatus;
  isCheckingDocker: boolean;
  // Devcontainer
  hasDevcontainerConfig: boolean | null;
  devcontainerConfig: string | null;
  devcontainerConfigPath: string | null;
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
    dockerStatus: "unknown",
    isCheckingDocker: true,
    hasDevcontainerConfig: null,
    devcontainerConfig: null,
    devcontainerConfigPath: null,
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

  const checkDocker = useCallback(() => {
    logDocker("debug", "Checking Docker status");
    const status = getDockerRuntimeStatus();
    setState((prev) => ({
      ...prev,
      dockerStatus: status,
      isCheckingDocker: false,
    }));
    logDocker("debug", "Docker status check complete", { status });
  }, []);

  const checkDevcontainer = useCallback(async () => {
    logPrerequisites("debug", "Checking devcontainer config");
    const repoResult = await getCurrentRepoRoot();
    if (repoResult.ok) {
      const repoRoot = repoResult.value;
      const hasConfig = await hasDevcontainerConfig(repoRoot);
      const configPath = await getDevcontainerConfigPath(repoRoot);

      if (hasConfig) {
        const configResult = await readDevcontainerConfig(repoRoot);
        setState((prev) => ({
          ...prev,
          hasDevcontainerConfig: true,
          devcontainerConfig: configResult.ok ? configResult.value : null,
          devcontainerConfigPath: configPath,
        }));
        logPrerequisites("debug", "Devcontainer config found", { configPath });
      } else {
        setState((prev) => ({
          ...prev,
          hasDevcontainerConfig: false,
          devcontainerConfig: null,
          devcontainerConfigPath: configPath,
        }));
        logPrerequisites("debug", "No devcontainer config found", { expectedPath: configPath });
      }
    } else {
      setState((prev) => ({
        ...prev,
        hasDevcontainerConfig: null,
        devcontainerConfig: null,
        devcontainerConfigPath: null,
      }));
      logPrerequisites("debug", "No repo root, skipping devcontainer check");
    }
  }, []);

  const refresh = useCallback(() => {
    logConfig("debug", "Refreshing all settings");
    clearConfigCache();
    checkConfig();
    loadAntlerConfig();
    checkGitRepo();
    checkAuth();
    checkDocker();
    checkDevcontainer();
  }, [checkConfig, loadAntlerConfig, checkGitRepo, checkAuth, checkDocker, checkDevcontainer]);

  const saveDevcontainerConfig = useCallback(async (content: string): Promise<void> => {
    logPrerequisites("info", "Saving devcontainer config");
    const repoResult = await getCurrentRepoRoot();
    if (!repoResult.ok) {
      logPrerequisites("error", "Cannot save devcontainer config: no repository found");
      throw new Error("No repository found");
    }

    const result = await saveDevcontainerConfigService(repoResult.value, content);
    if (!result.ok) {
      logPrerequisites("error", "Failed to save devcontainer config", { error: result.error.message });
      throw new Error(result.error.message);
    }

    // Refresh devcontainer state after save
    await checkDevcontainer();
    logPrerequisites("info", "Devcontainer config saved successfully");
  }, [checkDevcontainer]);

  const revealConfig = useCallback(async () => {
    await revealConfigInFinder();
  }, []);

  // Subscribe to Docker status changes
  useEffect(() => {
    const unsubscribe = onDockerRuntimeStatusChange((status) => {
      setState((prev) => ({ ...prev, dockerStatus: status, isCheckingDocker: false }));
    });
    return unsubscribe;
  }, []);

  // Initial check
  useEffect(() => {
    refresh();
  }, []);

  return {
    ...state,
    refresh,
    saveDevcontainerConfig,
    saveAntlerConfig,
    revealConfig,
  };
}
