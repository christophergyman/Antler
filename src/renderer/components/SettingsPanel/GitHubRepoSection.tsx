/**
 * GitHubRepoSection Component
 * Editable input for GitHub repository (owner/repo)
 */

import { useState, useEffect } from "react";
import { SettingsRow } from "./SettingsRow";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { saveConfig } from "@services/config";
import type { StatusIndicator } from "./types";

interface GitHubRepoSectionProps {
  currentRepo: string | null;
  onSave: () => void;
}

const REPO_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

export function GitHubRepoSection({ currentRepo, onSave }: GitHubRepoSectionProps) {
  const [value, setValue] = useState(currentRepo ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update local value when prop changes
  useEffect(() => {
    setValue(currentRepo ?? "");
    setError(null);
    setSuccess(false);
  }, [currentRepo]);

  const isValidFormat = REPO_PATTERN.test(value.trim());
  const hasChanges = value.trim() !== (currentRepo ?? "");

  const handleSave = async () => {
    const trimmedValue = value.trim();

    if (!isValidFormat) {
      setError("Invalid format. Use owner/repo (e.g., facebook/react)");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const result = await saveConfig({
      github: { repository: trimmedValue },
    });

    setIsSaving(false);

    if (result.ok) {
      setSuccess(true);
      onSave();
      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(result.error.message);
    }
  };

  let status: StatusIndicator | undefined;
  let statusText: string | undefined;

  if (currentRepo) {
    status = "success";
    statusText = currentRepo;
  } else {
    status = "warning";
    statusText = "Not configured";
  }

  return (
    <SettingsRow
      title="Repository"
      description="GitHub repository for issues and pull requests"
      status={status}
      statusText={statusText}
    >
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setSuccess(false);
          }}
          placeholder="owner/repo"
          className={`w-40 h-8 text-sm ${error ? "border-red-500" : success ? "border-green-500" : ""}`}
        />
        <Button
          onClick={handleSave}
          disabled={!isValidFormat || !hasChanges || isSaving}
          size="sm"
          className="h-8"
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </SettingsRow>
  );
}
