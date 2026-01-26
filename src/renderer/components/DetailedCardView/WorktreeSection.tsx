/**
 * WorktreeSection Component
 * Read-only display of worktree and devcontainer status
 */

import { memo } from "react";
import { Badge } from "../ui/badge";
import type { WorktreeSectionProps } from "./types";

export const WorktreeSection = memo(function WorktreeSection({
  worktreeCreated,
  worktreePath,
  devcontainerRunning,
  devcontainerPort,
}: WorktreeSectionProps) {
  if (!worktreeCreated) {
    return (
      <div className="text-sm text-gray-500 italic">No active work session</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge className="bg-purple-100 text-purple-800">Worktree Active</Badge>
        {devcontainerRunning && (
          <Badge className="bg-cyan-100 text-cyan-800">
            Devcontainer: Port {devcontainerPort}
          </Badge>
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
