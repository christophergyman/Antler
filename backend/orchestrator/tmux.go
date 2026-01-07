package orchestrator

import (
	"context"
	"fmt"
	"strings"
)

// TmuxManager handles tmux session operations.
type TmuxManager struct {
	exec Executor
}

// NewTmuxManager creates a new tmux manager.
func NewTmuxManager(exec Executor) *TmuxManager {
	return &TmuxManager{exec: exec}
}

// CreateSession creates a new tmux session.
// The session will be created detached and with the given working directory.
func (m *TmuxManager) CreateSession(ctx context.Context, sessionName, workDir string) error {
	// Check if session already exists
	if m.SessionExists(ctx, sessionName) {
		return nil // Session already exists
	}

	// Create new detached session with the specified working directory
	// -d: detached
	// -s: session name
	// -c: start directory
	_, err := m.exec.Run(ctx, "tmux", "new-session", "-d", "-s", sessionName, "-c", workDir)
	if err != nil {
		return fmt.Errorf("failed to create tmux session: %w", err)
	}

	return nil
}

// KillSession terminates a tmux session.
func (m *TmuxManager) KillSession(ctx context.Context, sessionName string) error {
	if !m.SessionExists(ctx, sessionName) {
		return nil // Session doesn't exist, nothing to kill
	}

	_, err := m.exec.Run(ctx, "tmux", "kill-session", "-t", sessionName)
	if err != nil {
		return fmt.Errorf("failed to kill tmux session: %w", err)
	}

	return nil
}

// SessionExists checks if a tmux session with the given name exists.
func (m *TmuxManager) SessionExists(ctx context.Context, sessionName string) bool {
	_, err := m.exec.Run(ctx, "tmux", "has-session", "-t", sessionName)
	return err == nil
}

// SendKeys sends keystrokes to a tmux session.
// This is used to type commands into the session.
func (m *TmuxManager) SendKeys(ctx context.Context, sessionName, keys string) error {
	_, err := m.exec.Run(ctx, "tmux", "send-keys", "-t", sessionName, keys, "Enter")
	if err != nil {
		return fmt.Errorf("failed to send keys to tmux session: %w", err)
	}
	return nil
}

// ListSessions returns a list of all tmux session names.
func (m *TmuxManager) ListSessions(ctx context.Context) ([]string, error) {
	output, err := m.exec.Run(ctx, "tmux", "list-sessions", "-F", "#{session_name}")
	if err != nil {
		// No sessions is not an error
		if strings.Contains(err.Error(), "no server running") ||
			strings.Contains(err.Error(), "no sessions") {
			return nil, nil
		}
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	var sessions []string
	for _, line := range lines {
		if line = strings.TrimSpace(line); line != "" {
			sessions = append(sessions, line)
		}
	}
	return sessions, nil
}

// GenerateSessionName creates a consistent session name for an issue.
func GenerateSessionName(issueNumber int) string {
	return fmt.Sprintf("antler-issue-%d", issueNumber)
}
