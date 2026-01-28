/**
 * SettingsPanel Component
 * Main overlay panel with grouped sections in Linear style
 */

import { useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import type { SettingsPanelProps } from "./types";
import { SettingsGroup } from "./SettingsGroup";
import { GitRepoSection } from "./GitRepoSection";
import { AntlerConfigSection } from "./AntlerConfigSection";
import { GitHubAuthSection } from "./GitHubAuthSection";
import { ProjectSection } from "./ProjectSection";
import { TerminalSettingsSection } from "./TerminalSettingsSection";
import { useSettings } from "../../hooks/useSettings";

export function SettingsPanel({ isOpen, onClose, onConfigChange }: SettingsPanelProps) {
  const settings = useSettings();

  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  // Refresh settings when panel opens
  useEffect(() => {
    if (isOpen) {
      settings.refresh();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleConfigChange = () => {
    settings.refresh();
    onConfigChange?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-xl bg-gray-50 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-gray-500 hover:text-gray-700"
            aria-label="Close settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Project Group */}
          <SettingsGroup title="Project">
            <ProjectSection onProjectChange={handleConfigChange} />
          </SettingsGroup>

          {/* GitHub Group */}
          <SettingsGroup title="GitHub">
            <AntlerConfigSection
              hasConfig={settings.hasAntlerConfig}
              configContent={settings.antlerConfigContent}
              configPath={settings.antlerConfigPath}
              onSave={async (content) => {
                await settings.saveAntlerConfig(content);
                handleConfigChange();
              }}
            />
            <div className="px-4 py-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Config Location</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Settings stored in app data directory</p>
                </div>
                <Button variant="outline" size="sm" onClick={settings.revealConfig}>
                  Reveal in Finder
                </Button>
              </div>
            </div>
            <GitHubAuthSection
              isAuthenticated={settings.isGitHubAuthenticated}
              username={settings.gitHubUsername}
              isLoading={settings.isCheckingAuth}
              onAuthChange={settings.refresh}
            />
          </SettingsGroup>

          {/* Development Environment Group */}
          <SettingsGroup title="Development Environment">
            <GitRepoSection isGitRepo={settings.isGitRepo} />
          </SettingsGroup>

          {/* Terminal Settings Group */}
          <SettingsGroup title="Terminal">
            <TerminalSettingsSection
              terminalApp={settings.terminalApp}
              postOpenCommand={settings.postOpenCommand}
              onSave={settings.saveTerminalSettings}
            />
          </SettingsGroup>
        </div>
      </div>
    </div>
  );
}
