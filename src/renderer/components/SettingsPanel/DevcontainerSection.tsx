/**
 * DevcontainerSection Component
 * Shows if .devcontainer/devcontainer.json exists
 */

import { SettingsRow } from "./SettingsRow";
import type { StatusIndicator } from "./types";

interface DevcontainerSectionProps {
  hasConfig: boolean | null;
}

export function DevcontainerSection({ hasConfig }: DevcontainerSectionProps) {
  let status: StatusIndicator;
  let statusText: string;

  if (hasConfig === null) {
    status = "loading";
    statusText = "Checking...";
  } else if (hasConfig) {
    status = "success";
    statusText = "Found";
  } else {
    status = "warning";
    statusText = "Not found";
  }

  const description = hasConfig
    ? "Devcontainer config found at .devcontainer/devcontainer.json"
    : "No devcontainer.json found, will use local environment";

  return (
    <SettingsRow
      title="Devcontainer"
      description={description}
      status={status}
      statusText={statusText}
    />
  );
}
