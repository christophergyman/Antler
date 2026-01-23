export const statusColors = {
  green: '#10b981',
  yellow: '#eab308',
  red: '#ef4444',
} as const;

export const statusLabels = {
  green: 'Healthy',
  yellow: 'Warning',
  red: 'Critical',
} as const;

export type StatusType = keyof typeof statusColors;

// Kanban Board Configuration

export type KanbanColumnId = "idle" | "in_progress" | "waiting" | "done";

export interface KanbanColumnConfig {
  readonly id: KanbanColumnId;
  readonly label: string;
  readonly color: string;
  readonly bgColor: string;
}

export const KANBAN_COLUMNS: readonly KanbanColumnConfig[] = [
  { id: "idle", label: "Idle", color: "#6b7280", bgColor: "#f3f4f6" },
  { id: "in_progress", label: "In Progress", color: "#3b82f6", bgColor: "#eff6ff" },
  { id: "waiting", label: "Waiting", color: "#f59e0b", bgColor: "#fffbeb" },
  { id: "done", label: "Done", color: "#10b981", bgColor: "#ecfdf5" },
] as const;

export const ERROR_BADGE_COLOR = "#ef4444";
