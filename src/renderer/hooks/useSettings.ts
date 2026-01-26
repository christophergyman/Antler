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
    const [result, location] = await Promise.all([
      getCachedConfig(),
      getConfigLocation(),
    ]);
    if (result.ok) {
      setState((prev) => ({ ...prev, repository: result.value.github.repository, configLocation: location }));
    } else {
      setState((prev) => ({ ...prev, repository: null, configLocation: location }));
    }
  }, []);

  const loadAntlerConfig = useCallback(async () => {
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
  }, []);

  const saveAntlerConfig = useCallback(async (content: string): Promise<void> => {
    const result = await saveConfigContent(content);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    // Refresh config state after save
    await loadAntlerConfig();
    // Also refresh the parsed config
    clearConfigCache();
    await checkConfig();
  }, [loadAntlerConfig, checkConfig]);

  const checkGitRepo = useCallback(async () => {
    const result = await getCurrentRepoRoot();
    setState((prev) => ({
      ...prev,
      isGitRepo: result.ok,
      repoRoot: result.ok ? result.value : null,
    }));
  }, []);

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, isCheckingAuth: true }));
    const result = await checkGitHubAuth();

    if (result.ok && result.value) {
      setState((prev) => ({
        ...prev,
        isGitHubAuthenticated: true,
        gitHubUsername: result.value?.username ?? null,
        isCheckingAuth: false,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        isGitHubAuthenticated: false,
        gitHubUsername: null,
        isCheckingAuth: false,
      }));
    }
  }, []);

  const checkDocker = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dockerStatus: getDockerRuntimeStatus(),
      isCheckingDocker: false,
    }));
  }, []);

  const checkDevcontainer = useCallback(async () => {
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
      } else {
        setState((prev) => ({
          ...prev,
          hasDevcontainerConfig: false,
          devcontainerConfig: null,
          devcontainerConfigPath: configPath,
        }));
      }
    } else {
      setState((prev) => ({
        ...prev,
        hasDevcontainerConfig: null,
        devcontainerConfig: null,
        devcontainerConfigPath: null,
      }));
    }
  }, []);

  const refresh = useCallback(() => {
    clearConfigCache();
    checkConfig();
    loadAntlerConfig();
    checkGitRepo();
    checkAuth();
    checkDocker();
    checkDevcontainer();
  }, [checkConfig, loadAntlerConfig, checkGitRepo, checkAuth, checkDocker, checkDevcontainer]);

  const saveDevcontainerConfig = useCallback(async (content: string): Promise<void> => {
    const repoResult = await getCurrentRepoRoot();
    if (!repoResult.ok) {
      throw new Error("No repository found");
    }

    const result = await saveDevcontainerConfigService(repoResult.value, content);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    // Refresh devcontainer state after save
    await checkDevcontainer();
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
