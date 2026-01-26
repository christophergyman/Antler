/**
 * GitHubAuthSection Component
 * Shows GitHub authentication status with login button
 */

import { useState } from "react";
import { SettingsRow } from "./SettingsRow";
import { Button } from "../ui/button";
import type { StatusIndicator } from "./types";
import { initiateGitHubAuth } from "@services/github";
import { logUserAction, logDataSync } from "@services/logging";

interface GitHubAuthSectionProps {
  isAuthenticated: boolean | null;
  username: string | null;
  isLoading: boolean;
  onAuthChange: () => void;
}

export function GitHubAuthSection({
  isAuthenticated,
  username,
  isLoading,
  onAuthChange,
}: GitHubAuthSectionProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let status: StatusIndicator;
  let statusText: string;

  if (isLoading) {
    status = "loading";
    statusText = "Checking...";
  } else if (isAuthenticated) {
    status = "success";
    statusText = username ? `@${username}` : "Authenticated";
  } else {
    status = "error";
    statusText = "Not authenticated";
  }

  const handleLogin = async () => {
    logUserAction("github_auth", "User initiated GitHub login");
    setIsAuthenticating(true);
    setError(null);

    const result = await initiateGitHubAuth();

    setIsAuthenticating(false);

    if (result.ok) {
      logDataSync("info", "GitHub authentication successful");
      onAuthChange();
    } else {
      logDataSync("error", "GitHub authentication failed", { error: result.error.message });
      setError(result.error.message);
    }
  };

  const description = isAuthenticated
    ? "Authenticated via GitHub CLI"
    : "Authenticate to fetch issues and PRs";

  return (
    <SettingsRow
      title="Authentication"
      description={description}
      status={status}
      statusText={statusText}
    >
      {!isAuthenticated && !isLoading && (
        <Button
          onClick={handleLogin}
          disabled={isAuthenticating}
          variant="outline"
          size="sm"
          className="h-8"
        >
          {isAuthenticating ? "Authenticating..." : "Login"}
        </Button>
      )}
    </SettingsRow>
  );
}
