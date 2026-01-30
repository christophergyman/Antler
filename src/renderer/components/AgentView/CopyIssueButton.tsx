/**
 * CopyIssueButton Component
 * Copies GitHub issue details to clipboard for pasting into Claude Code
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Copy, Check, X } from "lucide-react";
import type { GitHubInfo } from "@core/types";
import { formatIssueAsClaudePrompt } from "@services/claudePrompt";
import { logUserAction } from "@services/logging";

interface CopyIssueButtonProps {
  github: GitHubInfo;
}

export const CopyIssueButton = memo(function CopyIssueButton({
  github,
}: CopyIssueButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Reset states
    setError(false);
    setCopied(false);

    const content = formatIssueAsClaudePrompt(github);

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      logUserAction("copy_issue_clipboard", "Issue copied to clipboard", {
        issueNumber: github.issueNumber,
        contentLength: content.length,
        success: true,
      });
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setError(true);
      logUserAction("copy_issue_clipboard", "Failed to copy issue to clipboard", {
        issueNumber: github.issueNumber,
        error: err instanceof Error ? err.message : String(err),
        success: false,
      });
      timeoutRef.current = setTimeout(() => setError(false), 1500);
    }
  }, [github]);

  if (github.issueNumber === null) return null;

  const label = error
    ? "Failed to copy"
    : copied
      ? "Copied to clipboard"
      : "Copy issue to clipboard";

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-[#3d3d3d] transition-colors text-gray-400 hover:text-gray-200"
      title={label}
      aria-label={label}
    >
      {error ? (
        <X className="w-4 h-4 text-red-400" />
      ) : copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
});
