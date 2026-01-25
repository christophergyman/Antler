/**
 * DockerSection Component
 * Shows Docker/Colima runtime status with action button
 */

import { useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { SettingsRow } from "./SettingsRow";
import { Button } from "../ui/button";
import type { StatusIndicator } from "./types";
import type { DockerRuntimeStatus } from "@services/dockerRuntime";
import { ensureDockerRuntime } from "@services/dockerRuntime";

interface DockerSectionProps {
  status: DockerRuntimeStatus;
  isLoading: boolean;
  onStatusChange: () => void;
}

export function DockerSection({ status, isLoading, onStatusChange }: DockerSectionProps) {
  const isMacOS = platform() === "macos";
  const [isStarting, setIsStarting] = useState(false);

  let indicator: StatusIndicator;
  let statusText: string;

  if (isLoading || status === "checking") {
    indicator = "loading";
    statusText = "Checking...";
  } else if (status === "starting") {
    indicator = "loading";
    statusText = "Starting...";
  } else if (status === "ready") {
    indicator = "success";
    statusText = "Running";
  } else if (status === "failed") {
    indicator = "error";
    statusText = "Not running";
  } else {
    indicator = "warning";
    statusText = "Unknown";
  }

  const handleStartColima = async () => {
    setIsStarting(true);
    await ensureDockerRuntime();
    setIsStarting(false);
    onStatusChange();
  };

  const showStartButton = isMacOS && (status === "failed" || status === "unknown");

  const description = status === "ready"
    ? "Docker runtime available for devcontainer sessions"
    : isMacOS
    ? "Start Colima for devcontainer support"
    : "Start Docker Desktop for devcontainer support";

  return (
    <SettingsRow
      title="Docker / Colima"
      description={description}
      status={indicator}
      statusText={statusText}
    >
      {showStartButton && (
        <Button
          onClick={handleStartColima}
          disabled={isStarting}
          variant="outline"
          size="sm"
          className="h-8"
        >
          {isStarting ? "Starting..." : "Start"}
        </Button>
      )}
    </SettingsRow>
  );
}
