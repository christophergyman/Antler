package orchestrator

import (
	"sync"
	"time"
)

// SessionStatus represents the current state of a dev session.
type SessionStatus string

const (
	StatusStarting SessionStatus = "starting"
	StatusRunning  SessionStatus = "running"
	StatusStopping SessionStatus = "stopping"
	StatusStopped  SessionStatus = "stopped"
	StatusError    SessionStatus = "error"
)

// Session represents an active development session for a GitHub issue.
type Session struct {
	IssueNumber  int           `json:"issue_number"`
	IssueTitle   string        `json:"issue_title"`
	Branch       string        `json:"branch"`
	WorktreePath string        `json:"worktree_path"`
	ContainerID  string        `json:"container_id,omitempty"`
	TmuxSession  string        `json:"tmux_session"`
	Status       SessionStatus `json:"status"`
	StartedAt    time.Time     `json:"started_at"`
	Error        string        `json:"error,omitempty"`
}

// SessionManager handles in-memory session tracking.
// Sessions are not persisted and are lost on restart.
type SessionManager struct {
	sessions map[int]*Session
	mu       sync.RWMutex
}

// NewSessionManager creates a new session manager.
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[int]*Session),
	}
}

// Get returns a session by issue number, or nil if not found.
func (m *SessionManager) Get(issueNumber int) *Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[issueNumber]
}

// List returns all active sessions.
func (m *SessionManager) List() []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		result = append(result, s)
	}
	return result
}

// Create adds a new session for an issue.
func (m *SessionManager) Create(issueNumber int, issueTitle string) *Session {
	m.mu.Lock()
	defer m.mu.Unlock()

	session := &Session{
		IssueNumber: issueNumber,
		IssueTitle:  issueTitle,
		Status:      StatusStarting,
		StartedAt:   time.Now(),
	}
	m.sessions[issueNumber] = session
	return session
}

// Update modifies an existing session.
func (m *SessionManager) Update(issueNumber int, update func(*Session)) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if session, ok := m.sessions[issueNumber]; ok {
		update(session)
	}
}

// Remove deletes a session from the manager.
func (m *SessionManager) Remove(issueNumber int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, issueNumber)
}

// Exists checks if a session exists for the given issue number.
func (m *SessionManager) Exists(issueNumber int) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.sessions[issueNumber]
	return ok
}
