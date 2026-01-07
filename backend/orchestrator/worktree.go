package orchestrator

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// WorktreeManager handles git worktree operations.
type WorktreeManager struct {
	exec         Executor
	projectPath  string
	worktreeBase string
}

// NewWorktreeManager creates a new worktree manager.
func NewWorktreeManager(exec Executor, projectPath, worktreeBase string) *WorktreeManager {
	return &WorktreeManager{
		exec:         exec,
		projectPath:  projectPath,
		worktreeBase: worktreeBase,
	}
}

// CreateWorktree creates a new git worktree and branch for an issue.
// Returns the branch name and worktree path.
func (m *WorktreeManager) CreateWorktree(ctx context.Context, issueNumber int, issueTitle string) (branch, worktreePath string, err error) {
	// Generate branch name: issue-42-add-dark-mode
	branch = m.generateBranchName(issueNumber, issueTitle)

	// Determine worktree path
	worktreePath = filepath.Join(m.worktreeBase, branch)

	// Ensure worktree base directory exists
	if err := os.MkdirAll(m.worktreeBase, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create worktree base directory: %w", err)
	}

	// Check if worktree already exists
	if _, err := os.Stat(worktreePath); err == nil {
		// Worktree exists, verify it's valid
		_, verifyErr := m.exec.RunDir(ctx, worktreePath, "git", "status")
		if verifyErr == nil {
			return branch, worktreePath, nil // Already exists and valid
		}
		// Invalid worktree, remove it
		if err := m.RemoveWorktree(ctx, worktreePath); err != nil {
			return "", "", fmt.Errorf("failed to clean up invalid worktree: %w", err)
		}
	}

	// Fetch latest from remote
	_, err = m.exec.RunDir(ctx, m.projectPath, "git", "fetch", "origin")
	if err != nil {
		return "", "", fmt.Errorf("failed to fetch from origin: %w", err)
	}

	// Check if branch exists on remote
	_, err = m.exec.RunDir(ctx, m.projectPath, "git", "rev-parse", "--verify", "origin/"+branch)
	branchExistsOnRemote := err == nil

	if branchExistsOnRemote {
		// Create worktree from existing remote branch
		_, err = m.exec.RunDir(ctx, m.projectPath, "git", "worktree", "add", worktreePath, "origin/"+branch)
		if err != nil {
			return "", "", fmt.Errorf("failed to create worktree from remote branch: %w", err)
		}
		// Set up tracking
		_, err = m.exec.RunDir(ctx, worktreePath, "git", "checkout", "-B", branch, "--track", "origin/"+branch)
		if err != nil {
			return "", "", fmt.Errorf("failed to set up tracking branch: %w", err)
		}
	} else {
		// Create new branch from main/master
		baseBranch := m.getDefaultBranch(ctx)
		_, err = m.exec.RunDir(ctx, m.projectPath, "git", "worktree", "add", "-b", branch, worktreePath, "origin/"+baseBranch)
		if err != nil {
			return "", "", fmt.Errorf("failed to create worktree with new branch: %w", err)
		}
	}

	return branch, worktreePath, nil
}

// RemoveWorktree removes a git worktree and optionally the branch.
func (m *WorktreeManager) RemoveWorktree(ctx context.Context, worktreePath string) error {
	// Force remove the worktree
	_, err := m.exec.RunDir(ctx, m.projectPath, "git", "worktree", "remove", "--force", worktreePath)
	if err != nil {
		// Try manual cleanup if git worktree remove fails
		if removeErr := os.RemoveAll(worktreePath); removeErr != nil {
			return fmt.Errorf("failed to remove worktree: %w", err)
		}
		// Prune worktree list
		m.exec.RunDir(ctx, m.projectPath, "git", "worktree", "prune")
	}
	return nil
}

// generateBranchName creates a branch name from issue number and title.
// Format: issue-42-add-dark-mode
func (m *WorktreeManager) generateBranchName(issueNumber int, issueTitle string) string {
	slug := slugify(issueTitle)
	return fmt.Sprintf("issue-%d-%s", issueNumber, slug)
}

// getDefaultBranch returns the default branch name (main or master).
func (m *WorktreeManager) getDefaultBranch(ctx context.Context) string {
	// Try main first
	_, err := m.exec.RunDir(ctx, m.projectPath, "git", "rev-parse", "--verify", "origin/main")
	if err == nil {
		return "main"
	}
	// Fall back to master
	return "master"
}

// slugify converts a string to a URL-friendly slug.
// "Add Dark Mode Support" -> "add-dark-mode-support"
func slugify(s string) string {
	// Convert to lowercase
	s = strings.ToLower(s)

	// Replace spaces and underscores with hyphens
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "_", "-")

	// Remove non-alphanumeric characters (except hyphens)
	reg := regexp.MustCompile(`[^a-z0-9-]`)
	s = reg.ReplaceAllString(s, "")

	// Replace multiple consecutive hyphens with single hyphen
	reg = regexp.MustCompile(`-+`)
	s = reg.ReplaceAllString(s, "-")

	// Trim leading/trailing hyphens
	s = strings.Trim(s, "-")

	// Limit length to avoid overly long branch names
	if len(s) > 50 {
		s = s[:50]
		// Don't end with a hyphen
		s = strings.TrimRight(s, "-")
	}

	return s
}
