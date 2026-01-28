/**
 * WorktreeSection Component
 * Read-only display of worktree status with terminal action
 */

import { memo, useState, useCallback } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { executeOpen, executeOsascript } from "@services/commandExecutor";
import { getTerminalApp, getPostOpenCommand, getAutoPromptClaude } from "@services/config";
import { buildCommandWithPort } from "@services/port";
import { logUserAction, logPerformance } from "@services/logging";
import { formatIssueAsClaudePrompt } from "@services/claudePrompt";
import { writeTextFile, remove } from "@tauri-apps/plugin-fs";
import { tempDir } from "@tauri-apps/api/path";
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
  port,
  githubInfo,
}: WorktreeSectionProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenTerminal = useCallback(async () => {
    if (!worktreePath) return;

    setIsOpening(true);
    const startTime = performance.now();
    logUserAction("open_terminal", "Opening terminal at worktree", { path: worktreePath, port });

    try {
      const [terminalApp, postOpenCommand, autoPromptClaude] = await Promise.all([
        getTerminalApp(),
        getPostOpenCommand(),
        getAutoPromptClaude(),
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
        // Inject PORT environment variable if we have a port assigned
        const finalCommand = port !== null
          ? buildCommandWithPort(postOpenCommand, port)
          : postOpenCommand;

        const appName = terminalApp || "Terminal";
        const isITerm = appName.toLowerCase().includes("iterm");
        const escapedCommand = escapeAppleScript(finalCommand);

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
            command: finalCommand,
            app: appName,
            isITerm,
            port,
          });
        } else {
          logUserAction("open_terminal", "Terminal command execution failed", {
            command: finalCommand,
            app: appName,
            isITerm,
            error: osascriptResult.error.message,
          });
        }
      }

      // If auto-prompt Claude is enabled, invoke Claude with the issue context
      if (autoPromptClaude && githubInfo && githubInfo.issueNumber !== null) {
        logUserAction("open_terminal", "Auto-prompting Claude with issue context", {
          issueNumber: githubInfo.issueNumber,
        });

        try {
          // Format the issue as a Claude prompt
          const prompt = formatIssueAsClaudePrompt(githubInfo);

          // Write prompt to temp file (avoids escaping issues with special characters)
          const tmpDir = await tempDir();
          const tempFilePath = `${tmpDir}/claude-prompt-${Date.now()}.md`;
          await writeTextFile(tempFilePath, prompt);

          // Build the Claude command that reads from temp file and cleans up
          const claudeCommand = `cat "${tempFilePath}" | claude --print && rm "${tempFilePath}"`;
          const escapedClaudeCommand = escapeAppleScript(claudeCommand);

          const appName = terminalApp || "Terminal";
          const isITerm = appName.toLowerCase().includes("iterm");

          // Small delay to let the terminal settle after previous command
          await new Promise((resolve) => setTimeout(resolve, 500));

          const claudeScript = isITerm
            ? `tell application "iTerm"
                 activate
                 set currentSession to current session of current window
                 tell currentSession
                   write text "${escapedClaudeCommand}"
                 end tell
               end tell`
            : `tell application "Terminal"
                 activate
                 do script "${escapedClaudeCommand}" in front window
               end tell`;

          const claudeResult = await executeOsascript(["-e", claudeScript]);
          if (claudeResult.ok) {
            logUserAction("open_terminal", "Claude invoked with issue context", {
              issueNumber: githubInfo.issueNumber,
              tempFile: tempFilePath,
            });
          } else {
            // Clean up temp file on failure
            try {
              await remove(tempFilePath);
            } catch {
              // Ignore cleanup errors
            }
            logUserAction("open_terminal", "Failed to invoke Claude", {
              error: claudeResult.error.message,
            });
          }
        } catch (claudeError) {
          const message = claudeError instanceof Error ? claudeError.message : String(claudeError);
          logUserAction("open_terminal", "Error setting up Claude prompt", { error: message });
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
  }, [worktreePath, port, githubInfo]);

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
          {port !== null && (
            <Badge className="bg-cyan-100 text-cyan-800">
              Port {port}
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
