import { memo } from "react";
import type { Card, AgentStatus } from "@core/types";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

// Agent status colors
const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  starting: "#f59e0b", // Amber
  running: "#10b981", // Green
  stopped: "#6b7280", // Gray
  error: "#ef4444", // Red
};

interface AgentCardItemProps {
  card: Card;
  isSelected: boolean;
  agentStatus?: AgentStatus;
  onSelect: () => void;
}

export const AgentCardItem = memo(function AgentCardItem({
  card,
  isSelected,
  agentStatus,
  onSelect,
}: AgentCardItemProps) {
  const issueNumber = card.github.issueNumber;
  const title = card.github.title;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "bg-accent border-accent-foreground/20 shadow-sm"
          : "bg-card border-border hover:border-accent-foreground/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Issue number and title */}
          <div className="flex items-center gap-1.5 text-sm">
            {issueNumber && (
              <span className="text-muted-foreground font-mono">
                #{issueNumber}
              </span>
            )}
            <span className="font-medium truncate">{title}</span>
          </div>

          {/* Port info */}
          {card.port && (
            <div className="mt-1 text-xs text-muted-foreground">
              Port {card.port}
            </div>
          )}
        </div>

        {/* Agent status indicator */}
        {agentStatus && (
          <Badge
            className="text-xs text-white flex-shrink-0"
            style={{ backgroundColor: AGENT_STATUS_COLORS[agentStatus] }}
          >
            {agentStatus === "starting" && (
              <span className="animate-pulse mr-1">●</span>
            )}
            {agentStatus === "running" && <span className="mr-1">●</span>}
            {agentStatus}
          </Badge>
        )}
      </div>
    </button>
  );
});
