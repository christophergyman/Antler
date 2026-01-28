import { memo } from "react";
import type { Card } from "@core/types";

interface TerminalPanelProps {
  selectedCard: Card | null;
}

export const TerminalPanel = memo(function TerminalPanel({
  selectedCard,
}: TerminalPanelProps) {
  if (!selectedCard) {
    return (
      <div className="h-full flex items-center justify-center rounded-lg border bg-card">
        <div className="text-center px-8">
          <div className="text-4xl mb-4 opacity-20">{">"}_</div>
          <p className="text-muted-foreground">
            Select a card to view its Claude agent
          </p>
        </div>
      </div>
    );
  }

  const issueNumber = selectedCard.github.issueNumber;
  const title = selectedCard.github.title;

  return (
    <div className="h-full flex flex-col rounded-lg border bg-[#1e1e1e] overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-2 text-sm text-gray-400 font-mono">
            {issueNumber ? `#${issueNumber} - ` : ""}
            {title}
          </span>
        </div>
        {selectedCard.port && (
          <span className="text-xs text-gray-500 font-mono">
            PORT={selectedCard.port}
          </span>
        )}
      </div>

      {/* Terminal content placeholder - will be replaced with xterm.js */}
      <div className="flex-1 p-4 font-mono text-sm text-gray-300 overflow-auto">
        <div className="text-green-400 mb-2">
          $ cd {selectedCard.worktreePath}
        </div>
        <div className="text-green-400 mb-4">$ claude</div>
        <div className="text-gray-500 animate-pulse">
          Terminal integration coming soon...
          <br />
          <br />
          xterm.js + PTY support will be added in the next phase.
        </div>
      </div>
    </div>
  );
});
