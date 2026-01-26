/**
 * CloneRepositoryDialog Component
 * Modal for cloning a GitHub repository
 */

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { selectCloneDestination } from "@services/project";

interface CloneRepositoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCloneAndSelect: (repoUrl: string, parentDir?: string) => Promise<boolean>;
  onComplete: () => void;
}

export function CloneRepositoryDialog({
  isOpen,
  onClose,
  onCloneAndSelect,
  onComplete,
}: CloneRepositoryDialogProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [destination, setDestination] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Escape key - inline handler to prevent re-registration on every render
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCloning) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCloning, onClose]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setRepoUrl("");
      setDestination("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleBrowse = async () => {
    const result = await selectCloneDestination();
    if (result.ok) {
      setDestination(result.value);
    }
  };

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      setError("Please enter a repository URL or owner/repo");
      return;
    }

    if (!destination.trim()) {
      setError("Please select a destination folder");
      return;
    }

    setIsCloning(true);
    setError(null);

    const success = await onCloneAndSelect(repoUrl.trim(), destination);

    setIsCloning(false);

    if (success) {
      onComplete();
    } else {
      setError("Failed to clone repository. Please check the URL and try again.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleClone();
  };

  // Extract expected folder name from repo URL
  const getRepoName = () => {
    if (!repoUrl) return "";
    const name = repoUrl.split("/").pop()?.replace(".git", "") ?? "";
    return name;
  };

  const targetPath = destination && repoUrl ? `${destination}/${getRepoName()}` : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-dialog-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-md bg-gray-50 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h1 id="clone-dialog-title" className="text-lg font-semibold text-gray-900">Clone Repository</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isCloning}
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
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Error display */}
          {error && (
            <div role="alert" className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Repository URL input */}
          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Repository
            </label>
            <input
              id="repoUrl"
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="owner/repo or https://github.com/..."
              disabled={isCloning}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter owner/repo (e.g., facebook/react) or full URL
            </p>
          </div>

          {/* Destination input */}
          <div>
            <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">
              Clone to
            </label>
            <div className="flex gap-2">
              <input
                id="destination"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Select folder..."
                disabled={isCloning}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 cursor-not-allowed"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                disabled={isCloning}
              >
                Browse
              </Button>
            </div>
            {targetPath && (
              <p className="mt-1 text-xs text-gray-500">
                Will clone to: <code className="bg-gray-200 px-1 rounded">{targetPath}</code>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isCloning}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCloning || !repoUrl.trim() || !destination.trim()}
            >
              {isCloning ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Cloning...
                </>
              ) : (
                "Clone"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
