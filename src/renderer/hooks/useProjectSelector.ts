/**
 * useProjectSelector Hook
 * Manages project selection state and operations
 */

import { useState, useEffect, useCallback } from "react";
import type { ProjectSettings, ProjectInfo } from "@core/types/project";
import {
  getCachedProjectSettings,
  getProjectInfo,
  openProjectPicker,
  setCurrentProject,
  removeFromRecentProjects,
  cloneRepository,
  selectCloneDestination,
  clearProjectSettingsCache,
} from "@services/project";

export interface UseProjectSelectorReturn {
  settings: ProjectSettings | null;
  currentProjectInfo: ProjectInfo | null;
  isLoading: boolean;
  error: string | null;
  hasProject: boolean;
  selectProject: () => Promise<boolean>;
  selectRecentProject: (path: string) => Promise<boolean>;
  removeRecent: (path: string) => Promise<void>;
  cloneAndSelect: (repoUrl: string, parentDir?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useProjectSelector(): UseProjectSelectorReturn {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [currentProjectInfo, setCurrentProjectInfo] = useState<ProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getCachedProjectSettings();
    if (result.ok) {
      setSettings(result.value);

      // Load current project info if there's a current project
      if (result.value.currentProject) {
        const infoResult = await getProjectInfo(result.value.currentProject);
        if (infoResult.ok) {
          setCurrentProjectInfo(infoResult.value);
        } else {
          // Project path no longer exists, clear it
          setCurrentProjectInfo(null);
        }
      } else {
        setCurrentProjectInfo(null);
      }
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const selectProject = useCallback(async (): Promise<boolean> => {
    setError(null);

    const pickerResult = await openProjectPicker();
    if (!pickerResult.ok) {
      if (pickerResult.error.code !== "dialog_cancelled") {
        setError(pickerResult.error.message);
      }
      return false;
    }

    const setResult = await setCurrentProject(pickerResult.value);
    if (!setResult.ok) {
      setError(setResult.error.message);
      return false;
    }

    // Refresh settings after changing project
    clearProjectSettingsCache();
    await loadSettings();
    return true;
  }, [loadSettings]);

  const selectRecentProject = useCallback(async (path: string): Promise<boolean> => {
    setError(null);

    const setResult = await setCurrentProject(path);
    if (!setResult.ok) {
      setError(setResult.error.message);
      return false;
    }

    clearProjectSettingsCache();
    await loadSettings();
    return true;
  }, [loadSettings]);

  const removeRecent = useCallback(async (path: string): Promise<void> => {
    const result = await removeFromRecentProjects(path);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    clearProjectSettingsCache();
    await loadSettings();
  }, [loadSettings]);

  const cloneAndSelect = useCallback(async (repoUrl: string, parentDir?: string): Promise<boolean> => {
    setError(null);

    // If no parent dir provided, open picker
    let destination = parentDir;
    if (!destination) {
      const destResult = await selectCloneDestination();
      if (!destResult.ok) {
        if (destResult.error.code !== "dialog_cancelled") {
          setError(destResult.error.message);
        }
        return false;
      }
      destination = destResult.value;
    }

    // Extract repo name from URL for target directory
    const repoName = repoUrl.split("/").pop()?.replace(".git", "") ?? "repo";
    const targetDir = `${destination}/${repoName}`;

    // Clone the repository
    const cloneResult = await cloneRepository(repoUrl, targetDir);
    if (!cloneResult.ok) {
      setError(cloneResult.error.message);
      return false;
    }

    // Set as current project
    const setResult = await setCurrentProject(targetDir);
    if (!setResult.ok) {
      setError(setResult.error.message);
      return false;
    }

    clearProjectSettingsCache();
    await loadSettings();
    return true;
  }, [loadSettings]);

  const refresh = useCallback(async () => {
    clearProjectSettingsCache();
    await loadSettings();
  }, [loadSettings]);

  return {
    settings,
    currentProjectInfo,
    isLoading,
    error,
    hasProject: !!settings?.currentProject,
    selectProject,
    selectRecentProject,
    removeRecent,
    cloneAndSelect,
    refresh,
  };
}
