package orchestrator

import (
	"context"
	"fmt"
	"strings"
)

// ClaudeManager handles Claude Code invocation.
type ClaudeManager struct {
	exec       Executor
	claudePath string
}

// NewClaudeManager creates a new Claude Code manager.
func NewClaudeManager(exec Executor, claudePath string) *ClaudeManager {
	if claudePath == "" {
		claudePath = "claude"
	}
	return &ClaudeManager{
		exec:       exec,
		claudePath: claudePath,
	}
}

// IssueContext contains the relevant information from a GitHub issue.
type IssueContext struct {
	Number            int
	Title             string
	Problem           string
	Solution          string
	Alternatives      string
	AdditionalContext string
	Labels            []string
	Assignee          string
	Milestone         string
}

// StartClaudeCode launches Claude Code in a tmux session with issue context.
func (m *ClaudeManager) StartClaudeCode(ctx context.Context, tmuxManager *TmuxManager, sessionName, workDir string, issue *IssueContext) error {
	// Build the initial prompt
	prompt := m.BuildPrompt(issue)

	// Send the claude command to the tmux session
	// We use --print to pass the initial prompt
	claudeCmd := fmt.Sprintf("%s --print %q", m.claudePath, prompt)

	// Send the command to the tmux session
	if err := tmuxManager.SendKeys(ctx, sessionName, claudeCmd); err != nil {
		return fmt.Errorf("failed to start Claude Code: %w", err)
	}

	return nil
}

// BuildPrompt creates an initial prompt for Claude Code with issue context.
func (m *ClaudeManager) BuildPrompt(issue *IssueContext) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("I'm working on GitHub Issue #%d: %s\n\n", issue.Number, issue.Title))

	if issue.Problem != "" {
		sb.WriteString("## Problem\n")
		sb.WriteString(issue.Problem)
		sb.WriteString("\n\n")
	}

	if issue.Solution != "" {
		sb.WriteString("## Solution\n")
		sb.WriteString(issue.Solution)
		sb.WriteString("\n\n")
	}

	if issue.Alternatives != "" {
		sb.WriteString("## Alternatives Considered\n")
		sb.WriteString(issue.Alternatives)
		sb.WriteString("\n\n")
	}

	if issue.AdditionalContext != "" {
		sb.WriteString("## Additional Context\n")
		sb.WriteString(issue.AdditionalContext)
		sb.WriteString("\n\n")
	}

	sb.WriteString("Please help me implement this feature. Start by understanding the codebase and then implement the solution described above.")

	return sb.String()
}

// VerifyClaudeInstalled checks if the Claude Code CLI is available.
func (m *ClaudeManager) VerifyClaudeInstalled(ctx context.Context) error {
	_, err := m.exec.Run(ctx, m.claudePath, "--version")
	if err != nil {
		return fmt.Errorf("Claude Code CLI not found at '%s': %w", m.claudePath, err)
	}
	return nil
}
