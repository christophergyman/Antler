/**
 * DevcontainerEditorSection Component
 * JSON editor for devcontainer.json with template presets
 */

import { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { DEVCONTAINER_TEMPLATES } from "../../constants/devcontainerTemplates";
import type { StatusIndicator } from "./types";

interface DevcontainerEditorSectionProps {
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

export function DevcontainerEditorSection({
  hasConfig,
  configContent,
  configPath,
  onSave,
}: DevcontainerEditorSectionProps) {
  const [editorContent, setEditorContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Initialize editor content from config
  useEffect(() => {
    if (configContent !== null) {
      setEditorContent(configContent);
    } else if (hasConfig === false) {
      // No config exists, start with blank template
      const blankTemplate = DEVCONTAINER_TEMPLATES.find((t) => t.id === "blank");
      if (blankTemplate) {
        setEditorContent(blankTemplate.content);
      }
    }
  }, [configContent, hasConfig]);

  // Validate JSON
  const jsonValidation = useMemo(() => {
    if (!editorContent.trim()) {
      return { valid: false, error: "Content is empty" };
    }
    try {
      JSON.parse(editorContent);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [editorContent]);

  // Check if content has changed from original
  const hasChanges = configContent !== editorContent;

  const handleTemplateChange = (templateId: string) => {
    const template = DEVCONTAINER_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setEditorContent(template.content);
      setSelectedTemplate(templateId);
      setSaveSuccess(false);
    }
  };

  const handleSave = async () => {
    if (!jsonValidation.valid) return;

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
          <h3 className="text-sm font-medium text-gray-900">Devcontainer Configuration</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {configPath
              ? `Editing: ${configPath.split("/").slice(-2).join("/")}`
              : "Create or edit devcontainer.json for work sessions"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-gray-500">{statusText}</span>
          <StatusDot status={status} />
        </div>
      </div>

      {/* Template selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Template:</label>
        <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
          <SelectTrigger className="w-40 h-8 text-sm bg-white">
            <SelectValue placeholder="Select template" />
          </SelectTrigger>
          <SelectContent>
            {DEVCONTAINER_TEMPLATES.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-400">
          {selectedTemplate &&
            DEVCONTAINER_TEMPLATES.find((t) => t.id === selectedTemplate)?.description}
        </span>
      </div>

      {/* JSON Editor */}
      <div className="relative">
        <textarea
          value={editorContent}
          onChange={(e) => {
            setEditorContent(e.target.value);
            setSaveSuccess(false);
            setSelectedTemplate(""); // Clear template selection on manual edit
          }}
          className={`w-full h-64 p-3 font-mono text-sm rounded-md border resize-none focus:outline-none focus:ring-1 ${
            jsonValidation.valid
              ? "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              : "border-red-300 focus:ring-red-500 focus:border-red-500"
          } bg-gray-50`}
          placeholder="Enter devcontainer.json content..."
          spellCheck={false}
        />
      </div>

      {/* Footer with validation and save */}
      <div className="flex items-center justify-between">
        <div className="text-sm">
          {jsonValidation.valid ? (
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
              Valid JSON
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
              {jsonValidation.error}
            </span>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!jsonValidation.valid || !hasChanges || isSaving}
          size="sm"
          className={`h-8 ${saveSuccess ? "bg-green-600 hover:bg-green-700" : ""}`}
        >
          {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Config"}
        </Button>
      </div>
    </div>
  );
}
