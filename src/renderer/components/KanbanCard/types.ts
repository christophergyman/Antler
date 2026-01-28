import type { WorktreeOperation } from '@core/types/card';

export interface KanbanCardProps {
  title: string;
  description: string;
  labels?: readonly string[];
  hasError?: boolean;
  isDragging?: boolean;
  // Worktree state
  worktreeOperation?: WorktreeOperation;
  worktreeError?: string | null;
  worktreeCreated?: boolean;
  port?: number | null;
}
