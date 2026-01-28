/**
 * TerminalSettingsSection Component
 * Settings for configuring terminal app and post-open command
 */

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { logConfig, logUserAction } from "@services/logging";

interface TerminalSettingsSectionProps {
  terminalApp: string | null;
  postOpenCommand: string | null;
  autoPromptClaude: boolean | null;
  claudeStartupDelay: number | null;
  onSave: (app: string, command: string, autoPromptClaude: boolean, claudeStartupDelay: number) => Promise<void>;
}

export function TerminalSettingsSection({
  terminalApp,
  postOpenCommand,
  autoPromptClaude: autoPromptClaudeProp,
  claudeStartupDelay: claudeStartupDelayProp,
  onSave,
}: TerminalSettingsSectionProps) {
  const [app, setApp] = useState("");
  const [command, setCommand] = useState("");
  const [autoPromptClaude, setAutoPromptClaude] = useState(false);
  const [claudeStartupDelay, setClaudeStartupDelay] = useState(2500);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize from props
  useEffect(() => {
    setApp(terminalApp ?? "");
    setCommand(postOpenCommand ?? "");
    setAutoPromptClaude(autoPromptClaudeProp ?? false);
    setClaudeStartupDelay(claudeStartupDelayProp ?? 2500);
  }, [terminalApp, postOpenCommand, autoPromptClaudeProp, claudeStartupDelayProp]);

  const hasChanges =
    app !== (terminalApp ?? "") ||
    command !== (postOpenCommand ?? "") ||
    autoPromptClaude !== (autoPromptClaudeProp ?? false) ||
    claudeStartupDelay !== (claudeStartupDelayProp ?? 2500);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    logUserAction("settings_save", "Saving terminal settings", {
      app: app || "(default)",
      hasCommand: Boolean(command),
      autoPromptClaude,
      claudeStartupDelay,
    });

    try {
      await onSave(app, command, autoPromptClaude, claudeStartupDelay);
      setSaveSuccess(true);
      logUserAction("settings_save", "Terminal settings saved successfully", {
        app: app || "(default)",
        hasCommand: Boolean(command),
        autoPromptClaude,
        claudeStartupDelay,
      });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logConfig("error", "Failed to save terminal settings", { error: message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium text-gray-900">Terminal Settings</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure the terminal app for opening worktrees
        </p>
      </div>

      {/* Terminal App Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="terminal-app"
          className="block text-sm font-medium text-gray-700"
        >
          Terminal Application
        </label>
        <input
          id="terminal-app"
          type="text"
          value={app}
          onChange={(e) => {
            setApp(e.target.value);
            setSaveSuccess(false);
          }}
          placeholder="Terminal (default)"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
        />
        <p className="text-xs text-gray-500">
          App name (e.g., "iTerm") or path (e.g., "/Applications/iTerm.app")
        </p>
      </div>

      {/* Post-Open Command Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="post-open-command"
          className="block text-sm font-medium text-gray-700"
        >
          Post-Open Command
        </label>
        <input
          id="post-open-command"
          type="text"
          value={command}
          onChange={(e) => {
            setCommand(e.target.value);
            setSaveSuccess(false);
          }}
          placeholder="Optional command to run after opening"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
        />
        <p className="text-xs text-gray-500">
          Command to run in the terminal (e.g., "bun run dev")
        </p>
      </div>

      {/* Auto-Prompt Claude Checkbox */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <input
            id="auto-prompt-claude"
            type="checkbox"
            checked={autoPromptClaude}
            onChange={(e) => {
              setAutoPromptClaude(e.target.checked);
              setSaveSuccess(false);
            }}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor="auto-prompt-claude"
            className="text-sm font-medium text-gray-700"
          >
            Auto-prompt Claude with Issue
          </label>
        </div>
        <p className="text-xs text-gray-500 ml-6">
          When opening terminal, automatically run Claude Code with the full GitHub issue context in plan mode
        </p>
      </div>

      {/* Claude Startup Delay (shown only when auto-prompt is enabled) */}
      {autoPromptClaude && (
        <div className="space-y-1.5 ml-6">
          <label
            htmlFor="claude-startup-delay"
            className="block text-sm font-medium text-gray-700"
          >
            Claude Startup Delay (ms)
          </label>
          <input
            id="claude-startup-delay"
            type="number"
            value={claudeStartupDelay}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value >= 500 && value <= 10000) {
                setClaudeStartupDelay(value);
                setSaveSuccess(false);
              }
            }}
            min={500}
            max={10000}
            step={100}
            className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
          />
          <p className="text-xs text-gray-500">
            Time to wait for Claude to initialize before pasting the prompt (500-10000ms)
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          size="sm"
          className={`h-8 ${saveSuccess ? "bg-green-600 hover:bg-green-700" : ""}`}
        >
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
