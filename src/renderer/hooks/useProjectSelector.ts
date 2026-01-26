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
import { logProject, logUserAction } from "@services/logging";

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
    logProject("debug", "Loading project settings");
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
          logProject("debug", "Project settings loaded with current project", {
            currentProject: result.value.currentProject,
            projectName: infoResult.value.name,
          });
        } else {
          // Project path no longer exists, clear it
          setCurrentProjectInfo(null);
          logProject("warn", "Current project path no longer exists", {
            path: result.value.currentProject,
          });
        }
      } else {
        setCurrentProjectInfo(null);
        logProject("debug", "Project settings loaded, no current project");
      }
    } else {
      setError(result.error.message);
      logProject("error", "Failed to load project settings", { error: result.error.message });
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const selectProject = useCallback(async (): Promise<boolean> => {
    logUserAction("project_select", "Opening project picker");
    setError(null);

    const pickerResult = await openProjectPicker();
    if (!pickerResult.ok) {
      if (pickerResult.error.code !== "dialog_cancelled") {
        setError(pickerResult.error.message);
        logProject("error", "Project picker failed", { error: pickerResult.error.message });
      } else {
        logProject("debug", "Project picker cancelled by user");
      }
      return false;
    }

    const setResult = await setCurrentProject(pickerResult.value);
    if (!setResult.ok) {
      setError(setResult.error.message);
      logProject("error", "Failed to set current project", { error: setResult.error.message });
      return false;
    }

    // Refresh settings after changing project
    clearProjectSettingsCache();
    await loadSettings();
    logProject("info", "Project selected successfully", { path: pickerResult.value });
    return true;
  }, [loadSettings]);

  const selectRecentProject = useCallback(async (path: string): Promise<boolean> => {
    logUserAction("project_select_recent", "Selecting recent project", { path });
    setError(null);

    const setResult = await setCurrentProject(path);
    if (!setResult.ok) {
      setError(setResult.error.message);
      logProject("error", "Failed to select recent project", { path, error: setResult.error.message });
      return false;
    }

    clearProjectSettingsCache();
    await loadSettings();
    logProject("info", "Recent project selected successfully", { path });
    return true;
  }, [loadSettings]);

  const removeRecent = useCallback(async (path: string): Promise<void> => {
    logUserAction("project_remove_recent", "Removing recent project", { path });
    const result = await removeFromRecentProjects(path);
    if (!result.ok) {
      setError(result.error.message);
      logProject("error", "Failed to remove recent project", { path, error: result.error.message });
      return;
    }

    clearProjectSettingsCache();
    await loadSettings();
    logProject("debug", "Recent project removed successfully", { path });
  }, [loadSettings]);

  const cloneAndSelect = useCallback(async (repoUrl: string, parentDir?: string): Promise<boolean> => {
    logUserAction("project_clone", "Starting repository clone", { repoUrl });
    setError(null);

    // If no parent dir provided, open picker
    let destination = parentDir;
    if (!destination) {
      const destResult = await selectCloneDestination();
      if (!destResult.ok) {
        if (destResult.error.code !== "dialog_cancelled") {
          setError(destResult.error.message);
          logProject("error", "Clone destination selection failed", { error: destResult.error.message });
        } else {
          logProject("debug", "Clone destination selection cancelled");
        }
        return false;
      }
      destination = destResult.value;
    }

    // Extract repo name from URL for target directory
    const repoName = repoUrl.split("/").pop()?.replace(".git", "") ?? "repo";
    const targetDir = `${destination}/${repoName}`;

    // Clone the repository
    logProject("info", "Cloning repository", { repoUrl, targetDir });
    const cloneResult = await cloneRepository(repoUrl, targetDir);
    if (!cloneResult.ok) {
      setError(cloneResult.error.message);
      logProject("error", "Repository clone failed", { repoUrl, error: cloneResult.error.message });
      return false;
    }

    // Set as current project
    const setResult = await setCurrentProject(targetDir);
    if (!setResult.ok) {
      setError(setResult.error.message);
      logProject("error", "Failed to set cloned project as current", { targetDir, error: setResult.error.message });
      return false;
    }

    clearProjectSettingsCache();
    await loadSettings();
    logProject("info", "Repository cloned and selected successfully", { repoUrl, targetDir });
    return true;
  }, [loadSettings]);

  const refresh = useCallback(async () => {
    logProject("debug", "Refreshing project settings");
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
