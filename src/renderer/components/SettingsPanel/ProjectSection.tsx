/**
 * ProjectSection Component
 * Shows current project and allows changing it
 */

import { useState } from "react";
import { SettingsRow } from "./SettingsRow";
import { Button } from "../ui/button";
import { ProjectSelectorDialog } from "../ProjectSelector";
import { useProjectSelector } from "../../hooks/useProjectSelector";
import type { StatusIndicator } from "./types";

interface ProjectSectionProps {
  onProjectChange?: () => void;
}

export function ProjectSection({ onProjectChange }: ProjectSectionProps) {
  const [showSelector, setShowSelector] = useState(false);
  const projectSelector = useProjectSelector();

  const { currentProjectInfo, isLoading, hasProject } = projectSelector;

  let status: StatusIndicator;
  let statusText: string;

  if (isLoading) {
    status = "loading";
    statusText = "Loading...";
  } else if (!hasProject) {
    status = "warning";
    statusText = "Not selected";
  } else if (currentProjectInfo?.isGitRepo) {
    status = "success";
    statusText = "Git repo";
  } else {
    status = "warning";
    statusText = "Not a git repo";
  }

  const projectName = currentProjectInfo?.name ?? "No project selected";
  const projectPath = currentProjectInfo?.path ?? "";

  const description = hasProject && projectPath
    ? projectPath
    : "Select a project directory to manage with Antler";

  const handleProjectSelected = () => {
    setShowSelector(false);
    onProjectChange?.();
  };

  return (
    <>
      <SettingsRow
        title={projectName}
        description={description}
        status={status}
        statusText={statusText}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSelector(true)}
        >
          {hasProject ? "Change" : "Select"}
        </Button>
      </SettingsRow>

      <ProjectSelectorDialog
        isOpen={showSelector}
        projectSelector={projectSelector}
        onProjectSelected={handleProjectSelected}
        onClose={() => setShowSelector(false)}
        allowClose={true}
      />
    </>
  );
}
