/**
 * useRepoMetadata Hook
 * Fetches repository metadata (labels, collaborators, milestones) with comprehensive logging
 */

import { useState, useEffect } from "react";
import {
  fetchRepoLabels,
  fetchRepoCollaborators,
  fetchRepoMilestones,
} from "@services/github";
import { logDataSync, logPerformance } from "@services/logging";
import type { RepoMetadata } from "../types";

interface UseRepoMetadataResult {
  metadata: RepoMetadata;
  isLoading: boolean;
  errors: string[];
}

const EMPTY_METADATA: RepoMetadata = {
  labels: [],
  collaborators: [],
  milestones: [],
};

/**
 * Hook to fetch repository metadata when the modal opens
 * Logs all fetch operations and individual failures
 */
export function useRepoMetadata(repo: string | null, isOpen: boolean): UseRepoMetadataResult {
  const [metadata, setMetadata] = useState<RepoMetadata>(EMPTY_METADATA);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!repo || !isOpen) {
      return;
    }

    setIsLoading(true);
    setErrors([]);
    const startTime = performance.now();

    logDataSync("debug", "Fetching repo metadata", { repo });

    Promise.all([
      fetchRepoLabels(repo),
      fetchRepoCollaborators(repo),
      fetchRepoMilestones(repo),
    ])
      .then(([labelsResult, collaboratorsResult, milestonesResult]) => {
        const newErrors: string[] = [];
        const labels = labelsResult.ok ? labelsResult.value : [];
        const collaborators = collaboratorsResult.ok ? collaboratorsResult.value : [];
        const milestones = milestonesResult.ok ? milestonesResult.value : [];

        // Log individual fetch failures
        if (!labelsResult.ok) {
          logDataSync("warn", "Failed to fetch labels", {
            repo,
            error: labelsResult.error.message,
          });
          newErrors.push("labels");
        }
        if (!collaboratorsResult.ok) {
          logDataSync("warn", "Failed to fetch collaborators", {
            repo,
            error: collaboratorsResult.error.message,
          });
          newErrors.push("collaborators");
        }
        if (!milestonesResult.ok) {
          logDataSync("warn", "Failed to fetch milestones", {
            repo,
            error: milestonesResult.error.message,
          });
          newErrors.push("milestones");
        }

        setMetadata({ labels, collaborators, milestones });
        setErrors(newErrors);

        const elapsed = Math.round(performance.now() - startTime);
        logDataSync("info", "Repo metadata loaded", {
          repo,
          labelsCount: labels.length,
          collaboratorsCount: collaborators.length,
          milestonesCount: milestones.length,
          failedFetches: newErrors.length > 0 ? newErrors : undefined,
        });
        logPerformance("Metadata fetch completed", elapsed, { repo });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [repo, isOpen]);

  return { metadata, isLoading, errors };
}
