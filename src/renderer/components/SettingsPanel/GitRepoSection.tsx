/**
 * GitRepoSection Component
 * Shows if current directory is a git repository
 */

import { SettingsRow } from "./SettingsRow";
import type { StatusIndicator } from "./types";

interface GitRepoSectionProps {
  isGitRepo: boolean | null;
}

export function GitRepoSection({ isGitRepo }: GitRepoSectionProps) {
  let status: StatusIndicator;
  let statusText: string;

  if (isGitRepo === null) {
    status = "loading";
    statusText = "Checking...";
  } else if (isGitRepo) {
    status = "success";
    statusText = "Detected";
  } else {
    status = "error";
    statusText = "Not detected";
  }

  const description = isGitRepo
    ? "Current directory is a valid git repository"
    : "Initialize a git repository to use work sessions";

  return (
    <SettingsRow
      title="Git Repository"
      description={description}
      status={status}
      statusText={statusText}
    />
  );
}
