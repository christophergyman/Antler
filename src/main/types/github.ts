/**
 * GitHub Types
 * Comprehensive types for GitHub issues, PRs, comments, and relationships
 */

import { CIStatus, createCIStatus } from "./ci";

// ============================================================================
// State Types
// ============================================================================

export type IssueState = "open" | "closed";
export type PRState = "open" | "closed" | "merged" | "draft";
export type IssueRelationship = "blocks" | "blocked_by" | "duplicate" | "related";

// ============================================================================
// Comment
// ============================================================================

export interface GitHubComment {
  readonly id: number;
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function createGitHubComment(partial: Partial<GitHubComment> = {}): GitHubComment {
  const now = new Date().toISOString();
  return Object.freeze({
    id: partial.id ?? 0,
    author: partial.author ?? "",
    body: partial.body ?? "",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  });
}

// ============================================================================
// Linked Issue
// ============================================================================

export interface LinkedIssue {
  readonly issueNumber: number;
  readonly relationship: IssueRelationship;
  readonly repoFullName: string;
}

export function createLinkedIssue(partial: Partial<LinkedIssue> = {}): LinkedIssue {
  return Object.freeze({
    issueNumber: partial.issueNumber ?? 0,
    relationship: partial.relationship ?? "related",
    repoFullName: partial.repoFullName ?? "",
  });
}

// ============================================================================
// Pull Request
// ============================================================================

export interface GitHubPR {
  readonly number: number;
  readonly url: string;
  readonly state: PRState;
  readonly branchName: string;
  readonly baseBranch: string;
  readonly reviewers: readonly string[];
  readonly ci: CIStatus;
  readonly mergeable: boolean | null;
  readonly mergeConflicts: boolean;
}

export function createGitHubPR(partial: Partial<GitHubPR> = {}): GitHubPR {
  return Object.freeze({
    number: partial.number ?? 0,
    url: partial.url ?? "",
    state: partial.state ?? "draft",
    branchName: partial.branchName ?? "",
    baseBranch: partial.baseBranch ?? "main",
    reviewers: Object.freeze([...(partial.reviewers ?? [])]),
    ci: createCIStatus(partial.ci),
    mergeable: partial.mergeable ?? null,
    mergeConflicts: partial.mergeConflicts ?? false,
  });
}

// ============================================================================
// GitHub Info (Main)
// ============================================================================

export interface GitHubInfo {
  // Repository
  readonly repoOwner: string;
  readonly repoName: string;

  // Issue
  readonly issueNumber: number | null;
  readonly title: string;
  readonly body: string;
  readonly state: IssueState;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly milestone: string | null;

  // Pull Request
  readonly pr: GitHubPR | null;

  // Comments
  readonly comments: readonly GitHubComment[];

  // Linked Issues
  readonly linkedIssues: readonly LinkedIssue[];

  // Timestamps
  readonly issueCreatedAt: string | null;
  readonly issueUpdatedAt: string | null;
}

export function createGitHubInfo(partial: Partial<GitHubInfo> = {}): GitHubInfo {
  return Object.freeze({
    // Repository
    repoOwner: partial.repoOwner ?? "",
    repoName: partial.repoName ?? "",

    // Issue
    issueNumber: partial.issueNumber ?? null,
    title: partial.title ?? "",
    body: partial.body ?? "",
    state: partial.state ?? "open",
    labels: Object.freeze([...(partial.labels ?? [])]),
    assignees: Object.freeze([...(partial.assignees ?? [])]),
    milestone: partial.milestone ?? null,

    // Pull Request
    pr: partial.pr ? createGitHubPR(partial.pr) : null,

    // Comments
    comments: Object.freeze((partial.comments ?? []).map(createGitHubComment)),

    // Linked Issues
    linkedIssues: Object.freeze((partial.linkedIssues ?? []).map(createLinkedIssue)),

    // Timestamps
    issueCreatedAt: partial.issueCreatedAt ?? null,
    issueUpdatedAt: partial.issueUpdatedAt ?? null,
  });
}

// ============================================================================
// Update Helpers
// ============================================================================

export function updateGitHubInfo(
  info: GitHubInfo,
  partial: Partial<GitHubInfo>
): GitHubInfo {
  return createGitHubInfo({ ...info, ...partial });
}

export function addComment(info: GitHubInfo, comment: Partial<GitHubComment>): GitHubInfo {
  return createGitHubInfo({
    ...info,
    comments: [...info.comments, createGitHubComment(comment)],
    issueUpdatedAt: new Date().toISOString(),
  });
}

export function addLinkedIssue(info: GitHubInfo, link: Partial<LinkedIssue>): GitHubInfo {
  return createGitHubInfo({
    ...info,
    linkedIssues: [...info.linkedIssues, createLinkedIssue(link)],
  });
}

export function updatePR(info: GitHubInfo, prPartial: Partial<GitHubPR>): GitHubInfo {
  if (!info.pr) {
    return createGitHubInfo({ ...info, pr: createGitHubPR(prPartial) });
  }
  return createGitHubInfo({
    ...info,
    pr: createGitHubPR({ ...info.pr, ...prPartial }),
  });
}
