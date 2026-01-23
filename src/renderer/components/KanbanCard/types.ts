export interface KanbanCardProps {
  title: string;
  description: string;
  labels?: readonly string[];
  hasError?: boolean;
  isDragging?: boolean;
}
