/**
 * SettingsGroup Component
 * Linear-style section group with header and card container
 */

import type { SettingsGroupProps } from "./types";

export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
        {title}
      </h2>
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}
