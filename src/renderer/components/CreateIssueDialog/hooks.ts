/**
 * CreateIssueDialog Hooks
 * Custom hooks for the create issue dialog component
 */

import { useState, useEffect, useRef } from "react";
import { fetchIssueTemplates, type IssueTemplate } from "@services/github";
import { logDataSync } from "@services/logging";
import type { UseIssueTemplatesResult } from "./types";

/**
 * Hook to fetch issue templates for a repository
 * Caches results to avoid repeated API calls
 */
export function useIssueTemplates(
  repo: string | null,
  isOpen: boolean
): UseIssueTemplatesResult {
  const [templates, setTemplates] = useState<IssueTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, IssueTemplate[]>>(new Map());

  useEffect(() => {
    if (!repo || !isOpen) {
      return;
    }

    // Check cache first
    const cached = cacheRef.current.get(repo);
    if (cached) {
      setTemplates(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    logDataSync("debug", "Fetching issue templates", { repo });

    fetchIssueTemplates(repo)
      .then((result) => {
        if (result.ok) {
          setTemplates(result.value);
          cacheRef.current.set(repo, result.value);
          logDataSync("info", "Issue templates fetched", {
            repo,
            count: result.value.length,
          });
        } else {
          // Log error but don't show to user - templates are optional
          logDataSync("warn", "Failed to fetch issue templates", {
            repo,
            error: result.error.message,
          });
          setTemplates([]);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [repo, isOpen]);

  return { templates, isLoading, error };
}
