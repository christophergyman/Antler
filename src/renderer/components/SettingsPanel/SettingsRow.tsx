/**
 * SettingsRow Component
 * Linear-style row with title, description, and status/control on the right
 */

import type { SettingsRowProps, StatusIndicator } from "./types";

function StatusDot({ status }: { status: StatusIndicator }) {
  const colors: Record<StatusIndicator, string> = {
    success: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    loading: "bg-blue-500 animate-pulse",
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status]}`}
      aria-hidden="true"
    />
  );
}

export function SettingsRow({
  title,
  description,
  status,
  statusText,
  children,
}: SettingsRowProps) {
  // If there's a control (children), show control on right
  // Otherwise, show status indicator on right
  const showStatusOnRight = !children && status;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">
        {children ? (
          children
        ) : showStatusOnRight ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{statusText}</span>
            <StatusDot status={status} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
