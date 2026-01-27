/**
 * CreateIssueDialog Component
 * Modal for creating new GitHub issues with template support
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { MetadataSection } from "../DetailedCardView/MetadataSection";
import { SidebarCard } from "../DetailedCardView/SidebarCard";
import { useRepoMetadata } from "../DetailedCardView/hooks";
import { useIssueTemplates } from "./hooks";
import { createIssue, createMilestone, type IssueTemplate } from "@services/github";
import { logUserAction, logDataSync, logPerformance } from "@services/logging";
import type { CreateIssueDialogProps, CreateIssueState } from "./types";

const INITIAL_STATE: CreateIssueState = {
  title: "",
  body: "",
  labels: [],
  assignees: [],
  milestone: null,
};

export function CreateIssueDialog({
  isOpen,
  onClose,
  onIssueCreated,
  repo,
}: CreateIssueDialogProps) {
  const [formState, setFormState] = useState<CreateIssueState>(INITIAL_STATE);
  const [selectedTemplate, setSelectedTemplate] = useState<IssueTemplate | null>(null);
  const [additionalMilestones, setAdditionalMilestones] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch templates and repo metadata
  const { templates, isLoading: isLoadingTemplates } = useIssueTemplates(repo, isOpen);
  const { metadata: fetchedMetadata, isLoading: isLoadingMetadata } = useRepoMetadata(repo, isOpen);

  // Merge fetched metadata with locally created milestones
  const repoMetadata = useMemo(
    () => ({
      labels: fetchedMetadata.labels,
      collaborators: fetchedMetadata.collaborators,
      milestones: [...fetchedMetadata.milestones, ...additionalMilestones],
    }),
    [fetchedMetadata, additionalMilestones]
  );

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormState(INITIAL_STATE);
      setSelectedTemplate(null);
      setSubmitError(null);
      setAdditionalMilestones([]);
      logUserAction("modal_open", "CreateIssueDialog opened", { repo });
    }
  }, [isOpen, repo]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle template selection
  const handleTemplateSelect = useCallback(
    (template: IssueTemplate | null) => {
      setSelectedTemplate(template);
      if (template) {
        setFormState((prev) => ({
          ...prev,
          body: template.body,
          labels: template.labels ?? prev.labels,
        }));
        logUserAction("template_selected", "Issue template selected", {
          templateName: template.name,
        });
      } else {
        // Reset to blank
        setFormState((prev) => ({
          ...prev,
          body: "",
        }));
      }
    },
    []
  );

  const handleTitleChange = useCallback((title: string) => {
    setFormState((prev) => ({ ...prev, title }));
  }, []);

  const handleBodyChange = useCallback((body: string) => {
    setFormState((prev) => ({ ...prev, body }));
  }, []);

  const handleLabelsChange = useCallback((labels: string[]) => {
    setFormState((prev) => ({ ...prev, labels }));
  }, []);

  const handleAssigneesChange = useCallback((assignees: string[]) => {
    setFormState((prev) => ({ ...prev, assignees }));
  }, []);

  const handleMilestoneChange = useCallback((milestone: string | null) => {
    setFormState((prev) => ({ ...prev, milestone }));
  }, []);

  const handleCreateMilestone = useCallback(
    async (title: string): Promise<boolean> => {
      const result = await createMilestone(repo, title);
      if (result.ok) {
        setAdditionalMilestones((prev) => [...prev, title]);
        logDataSync("info", "Milestone created", { repo, title });
        return true;
      }
      logDataSync("error", "Failed to create milestone", { title, error: result.error.message });
      return false;
    },
    [repo]
  );

  const handleSubmit = useCallback(async () => {
    if (!formState.title.trim()) {
      setSubmitError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const startTime = performance.now();

    try {
      const result = await createIssue(repo, {
        title: formState.title.trim(),
        body: formState.body.trim() || undefined,
        labels: formState.labels.length > 0 ? formState.labels : undefined,
        assignees: formState.assignees.length > 0 ? formState.assignees : undefined,
        milestone: formState.milestone ?? undefined,
      });

      const elapsed = Math.round(performance.now() - startTime);

      if (result.ok) {
        logUserAction("issue_created", "New issue created", {
          issueNumber: result.value.issueNumber,
          repo,
        });
        logPerformance("Issue creation completed", elapsed, {
          issueNumber: result.value.issueNumber,
        });

        if (result.value.issueNumber) {
          onIssueCreated(result.value.issueNumber);
        }
        onClose();
      } else {
        logDataSync("error", "Failed to create issue", {
          repo,
          error: result.error.message,
          elapsed,
        });
        setSubmitError(result.error.message);
      }
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logDataSync("error", "Exception while creating issue", {
        repo,
        error: errorMessage,
        elapsed,
      });
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [formState, repo, onIssueCreated, onClose]);

  const handleCancel = useCallback(() => {
    logUserAction("modal_close", "CreateIssueDialog cancelled", { repo });
    onClose();
  }, [onClose, repo]);

  const isValid = formState.title.trim().length > 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl md:max-w-4xl bg-gray-50 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Issue</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Template Selector */}
        {(templates.length > 0 || isLoadingTemplates) && (
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-100">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Template:
              </Label>
              {isLoadingTemplates ? (
                <div className="h-9 w-48 bg-gray-200 rounded animate-pulse" />
              ) : (
                <select
                  className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedTemplate?.name ?? ""}
                  onChange={(e) => {
                    const template = templates.find((t) => t.name === e.target.value) ?? null;
                    handleTemplateSelect(template);
                  }}
                >
                  <option value="">Blank Issue</option>
                  {templates.map((template) => (
                    <option key={template.name} value={template.name}>
                      {template.name}
                      {template.about ? ` - ${template.about}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          <div className="flex flex-col md:grid md:grid-cols-[1fr_280px] md:gap-6 md:items-stretch">
            {/* Left column: Issue details */}
            <div className="flex flex-col">
              <div className="space-y-2">
                <Label
                  htmlFor="issue-title"
                  className="text-sm font-semibold text-gray-500 uppercase tracking-wide"
                >
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="issue-title"
                  value={formState.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full"
                  placeholder="Issue title"
                  autoFocus
                />
              </div>
              <div className="flex flex-col flex-grow mt-4">
                <Label
                  htmlFor="issue-body"
                  className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2"
                >
                  Description
                </Label>
                <Textarea
                  id="issue-body"
                  value={formState.body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className="w-full flex-grow min-h-[180px] resize-none"
                  placeholder="Issue description (supports markdown)"
                />
              </div>
            </div>

            {/* Right column: Metadata */}
            <div className="space-y-6 mt-6 md:mt-0">
              <SidebarCard title="Metadata">
                <MetadataSection
                  labels={formState.labels}
                  assignees={formState.assignees}
                  milestone={formState.milestone}
                  availableLabels={repoMetadata.labels}
                  availableCollaborators={repoMetadata.collaborators}
                  availableMilestones={repoMetadata.milestones}
                  onLabelsChange={handleLabelsChange}
                  onAssigneesChange={handleAssigneesChange}
                  onMilestoneChange={handleMilestoneChange}
                  onCreateMilestone={handleCreateMilestone}
                  isLoadingMetadata={isLoadingMetadata}
                />
              </SidebarCard>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div>
            {submitError && (
              <span className="text-sm text-red-600">{submitError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
