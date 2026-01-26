/**
 * DetailedCardViewHeader Component
 * Title bar with issue number, state badge, and close button
 */

import { memo } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { DetailedCardViewHeaderProps } from "./types";

export const DetailedCardViewHeader = memo(function DetailedCardViewHeader({
  issueNumber,
  issueState,
  onClose,
}: DetailedCardViewHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900">
          {issueNumber ? `Issue #${issueNumber}` : "Card Details"}
        </h1>
        <Badge
          variant={issueState === "open" ? "default" : "secondary"}
          className={
            issueState === "open"
              ? "bg-green-100 text-green-800 hover:bg-green-100"
              : "bg-purple-100 text-purple-800 hover:bg-purple-100"
          }
        >
          {issueState}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-8 w-8 text-gray-500 hover:text-gray-700"
        aria-label="Close details"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </Button>
    </div>
  );
});
