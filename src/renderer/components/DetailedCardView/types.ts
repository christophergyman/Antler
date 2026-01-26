/**
 * DetailedCardView Types
 * Type definitions for the detailed card view modal and its sub-components
 */

import type { Card } from "@core/types/card";

export interface DetailedCardViewProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdate: (updatedCard: Card) => void;
}

export interface EditState {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
}

export interface RepoMetadata {
  labels: string[];
  collaborators: string[];
  milestones: string[];
}

export interface DetailedCardViewHeaderProps {
  issueNumber: number | null;
  issueState: "open" | "closed";
  onClose: () => void;
}

export interface IssueInfoSectionProps {
  title: string;
  body: string;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
}

export interface MetadataSectionProps {
  labels: string[];
  assignees: string[];
  milestone: string | null;
  availableLabels: string[];
  availableCollaborators: string[];
  availableMilestones: string[];
  onLabelsChange: (labels: string[]) => void;
  onAssigneesChange: (assignees: string[]) => void;
  onMilestoneChange: (milestone: string | null) => void;
  onCreateMilestone: (title: string) => Promise<boolean>;
  isLoadingMetadata: boolean;
}

export interface LabelEditorProps {
  labels: string[];
  availableLabels: string[];
  onChange: (labels: string[]) => void;
}

export interface AssigneeEditorProps {
  assignees: string[];
  availableCollaborators: string[];
  onChange: (assignees: string[]) => void;
}

export interface MilestoneEditorProps {
  milestone: string | null;
  availableMilestones: string[];
  onChange: (milestone: string | null) => void;
  onCreateNew: (title: string) => Promise<boolean>;
}

export interface PRInfoSectionProps {
  pr: Card["github"]["pr"];
}

export interface CommentsSectionProps {
  comments: readonly Card["github"]["comments"][number][];
  onAddComment: (body: string) => Promise<boolean>;
  isAddingComment: boolean;
}

export interface AddCommentFormProps {
  onSubmit: (body: string) => Promise<boolean>;
  isSubmitting: boolean;
}

export interface WorktreeSectionProps {
  worktreeCreated: boolean;
  worktreePath: string | null;
  devcontainerRunning: boolean;
  devcontainerPort: number | null;
}
