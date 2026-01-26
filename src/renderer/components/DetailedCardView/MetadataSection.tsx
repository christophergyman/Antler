/**
 * MetadataSection Component
 * Collapsible section containing labels, assignees, and milestone editors
 */

import { memo } from "react";
import { Label } from "../ui/label";
import { LabelEditor } from "./LabelEditor";
import { AssigneeEditor } from "./AssigneeEditor";
import { MilestoneEditor } from "./MilestoneEditor";
import type { MetadataSectionProps } from "./types";

export const MetadataSection = memo(function MetadataSection({
  labels,
  assignees,
  milestone,
  availableLabels,
  availableCollaborators,
  availableMilestones,
  onLabelsChange,
  onAssigneesChange,
  onMilestoneChange,
  onCreateMilestone,
  isLoadingMetadata,
}: MetadataSectionProps) {
  if (isLoadingMetadata) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Labels</Label>
        <LabelEditor
          labels={labels}
          availableLabels={availableLabels}
          onChange={onLabelsChange}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Assignees</Label>
        <AssigneeEditor
          assignees={assignees}
          availableCollaborators={availableCollaborators}
          onChange={onAssigneesChange}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Milestone</Label>
        <MilestoneEditor
          milestone={milestone}
          availableMilestones={availableMilestones}
          onChange={onMilestoneChange}
          onCreateNew={onCreateMilestone}
        />
      </div>
    </div>
  );
});
