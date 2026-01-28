import { memo } from "react";
import type { Card } from "@core/types";
import { useTerminal } from "../../hooks/useTerminal";
import { Badge } from "../ui/badge";

interface TerminalContainerProps {
  card: Card;
  isVisible: boolean;
}

const STATUS_COLORS = {
  starting: "#f59e0b",
  running: "#10b981",
  stopped: "#6b7280",
  error: "#ef4444",
};

export const TerminalContainer = memo(function TerminalContainer({
  card,
  isVisible,
}: TerminalContainerProps) {
  const { containerRef, status, error } = useTerminal({
    worktreePath: card.worktreePath ?? "",
    port: card.port,
    autoStart: true,
  });

  const issueNumber = card.github.issueNumber;
  const title = card.github.title;

  return (
    <div
      className="h-full flex flex-col rounded-lg border bg-[#1e1e1e] overflow-hidden"
      style={{ display: isVisible ? "flex" : "none" }}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-2 text-sm text-gray-400 font-mono truncate max-w-[300px]">
            {issueNumber ? `#${issueNumber} - ` : ""}
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {card.port && (
            <span className="text-xs text-gray-500 font-mono">
              PORT={card.port}
            </span>
          )}
          <Badge
            className="text-xs text-white"
            style={{ backgroundColor: STATUS_COLORS[status] }}
          >
            {status}
          </Badge>
        </div>
      </div>

      {/* Terminal content */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ padding: "4px" }}
      />

      {/* Error display */}
      {error && status === "error" && (
        <div className="px-4 py-2 bg-red-900/50 border-t border-red-700 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  );
});
