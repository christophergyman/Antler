/**
 * useSettings Hook
 * Manages state for all settings panel sections
 */

import { useState, useCallback, useEffect } from "react";
import { getCachedConfig, getCurrentRepoRoot, clearConfigCache } from "@services/config";
import { checkGitHubAuth } from "@services/github";
import { hasDevcontainerConfig } from "@services/devcontainer";
import { getDockerRuntimeStatus, onDockerRuntimeStatusChange } from "@services/dockerRuntime";
import type { DockerRuntimeStatus } from "@services/dockerRuntime";

interface SettingsState {
  // Config
  repository: string | null;
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
}

export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    repository: null,
    isGitRepo: null,
    repoRoot: null,
    isGitHubAuthenticated: null,
    gitHubUsername: null,
    isCheckingAuth: true,
    dockerStatus: "unknown",
    isCheckingDocker: true,
    hasDevcontainerConfig: null,
  });

  const checkConfig = useCallback(async () => {
    const result = await getCachedConfig();
    if (result.ok) {
      setState((prev) => ({ ...prev, repository: result.value.github.repository }));
    } else {
      setState((prev) => ({ ...prev, repository: null }));
    }
  }, []);

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
      const hasConfig = await hasDevcontainerConfig(repoResult.value);
      setState((prev) => ({ ...prev, hasDevcontainerConfig: hasConfig }));
    } else {
      setState((prev) => ({ ...prev, hasDevcontainerConfig: null }));
    }
  }, []);

  const refresh = useCallback(() => {
    clearConfigCache();
    checkConfig();
    checkGitRepo();
    checkAuth();
    checkDocker();
    checkDevcontainer();
  }, [checkConfig, checkGitRepo, checkAuth, checkDocker, checkDevcontainer]);

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
  };
}
