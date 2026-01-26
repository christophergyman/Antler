/**
 * Project Service
 * Manages project selection and persistence
 */

import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { Command } from "@tauri-apps/plugin-shell";
import type { ProjectSettings, ProjectInfo, ProjectResult } from "@core/types/project";
import { createProjectError } from "@core/types/project";
import { ok, err } from "@core/types/result";
import { logProject } from "./logging";
import { saveConfig } from "./config";
import type { AntlerConfig } from "./config";

// ============================================================================
// Configuration
// ============================================================================

const SETTINGS_FILENAME = "project-settings.json";
const MAX_RECENT_PROJECTS = 5;

// ============================================================================
// Project Settings Persistence
// ============================================================================

/**
 * Create default project settings
 */
function createDefaultSettings(): ProjectSettings {
  return Object.freeze({
    currentProject: null,
    recentProjects: [],
  });
}

/**
 * Load project settings from app data directory
 */
export async function loadProjectSettings(): Promise<ProjectResult<ProjectSettings>> {
  logProject("debug", "Loading project settings");

  try {
    const settingsExists = await exists(SETTINGS_FILENAME, { baseDir: BaseDirectory.AppData });

    if (!settingsExists) {
      logProject("debug", "Project settings file not found, using defaults");
      return ok(createDefaultSettings());
    }

    const content = await readTextFile(SETTINGS_FILENAME, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(content) as ProjectSettings;

    logProject("debug", "Project settings loaded", { currentProject: parsed.currentProject });
    return ok(Object.freeze({
      currentProject: parsed.currentProject ?? null,
      recentProjects: Object.freeze(parsed.recentProjects ?? []),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProject("error", "Failed to load project settings", { error: message });
    return err(createProjectError("read_failed", "Failed to load project settings", message));
  }
}

/**
 * Save project settings to app data directory
 */
export async function saveProjectSettings(settings: ProjectSettings): Promise<ProjectResult<void>> {
  logProject("debug", "Saving project settings", { currentProject: settings.currentProject });

  try {
    // Ensure AppData directory exists
    await mkdir("", { recursive: true, baseDir: BaseDirectory.AppData });

    const content = JSON.stringify({
      currentProject: settings.currentProject,
      recentProjects: settings.recentProjects,
    }, null, 2);

    await writeTextFile(SETTINGS_FILENAME, content, { baseDir: BaseDirectory.AppData });

    // Update cache
    cachedSettings = settings;

    logProject("info", "Project settings saved");
    return ok(undefined);
  } catch (error) {
    // Clear cache on failure to prevent stale data
    cachedSettings = null;
    const message = error instanceof Error ? error.message : String(error);
    logProject("error", "Failed to save project settings", { error: message });
    return err(createProjectError("write_failed", "Failed to save project settings", message));
  }
}

// ============================================================================
// Settings Cache
// ============================================================================

let cachedSettings: ProjectSettings | null = null;

/**
 * Get cached project settings or load from disk
 */
export async function getCachedProjectSettings(): Promise<ProjectResult<ProjectSettings>> {
  if (cachedSettings) {
    return ok(cachedSettings);
  }

  const result = await loadProjectSettings();
  if (result.ok) {
    cachedSettings = result.value;
  }
  return result;
}

/**
 * Clear project settings cache
 */
export function clearProjectSettingsCache(): void {
  cachedSettings = null;
}

// ============================================================================
// Git Repository Detection
// ============================================================================

/**
 * Check if a directory is a git repository
 */
export async function isGitRepository(path: string): Promise<boolean> {
  try {
    const command = Command.create("run-git", ["rev-parse", "--git-dir"]);
    command.options.cwd = path;
    const output = await command.execute();
    return output.code === 0;
  } catch {
    return false;
  }
}

// ============================================================================
// Git Remote URL Parsing
// ============================================================================

/**
 * Extract owner/repo from a git URL or shorthand
 * Handles: owner/repo, https://github.com/owner/repo.git, git@github.com:owner/repo.git
 */
export function extractOwnerRepo(url: string): string | null {
  // Already in owner/repo format
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(url)) {
    return url;
  }

  // HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  return null;
}

/**
 * Get the git remote origin URL for a repository
 */
export async function getGitRemoteUrl(path: string): Promise<string | null> {
  try {
    const command = Command.create("run-git", ["config", "--get", "remote.origin.url"]);
    command.options.cwd = path;
    const output = await command.execute();
    if (output.code === 0 && output.stdout.trim()) {
      return output.stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect repository from git remote and save to global config
 * Returns true if config was updated, false if detection failed
 */
export async function detectAndSaveRepository(projectPath: string): Promise<boolean> {
  const remoteUrl = await getGitRemoteUrl(projectPath);
  if (!remoteUrl) {
    logProject("warn", "Could not get git remote URL", { projectPath });
    return false;
  }

  const ownerRepo = extractOwnerRepo(remoteUrl);
  if (!ownerRepo) {
    logProject("warn", "Could not extract owner/repo from remote URL", { remoteUrl });
    return false;
  }

  const config: AntlerConfig = { github: { repository: ownerRepo } };
  const result = await saveConfig(config);

  if (result.ok) {
    logProject("info", "Saved repository to global config", { repository: ownerRepo });
    return true;
  } else {
    logProject("error", "Failed to save repository to global config", { error: result.error.message });
    return false;
  }
}

/**
 * Get project information for a given path
 */
export async function getProjectInfo(path: string): Promise<ProjectResult<ProjectInfo>> {
  logProject("debug", "Getting project info", { path });

  try {
    const pathExists = await exists(path);
    if (!pathExists) {
      return err(createProjectError("path_not_found", "Path does not exist", path));
    }

    const isGitRepo = await isGitRepository(path);
    const name = path.split("/").pop() ?? "Unknown";

    const info: ProjectInfo = Object.freeze({
      path,
      name,
      isGitRepo,
    });

    logProject("debug", "Project info retrieved", { name, isGitRepo });
    return ok(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProject("error", "Failed to get project info", { path, error: message });
    return err(createProjectError("read_failed", "Failed to get project info", message));
  }
}

// ============================================================================
// Folder Picker (Shared)
// ============================================================================

/**
 * Open native folder picker dialog with custom title
 */
async function openFolderPicker(title: string): Promise<ProjectResult<string>> {
  logProject("debug", "Opening folder picker dialog", { title });

  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title,
    });

    if (!selected) {
      logProject("debug", "Folder picker cancelled", { title });
      return err(createProjectError("dialog_cancelled", "Folder selection was cancelled"));
    }

    // Handle array result (shouldn't happen with multiple: false, but be safe)
    const path = Array.isArray(selected) ? selected[0] : selected;

    logProject("info", "Folder selected", { path, title });
    return ok(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProject("error", "Folder picker failed", { title, error: message });
    return err(createProjectError("dialog_failed", "Failed to open folder picker", message));
  }
}

// ============================================================================
// Project Picker
// ============================================================================

/**
 * Open native folder picker dialog for project selection
 */
export async function openProjectPicker(): Promise<ProjectResult<string>> {
  return openFolderPicker("Select Project Directory");
}

// ============================================================================
// Project Management
// ============================================================================

/**
 * Set the current project and update recent projects list
 */
export async function setCurrentProject(path: string): Promise<ProjectResult<ProjectInfo>> {
  logProject("info", "Setting current project", { path });

  // Validate the project
  const infoResult = await getProjectInfo(path);
  if (!infoResult.ok) {
    return infoResult;
  }

  // Ensure it's a git repository
  if (!infoResult.value.isGitRepo) {
    logProject("warn", "Selected path is not a git repository", { path });
    return err(createProjectError("not_git_repo", "Selected path is not a git repository"));
  }

  // Auto-detect repository from git remote and save to global config
  await detectAndSaveRepository(path);

  // Load current settings
  const settingsResult = await getCachedProjectSettings();
  if (!settingsResult.ok) {
    return err(settingsResult.error);
  }

  const settings = settingsResult.value;

  // Update recent projects list (add current, remove duplicates, limit size)
  const updatedRecents = [
    path,
    ...settings.recentProjects.filter(p => p !== path),
  ].slice(0, MAX_RECENT_PROJECTS);

  // Save updated settings
  const newSettings: ProjectSettings = Object.freeze({
    currentProject: path,
    recentProjects: Object.freeze(updatedRecents),
  });

  const saveResult = await saveProjectSettings(newSettings);
  if (!saveResult.ok) {
    return err(saveResult.error);
  }

  logProject("info", "Current project set successfully", { path, name: infoResult.value.name });
  return ok(infoResult.value);
}

/**
 * Remove a project from the recent projects list
 */
export async function removeFromRecentProjects(path: string): Promise<ProjectResult<void>> {
  logProject("debug", "Removing from recent projects", { path });

  const settingsResult = await getCachedProjectSettings();
  if (!settingsResult.ok) {
    return err(settingsResult.error);
  }

  const settings = settingsResult.value;
  const updatedRecents = settings.recentProjects.filter(p => p !== path);

  const newSettings: ProjectSettings = Object.freeze({
    currentProject: settings.currentProject === path ? null : settings.currentProject,
    recentProjects: Object.freeze(updatedRecents),
  });

  return await saveProjectSettings(newSettings);
}

// ============================================================================
// Clone Repository
// ============================================================================

/**
 * Clone a GitHub repository
 */
export async function cloneRepository(
  repoUrl: string,
  targetDir: string
): Promise<ProjectResult<string>> {
  logProject("info", "Cloning repository", { repoUrl, targetDir });

  try {
    // Normalize repo URL - support both full URLs and owner/repo format
    let gitUrl = repoUrl;
    if (!repoUrl.startsWith("http") && !repoUrl.startsWith("git@")) {
      // Assume owner/repo format
      gitUrl = `https://github.com/${repoUrl}.git`;
    }

    const command = Command.create("run-git", ["clone", gitUrl, targetDir]);
    const output = await command.execute();

    if (output.code !== 0) {
      logProject("error", "Clone failed", { stderr: output.stderr });
      return err(createProjectError(
        "clone_failed",
        "Failed to clone repository",
        output.stderr.trim()
      ));
    }

    // Save the repository to global config
    const ownerRepo = extractOwnerRepo(repoUrl);
    if (ownerRepo) {
      const config: AntlerConfig = { github: { repository: ownerRepo } };
      await saveConfig(config);
      logProject("info", "Saved repository to global config", { repository: ownerRepo });
    }

    logProject("info", "Repository cloned successfully", { path: targetDir });
    return ok(targetDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logProject("error", "Clone error", { error: message });
    return err(createProjectError("clone_failed", "Failed to clone repository", message));
  }
}

/**
 * Open folder picker for clone destination
 */
export async function selectCloneDestination(): Promise<ProjectResult<string>> {
  return openFolderPicker("Select Clone Destination");
}
