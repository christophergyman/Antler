/**
 * AntlerConfigSection Component
 * YAML editor for antler.yaml configuration
 */

import { useState, useEffect, useMemo } from "react";
import { load } from "js-yaml";
import { Button } from "../ui/button";
import type { StatusIndicator } from "./types";

interface AntlerConfigSectionProps {
  hasConfig: boolean | null;
  configContent: string | null;
  configPath: string | null;
  onSave: (content: string) => Promise<void>;
}

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

export function AntlerConfigSection({
  hasConfig,
  configContent,
  configPath,
  onSave,
}: AntlerConfigSectionProps) {
  const [editorContent, setEditorContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize editor content from config
  useEffect(() => {
    if (configContent !== null) {
      setEditorContent(configContent);
    } else if (hasConfig === false) {
      // No config exists, start with minimal template
      setEditorContent(`github:
  repository: ""
`);
    }
  }, [configContent, hasConfig]);

  // Validate YAML and structure
  const yamlValidation = useMemo(() => {
    if (!editorContent.trim()) {
      return { valid: false, error: "Content is empty" };
    }
    try {
      const parsed = load(editorContent);

      // Check basic structure
      if (!parsed || typeof parsed !== "object") {
        return { valid: false, error: "Config must be an object" };
      }

      const config = parsed as { github?: { repository?: unknown } };

      if (!config.github || typeof config.github !== "object") {
        return { valid: false, error: "Missing 'github' section" };
      }

      // Repository can be empty string but must be a string if present
      if (config.github.repository !== undefined && typeof config.github.repository !== "string") {
        return { valid: false, error: "Repository must be a string" };
      }

      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid YAML" };
    }
  }, [editorContent]);

  // Check if content has changed from original
  const hasChanges = configContent !== editorContent;

  const handleSave = async () => {
    if (!yamlValidation.valid) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSave(editorContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Error handling is done by parent
    } finally {
      setIsSaving(false);
    }
  };

  // Status indicator
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

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <h3 className="text-sm font-medium text-gray-900">Antler Configuration</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {configPath
              ? `Editing: ${configPath.replace(/^\/Users\/[^/]+/, "~")}`
              : "Configure GitHub repository for issues and PRs"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-gray-500">{statusText}</span>
          <StatusDot status={status} />
        </div>
      </div>

      {/* YAML Editor */}
      <div className="relative">
        <textarea
          value={editorContent}
          onChange={(e) => {
            setEditorContent(e.target.value);
            setSaveSuccess(false);
          }}
          className={`w-full h-32 p-3 font-mono text-sm rounded-md border resize-none focus:outline-none focus:ring-1 ${
            yamlValidation.valid
              ? "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              : "border-red-300 focus:ring-red-500 focus:border-red-500"
          } bg-gray-50`}
          placeholder="github:
  repository: owner/repo"
          spellCheck={false}
        />
      </div>

      {/* Footer with validation and save */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {yamlValidation.valid ? (
            <span className="text-green-600 flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Valid YAML
            </span>
          ) : (
            <span className="text-red-600 flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {yamlValidation.error}
            </span>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!yamlValidation.valid || !hasChanges || isSaving}
          size="sm"
          className={`h-8 ${saveSuccess ? "bg-green-600 hover:bg-green-700" : ""}`}
        >
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Config"}
        </Button>
      </div>
    </div>
  );
}
