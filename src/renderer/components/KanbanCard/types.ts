import type { StatusType } from '../../constants/status';

export interface KanbanCardProps {
  title: string;
  description: string;
  status: StatusType;
  labels?: readonly string[];
}
