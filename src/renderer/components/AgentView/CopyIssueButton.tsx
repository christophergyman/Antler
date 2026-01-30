/**
 * CopyIssueButton Component
 * Copies GitHub issue details to clipboard for pasting into Claude Code
 */

import { memo, useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
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

  const handleCopy = useCallback(async () => {
    const content = formatIssueAsClaudePrompt(github);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      logUserAction("copy_issue_clipboard", "Issue copied to clipboard", {
        issueNumber: github.issueNumber,
      });
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      logUserAction("copy_issue_clipboard", "Failed to copy", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [github]);

  if (github.issueNumber === null) return null;

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-[#3d3d3d] transition-colors text-gray-400 hover:text-gray-200"
      title={copied ? "Copied!" : "Copy issue to clipboard"}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
});
