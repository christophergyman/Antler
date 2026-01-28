/**
 * DetailedCardView Component
 * Modal displaying full card details with edit capabilities
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "../ui/button";
import { DetailedCardViewHeader } from "./DetailedCardViewHeader";
import { IssueInfoSection } from "./IssueInfoSection";
import { MetadataSection } from "./MetadataSection";
import { PRInfoSection } from "./PRInfoSection";
import { CommentsSection } from "./CommentsSection";
import { WorktreeSection } from "./WorktreeSection";
import { SidebarCard } from "./SidebarCard";
import { updateGitHub } from "@core/card";
import { createGitHubComment } from "@core/types/github";
import {
  updateIssue,
  addIssueComment,
  createMilestone,
} from "@services/github";
import { logUserAction, logDataSync, logPerformance } from "@services/logging";
import { useRepoMetadata } from "./hooks";
import type { DetailedCardViewProps, EditState, RepoMetadata } from "./types";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Efficiently compare two string arrays for equality (order-independent)
 * Uses Set-based comparison instead of JSON.stringify
 */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((item) => setB.has(item));
}


export function DetailedCardView({
  card,
  isOpen,
  onClose,
  onCardUpdate,
}: DetailedCardViewProps) {
  const [editState, setEditState] = useState<EditState | null>(null);
  const [additionalMilestones, setAdditionalMilestones] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  // Compute repo string for metadata fetching
  const repo = card ? `${card.github.repoOwner}/${card.github.repoName}` : null;

  // Fetch repo metadata using extracted hook
  const { metadata: fetchedMetadata, isLoading: isLoadingMetadata } = useRepoMetadata(repo, isOpen);

  // Merge fetched metadata with locally created milestones
  const repoMetadata: RepoMetadata = useMemo(() => ({
    labels: fetchedMetadata.labels,
    collaborators: fetchedMetadata.collaborators,
    milestones: [...fetchedMetadata.milestones, ...additionalMilestones],
  }), [fetchedMetadata, additionalMilestones]);

  // Log modal open/close
  useEffect(() => {
    if (isOpen && card && !wasOpenRef.current) {
      logUserAction("modal_open", "DetailedCardView opened", {
        cardId: card.sessionUid,
        issueNumber: card.github.issueNumber,
      });
    } else if (!isOpen && wasOpenRef.current) {
      logUserAction("modal_close", "DetailedCardView closed", {
        hadUnsavedChanges: editState !== null,
      });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, card, editState]);

  // Initialize edit state when card changes
  useEffect(() => {
    if (card && isOpen) {
      setEditState({
        title: card.github.title,
        body: card.github.body,
        labels: [...card.github.labels],
        assignees: [...card.github.assignees],
        milestone: card.github.milestone,
      });
      setSaveError(null);
      setAdditionalMilestones([]);
    }
  }, [card, isOpen]);

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

  const isDirty = useMemo(() => {
    if (!card || !editState) return false;
    return (
      editState.title !== card.github.title ||
      editState.body !== card.github.body ||
      !arraysEqual(editState.labels, card.github.labels) ||
      !arraysEqual(editState.assignees, card.github.assignees) ||
      editState.milestone !== card.github.milestone
    );
  }, [card, editState]);

  const handleTitleChange = useCallback((title: string) => {
    setEditState((prev) => (prev ? { ...prev, title } : null));
  }, []);

  const handleBodyChange = useCallback((body: string) => {
    setEditState((prev) => (prev ? { ...prev, body } : null));
  }, []);

  const handleLabelsChange = useCallback((labels: string[]) => {
    setEditState((prev) => (prev ? { ...prev, labels } : null));
  }, []);

  const handleAssigneesChange = useCallback((assignees: string[]) => {
    setEditState((prev) => (prev ? { ...prev, assignees } : null));
  }, []);

  const handleMilestoneChange = useCallback((milestone: string | null) => {
    setEditState((prev) => (prev ? { ...prev, milestone } : null));
  }, []);

  const handleCreateMilestone = useCallback(
    async (title: string): Promise<boolean> => {
      if (!card) return false;
      const repoPath = `${card.github.repoOwner}/${card.github.repoName}`;
      const result = await createMilestone(repoPath, title);
      if (result.ok) {
        setAdditionalMilestones((prev) => [...prev, title]);
        logDataSync("info", "Milestone created", { repo: repoPath, title });
        return true;
      }
      logDataSync("error", "Failed to create milestone", { title, error: result.error.message });
      return false;
    },
    [card]
  );

  const handleAddComment = useCallback(
    async (body: string): Promise<boolean> => {
      if (!card || !card.github.issueNumber) return false;

      setIsAddingComment(true);
      const repo = `${card.github.repoOwner}/${card.github.repoName}`;

      try {
        const result = await addIssueComment(repo, card.github.issueNumber, body);
        if (result.ok) {
          // Update card with new comment
          const newComment = createGitHubComment({
            body,
            author: "You", // Will be replaced on next refresh
          });
          const updatedCard = updateGitHub(card, {
            comments: [...card.github.comments, newComment],
          });
          onCardUpdate(updatedCard);
          logUserAction("comment_added", "Comment added to issue", {
            issueNumber: card.github.issueNumber,
          });
          return true;
        }
        logDataSync("error", "Failed to add comment", { error: result.error.message });
        return false;
      } finally {
        setIsAddingComment(false);
      }
    },
    [card, onCardUpdate]
  );

  const handleSave = useCallback(async () => {
    if (!card || !editState || !card.github.issueNumber) return;

    setIsSaving(true);
    setSaveError(null);
    const startTime = performance.now();

    const repoPath = `${card.github.repoOwner}/${card.github.repoName}`;
    const original = card.github;

    // Calculate diff
    const params: Parameters<typeof updateIssue>[2] = {};

    if (editState.title !== original.title) {
      params.title = editState.title;
    }
    if (editState.body !== original.body) {
      params.body = editState.body;
    }

    // Calculate label changes
    const originalLabels = new Set(original.labels);
    const newLabels = new Set(editState.labels);
    const addLabels = editState.labels.filter((l) => !originalLabels.has(l));
    const removeLabels = [...original.labels].filter((l) => !newLabels.has(l));
    if (addLabels.length > 0) params.addLabels = addLabels;
    if (removeLabels.length > 0) params.removeLabels = removeLabels;

    // Calculate assignee changes
    const originalAssignees = new Set(original.assignees);
    const newAssignees = new Set(editState.assignees);
    const addAssignees = editState.assignees.filter((a) => !originalAssignees.has(a));
    const removeAssignees = [...original.assignees].filter((a) => !newAssignees.has(a));
    if (addAssignees.length > 0) params.addAssignees = addAssignees;
    if (removeAssignees.length > 0) params.removeAssignees = removeAssignees;

    // Milestone change
    if (editState.milestone !== original.milestone) {
      params.milestone = editState.milestone;
    }

    logDataSync("debug", "Saving issue changes", {
      issueNumber: card.github.issueNumber,
      changeCount: Object.keys(params).length,
    });

    try {
      const result = await updateIssue(repoPath, card.github.issueNumber, params);
      const elapsed = Math.round(performance.now() - startTime);

      if (result.ok) {
        // Update card with new values
        const updatedCard = updateGitHub(card, {
          title: editState.title,
          body: editState.body,
          labels: editState.labels,
          assignees: editState.assignees,
          milestone: editState.milestone,
          issueUpdatedAt: new Date().toISOString(),
        });
        onCardUpdate(updatedCard);
        logUserAction("card_updated", "Issue updated", {
          issueNumber: card.github.issueNumber,
          changes: Object.keys(params),
        });
        logPerformance("Issue save completed", elapsed, {
          issueNumber: card.github.issueNumber,
        });
        onClose();
      } else {
        logDataSync("error", "Failed to save issue", {
          issueNumber: card.github.issueNumber,
          error: result.error.message,
          elapsed,
        });
        setSaveError(result.error.message);
      }
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logDataSync("error", "Exception while saving issue", {
        issueNumber: card.github.issueNumber,
        error: errorMessage,
        elapsed,
      });
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [card, editState, onCardUpdate, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen || !card) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl md:max-w-4xl bg-gray-50 rounded-xl shadow-xl">
        <DetailedCardViewHeader
          issueNumber={card.github.issueNumber}
          issueState={card.github.state}
          onClose={onClose}
        />

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {/* Two-column layout on md+ */}
          <div className="flex flex-col md:grid md:grid-cols-[1fr_280px] md:gap-6 md:items-stretch">
            {/* Left column: Issue details - flex container to fill height */}
            <div className="flex flex-col">
              {editState && (
                <IssueInfoSection
                  title={editState.title}
                  body={editState.body}
                  onTitleChange={handleTitleChange}
                  onBodyChange={handleBodyChange}
                />
              )}
            </div>

            {/* Right column: Sidebar sections (stacked on mobile) */}
            <div className="space-y-6 mt-6 md:mt-0">
              <SidebarCard title="Metadata">
                {editState && (
                  <MetadataSection
                    labels={editState.labels}
                    assignees={editState.assignees}
                    milestone={editState.milestone}
                    availableLabels={repoMetadata.labels}
                    availableCollaborators={repoMetadata.collaborators}
                    availableMilestones={repoMetadata.milestones}
                    onLabelsChange={handleLabelsChange}
                    onAssigneesChange={handleAssigneesChange}
                    onMilestoneChange={handleMilestoneChange}
                    onCreateMilestone={handleCreateMilestone}
                    isLoadingMetadata={isLoadingMetadata}
                  />
                )}
              </SidebarCard>

              <SidebarCard title="Pull Request">
                <PRInfoSection pr={card.github.pr} />
              </SidebarCard>

              <SidebarCard title="Work Session">
                <WorktreeSection
                  worktreeCreated={card.worktreeCreated}
                  worktreePath={card.worktreePath}
                  port={card.port}
                />
              </SidebarCard>
            </div>
          </div>

          {/* Comments - always full width at bottom */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Comments ({card.github.comments.length})
            </h2>
            <CommentsSection
              comments={card.github.comments}
              onAddComment={handleAddComment}
              isAddingComment={isAddingComment}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div>
            {saveError && (
              <span className="text-sm text-red-600">{saveError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
