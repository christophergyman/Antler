/**
 * PRInfoSection Component
 * Read-only display of linked PR information
 */

import { memo } from "react";
import { Badge } from "../ui/badge";
import type { PRInfoSectionProps } from "./types";

function getCIBadgeColor(state: string): string {
  switch (state) {
    case "passing":
      return "bg-green-100 text-green-800";
    case "failing":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getPRStateBadgeColor(state: string): string {
  switch (state) {
    case "open":
      return "bg-green-100 text-green-800";
    case "merged":
      return "bg-purple-100 text-purple-800";
    case "closed":
      return "bg-red-100 text-red-800";
    case "draft":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export const PRInfoSection = memo(function PRInfoSection({ pr }: PRInfoSectionProps) {
  if (!pr) {
    return (
      <div className="text-sm text-gray-500 italic">No linked pull request</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          PR #{pr.number}
        </a>
        <Badge className={getPRStateBadgeColor(pr.state)}>{pr.state}</Badge>
        <Badge className={getCIBadgeColor(pr.ci.state)}>
          CI: {pr.ci.state}
          {pr.ci.total > 0 && ` (${pr.ci.passed}/${pr.ci.total})`}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500">Branch:</span>{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">{pr.branchName}</code>
        </div>
        <div>
          <span className="text-gray-500">Base:</span>{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">{pr.baseBranch}</code>
        </div>
      </div>

      {pr.mergeConflicts && (
        <div className="text-sm text-red-600 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Merge conflicts detected
        </div>
      )}

      {pr.reviewers.length > 0 && (
        <div className="text-sm">
          <span className="text-gray-500">Reviewers:</span>{" "}
          {pr.reviewers.join(", ")}
        </div>
      )}
    </div>
  );
});
