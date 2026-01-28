/**
 * WorktreeSection Component
 * Read-only display of worktree status with terminal action
 */

import { memo, useState, useCallback } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { executeOpen, executeOsascript } from "@services/commandExecutor";
import { getTerminalApp, getPostOpenCommand, getAutoPromptClaude, getClaudeStartupDelay } from "@services/config";
import { buildCommandWithPort } from "@services/port";
import { logUserAction, logPerformance } from "@services/logging";
import { formatIssueAsClaudePrompt } from "@services/claudePrompt";
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

/**
 * Strip trailing 'claude' command from a command string when auto-prompt is enabled.
 * This prevents conflict where a blocking 'claude' would run before the prompt is piped in.
 * Handles: "cmd && claude", "cmd; claude", "cmd && claude ", "claude"
 */
function stripTrailingClaude(command: string): string {
  // Pattern matches: && claude, ; claude, or just claude at the end (with optional whitespace)
  const stripped = command.replace(/(\s*&&\s*claude|\s*;\s*claude|\s+claude)\s*$/i, "").trim();
  // If the entire command was just "claude", return empty string
  if (stripped.toLowerCase() === "claude") {
    return "";
  }
  return stripped;
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
      const [terminalApp, postOpenCommand, autoPromptClaude, claudeStartupDelay] = await Promise.all([
        getTerminalApp(),
        getPostOpenCommand(),
        getAutoPromptClaude(),
        getClaudeStartupDelay(),
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

      const appName = terminalApp || "Terminal";
      const isITerm = appName.toLowerCase().includes("iterm");
      const shouldAutoPrompt = autoPromptClaude && githubInfo && githubInfo.issueNumber !== null;
      let promptContent: string | null = null;

      // Prepare the prompt content if auto-prompt is enabled
      if (shouldAutoPrompt) {
        promptContent = formatIssueAsClaudePrompt(githubInfo);
        logUserAction("open_terminal", "Auto-prompting Claude with issue context", {
          issueNumber: githubInfo.issueNumber,
          promptLength: promptContent.length,
        });

        // Phase 1: Copy prompt to clipboard using AppleScript
        const escapedPrompt = escapeAppleScript(promptContent);
        const clipboardScript = `set the clipboard to "${escapedPrompt}"`;
        const clipboardResult = await executeOsascript(["-e", clipboardScript]);
        if (!clipboardResult.ok) {
          logUserAction("open_terminal", "Failed to copy prompt to clipboard", {
            error: clipboardResult.error.message,
          });
          promptContent = null; // Skip auto-prompt on failure
        }
      }

      // Phase 2: Build and execute the terminal command
      const commandParts: string[] = [];

      // Add post-open command (if configured)
      if (postOpenCommand) {
        // If auto-prompt is enabled, strip any trailing 'claude' from the command
        const baseCommand = shouldAutoPrompt
          ? stripTrailingClaude(postOpenCommand)
          : postOpenCommand;

        if (baseCommand) {
          const finalCommand = port !== null
            ? buildCommandWithPort(baseCommand, port)
            : baseCommand;
          commandParts.push(finalCommand);
          logUserAction("open_terminal", "Post-open command prepared", {
            command: finalCommand,
            originalCommand: postOpenCommand,
            strippedClaude: baseCommand !== postOpenCommand,
            port,
          });
        }
      }

      // Add claude command if auto-prompt is enabled
      if (promptContent) {
        commandParts.push("claude");
      }

      // Execute the command in terminal
      if (commandParts.length > 0) {
        const combinedCommand = commandParts.join(" && ");
        const escapedCommand = escapeAppleScript(combinedCommand);

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
            command: combinedCommand,
            app: appName,
            isITerm,
            port,
          });
        } else {
          logUserAction("open_terminal", "Terminal command execution failed", {
            command: combinedCommand,
            app: appName,
            isITerm,
            error: osascriptResult.error.message,
          });
        }
      }

      // Phase 3: If auto-prompt, wait for Claude to initialize then paste and submit
      if (promptContent) {
        logUserAction("open_terminal", "Waiting for Claude to initialize", {
          delayMs: claudeStartupDelay,
        });

        await new Promise((resolve) => setTimeout(resolve, claudeStartupDelay));

        // Phase 4: Paste from clipboard (Cmd+V) and submit (Enter)
        const pasteScript = isITerm
          ? `tell application "iTerm"
               activate
               tell application "System Events"
                 keystroke "v" using command down
                 delay 0.1
                 keystroke return
               end tell
             end tell`
          : `tell application "Terminal"
               activate
               tell application "System Events"
                 keystroke "v" using command down
                 delay 0.1
                 keystroke return
               end tell
             end tell`;

        const pasteResult = await executeOsascript(["-e", pasteScript]);
        if (pasteResult.ok) {
          logUserAction("open_terminal", "Prompt pasted and submitted to Claude", {
            issueNumber: githubInfo?.issueNumber,
          });
        } else {
          logUserAction("open_terminal", "Failed to paste prompt", {
            error: pasteResult.error.message,
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
