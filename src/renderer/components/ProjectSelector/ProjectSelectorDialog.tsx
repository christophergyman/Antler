/**
 * ProjectSelectorDialog Component
 * Modal for selecting or cloning a project repository
 */

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { CloneRepositoryDialog } from "./CloneRepositoryDialog";
import type { UseProjectSelectorReturn } from "../../hooks/useProjectSelector";

interface ProjectSelectorDialogProps {
  isOpen: boolean;
  projectSelector: UseProjectSelectorReturn;
  onProjectSelected: () => void;
  onClose?: () => void;
  allowClose?: boolean;
}

export function ProjectSelectorDialog({
  isOpen,
  projectSelector,
  onProjectSelected,
  onClose,
  allowClose = false,
}: ProjectSelectorDialogProps) {
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const { settings, error, selectProject, selectRecentProject, removeRecent, cloneAndSelect } = projectSelector;

  // Handle Escape key - inline handler to prevent re-registration on every render
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && allowClose && onClose) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, allowClose, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOpenFolder = async () => {
    setIsSelecting(true);
    const success = await selectProject();
    setIsSelecting(false);
    if (success) {
      onProjectSelected();
    }
  };

  const handleSelectRecent = async (path: string) => {
    setIsSelecting(true);
    const success = await selectRecentProject(path);
    setIsSelecting(false);
    if (success) {
      onProjectSelected();
    }
  };

  const handleRemoveRecent = async (event: React.MouseEvent, path: string) => {
    event.stopPropagation();
    await removeRecent(path);
  };

  const handleCloneComplete = () => {
    setShowCloneDialog(false);
    onProjectSelected();
  };

  // Filter recent projects to exclude current (for display purposes)
  const recentProjects = settings?.recentProjects.filter(
    (p) => p !== settings.currentProject
  ) ?? [];

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-selector-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div className="w-full max-w-md bg-gray-50 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h1 id="project-selector-title" className="text-lg font-semibold text-gray-900">Select Project</h1>
            {allowClose && onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              Choose a git repository to manage with Antler.
            </p>

            {/* Error display */}
            {error && (
              <div role="alert" className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleOpenFolder}
                disabled={isSelecting}
                className="flex-1"
              >
                {isSelecting ? (
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                )}
                Open Folder
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCloneDialog(true)}
                disabled={isSelecting}
                className="flex-1"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Clone Repository
              </Button>
            </div>

            {/* Recent projects */}
            {recentProjects.length > 0 && (
              <div className="pt-2">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Projects</h3>
                <div className="space-y-1">
                  {recentProjects.map((path) => {
                    const name = path.split("/").pop() ?? path;
                    return (
                      <button
                        key={path}
                        onClick={() => handleSelectRecent(path)}
                        disabled={isSelecting}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg
                            className="h-4 w-4 text-gray-400 flex-shrink-0"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                          <span className="font-medium text-gray-900 truncate">{name}</span>
                        </div>
                        <button
                          onClick={(e) => handleRemoveRecent(e, path)}
                          className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${name} from recent projects`}
                        >
                          <svg
                            className="h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clone Repository Dialog */}
      <CloneRepositoryDialog
        isOpen={showCloneDialog}
        onClose={() => setShowCloneDialog(false)}
        onCloneAndSelect={cloneAndSelect}
        onComplete={handleCloneComplete}
      />
    </>
  );
}
