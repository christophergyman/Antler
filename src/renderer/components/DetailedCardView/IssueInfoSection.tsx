/**
 * IssueInfoSection Component
 * Editable title and body fields for the issue
 */

import { memo } from "react";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import type { IssueInfoSectionProps } from "./types";

export const IssueInfoSection = memo(function IssueInfoSection({
  title,
  body,
  onTitleChange,
  onBodyChange,
}: IssueInfoSectionProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2">
        <Label htmlFor="issue-title" className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Title
        </Label>
        <Input
          id="issue-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full"
          placeholder="Issue title"
        />
      </div>
      <div className="flex flex-col flex-grow mt-4">
        <Label htmlFor="issue-body" className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Description
        </Label>
        <Textarea
          id="issue-body"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="w-full flex-grow min-h-[120px] resize-none"
          placeholder="Issue description (supports markdown)"
        />
      </div>
    </div>
  );
});
