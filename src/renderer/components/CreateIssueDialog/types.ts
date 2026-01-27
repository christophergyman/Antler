/**
 * CreateIssueDialog Types
 * Type definitions for the create issue dialog and its sub-components
 */

import type { IssueTemplate } from "@services/github";

export interface CreateIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated: (issueNumber: number) => void;
  repo: string;
}

export interface CreateIssueState {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
}

export interface UseIssueTemplatesResult {
  templates: IssueTemplate[];
  isLoading: boolean;
  error: string | null;
}

export interface TemplateSelectorProps {
  templates: IssueTemplate[];
  selectedTemplate: IssueTemplate | null;
  onSelectTemplate: (template: IssueTemplate | null) => void;
  isLoading: boolean;
}
