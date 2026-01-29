/**
 * Claude Prompt Formatter
 * Generates a markdown-formatted prompt from GitHub issue data for Claude Code
 */

import type { GitHubInfo } from "@core/types/github";

/**
 * Format a date string into a human-readable format
 */
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a GitHub issue as a Claude prompt for plan mode
 * Includes all issue data: title, body, labels, comments, linked PR info
 */
export function formatIssueAsClaudePrompt(github: GitHubInfo): string {
  const parts: string[] = [];

  // Header with issue reference
  if (github.issueNumber !== null) {
    parts.push(`# GitHub Issue #${github.issueNumber}`);
  } else {
    parts.push("# GitHub Issue");
  }
  parts.push("");

  // Repository
  if (github.repoOwner && github.repoName) {
    parts.push(`**Repository:** ${github.repoOwner}/${github.repoName}`);
    parts.push("");
  }

  // Title
  parts.push("## Title");
  parts.push(github.title || "(No title)");
  parts.push("");

  // Labels
  if (github.labels.length > 0) {
    parts.push("## Labels");
    parts.push(github.labels.map((l) => `- ${l}`).join("\n"));
    parts.push("");
  }

  // Assignees
  if (github.assignees.length > 0) {
    parts.push("## Assignees");
    parts.push(github.assignees.map((a) => `@${a}`).join(", "));
    parts.push("");
  }

  // Milestone
  if (github.milestone) {
    parts.push("## Milestone");
    parts.push(github.milestone);
    parts.push("");
  }

  // Body/Description
  if (github.body) {
    parts.push("## Description");
    parts.push(github.body);
    parts.push("");
  }

  // Comments
  if (github.comments.length > 0) {
    parts.push(`## Comments (${github.comments.length})`);
    parts.push("");
    for (const comment of github.comments) {
      const date = comment.createdAt ? formatDate(comment.createdAt) : "Unknown date";
      parts.push(`### @${comment.author || "unknown"} (${date})`);
      parts.push(comment.body);
      parts.push("");
    }
  }

  // Linked PR info
  if (github.pr) {
    parts.push(`## Linked PR #${github.pr.number}`);
    parts.push(`- **URL:** ${github.pr.url}`);
    parts.push(`- **State:** ${github.pr.state}`);
    parts.push(`- **Branch:** ${github.pr.branchName} → ${github.pr.baseBranch}`);
    if (github.pr.reviewers.length > 0) {
      parts.push(`- **Reviewers:** ${github.pr.reviewers.join(", ")}`);
    }
    if (github.pr.ci) {
      parts.push(`- **CI Status:** ${github.pr.ci.state} (${github.pr.ci.passed}/${github.pr.ci.total} passed)`);
    }
    if (github.pr.mergeConflicts) {
      parts.push("- **Merge Conflicts:** Yes");
    }
    parts.push("");
  }

  // Linked Issues
  if (github.linkedIssues.length > 0) {
    parts.push("## Linked Issues");
    for (const linked of github.linkedIssues) {
      parts.push(`- ${linked.relationship}: #${linked.issueNumber} (${linked.repoFullName})`);
    }
    parts.push("");
  }

  // Timestamps
  if (github.issueCreatedAt || github.issueUpdatedAt) {
    parts.push("## Timestamps");
    if (github.issueCreatedAt) {
      parts.push(`- Created: ${formatDate(github.issueCreatedAt)}`);
    }
    if (github.issueUpdatedAt) {
      parts.push(`- Updated: ${formatDate(github.issueUpdatedAt)}`);
    }
    parts.push("");
  }

  // Instruction to enter plan mode
  parts.push("---");
  parts.push("");
  parts.push("Please analyze this issue and enter plan mode to design an implementation approach.");

  return parts.join("\n");
}
