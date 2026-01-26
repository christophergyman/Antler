/**
 * WorktreeSection Component
 * Read-only display of worktree and devcontainer status with terminal action
 */

import { memo, useState, useCallback } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { executeOpen, executeOsascript } from "@services/commandExecutor";
import { getTerminalApp, getPostOpenCommand } from "@services/config";
import { logUserAction, logPerformance } from "@services/logging";
import type { WorktreeSectionProps } from "./types";

/**
 * Escapes special characters for AppleScript string literals
 */
function escapeAppleScript(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

export const WorktreeSection = memo(function WorktreeSection({
  worktreeCreated,
  worktreePath,
  devcontainerRunning,
  devcontainerPort,
}: WorktreeSectionProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenTerminal = useCallback(async () => {
    if (!worktreePath) return;

    setIsOpening(true);
    const startTime = performance.now();
    logUserAction("open_terminal", "Opening terminal at worktree", { path: worktreePath });

    try {
      const [terminalApp, postOpenCommand] = await Promise.all([
        getTerminalApp(),
        getPostOpenCommand(),
      ]);

      // Build open command args
      const openArgs: string[] = [];
      if (terminalApp) {
        openArgs.push("-a", terminalApp);
      }
      openArgs.push(worktreePath);

      // Open the terminal at the worktree path
      const result = await executeOpen(openArgs);

      if (!result.ok) {
        logUserAction("open_terminal", "Failed to open terminal", {
          error: result.error.message,
          path: worktreePath,
        });
        return;
      }

      // If there's a post-open command, use native terminal APIs to execute it
      if (postOpenCommand) {
        const appName = terminalApp || "Terminal";
        const isITerm = appName.toLowerCase().includes("iterm");
        const escapedCommand = escapeAppleScript(postOpenCommand);

        // Use native terminal APIs instead of unreliable keystroke simulation
        const script = isITerm
          ? `tell application "iTerm"
               activate
               set currentSession to current session of current window
               tell currentSession
                 write text "${escapedCommand}"
               end tell
             end tell`
          : `tell application "Terminal"
               activate
               do script "${escapedCommand}" in front window
             end tell`;

        const osascriptResult = await executeOsascript(["-e", script]);
        if (osascriptResult.ok) {
          logUserAction("open_terminal", "Command executed via native terminal API", {
            command: postOpenCommand,
            app: appName,
            isITerm,
          });
        } else {
          logUserAction("open_terminal", "Terminal command execution failed", {
            command: postOpenCommand,
            app: appName,
            isITerm,
            error: osascriptResult.error.message,
          });
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      logPerformance("Terminal open operation completed", elapsed);
      logUserAction("open_terminal", "Terminal opened successfully", { path: worktreePath, elapsedMs: elapsed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logUserAction("open_terminal", "Error opening terminal", { error: message });
    } finally {
      setIsOpening(false);
    }
  }, [worktreePath]);

  if (!worktreeCreated) {
    return (
      <div className="text-sm text-gray-500 italic">No active work session</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-100 text-purple-800">Worktree Active</Badge>
          {devcontainerRunning && (
            <Badge className="bg-cyan-100 text-cyan-800">
              Devcontainer: Port {devcontainerPort}
            </Badge>
          )}
        </div>
        {worktreePath && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTerminal}
            disabled={isOpening}
            className="h-7 text-xs"
          >
            {isOpening ? "Opening..." : "Open Terminal"}
          </Button>
        )}
      </div>

      {worktreePath && (
        <div className="text-sm">
          <span className="text-gray-500">Path:</span>{" "}
          <code className="bg-gray-100 px-1 rounded text-xs break-all">
            {worktreePath}
          </code>
        </div>
      )}
    </div>
  );
});
