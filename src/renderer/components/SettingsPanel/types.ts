/**
 * Settings Panel Types
 */

export type StatusIndicator = "success" | "warning" | "error" | "loading";

export interface SettingsRowProps {
  title: string;
  description: string;
  status?: StatusIndicator;
  statusText?: string;
  children?: React.ReactNode;
  isLast?: boolean;
}

export interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: () => void;
}
