package orchestrator

import (
	"context"
	"fmt"
	"log"

	"github.com/chezu/antler/backend/config"
)

// Orchestrator coordinates dev session lifecycle management.
// It manages worktrees, dev containers, tmux sessions, and Claude Code.
type Orchestrator struct {
	sessions     *SessionManager
	worktrees    *WorktreeManager
	devcontainer *DevContainerManager
	tmux         *TmuxManager
	claude       *ClaudeManager
	config       *config.OrchestratorConfig
	executor     Executor
}

// New creates a new Orchestrator with the given configuration.
func New(cfg *config.OrchestratorConfig) *Orchestrator {
	exec := NewRealExecutor()

	return &Orchestrator{
		sessions:     NewSessionManager(),
		worktrees:    NewWorktreeManager(exec, cfg.ProjectPath, cfg.WorktreeBase),
		devcontainer: NewDevContainerManager(exec),
		tmux:         NewTmuxManager(exec),
		claude:       NewClaudeManager(exec, cfg.ClaudeCodePath),
		config:       cfg,
		executor:     exec,
	}
}

// StartDevSession starts a complete dev session for a GitHub issue.
// This creates a worktree, starts a dev container, creates a tmux session,
// and launches Claude Code with the issue context.
func (o *Orchestrator) StartDevSession(ctx context.Context, issue *IssueContext) (*Session, error) {
	// Check if session already exists
	if existing := o.sessions.Get(issue.Number); existing != nil {
		if existing.Status == StatusRunning {
			return existing, nil
		}
	}

	// Validate configuration
	if o.config.ProjectPath == "" {
		return nil, fmt.Errorf("orchestrator.project_path is required in config")
	}

	// Create session entry
	o.sessions.Create(issue.Number, issue.Title)

	// Step 1: Create worktree
	o.sessions.Update(issue.Number, func(s *Session) {
		s.Status = StatusStarting
	})

	log.Printf("   🔧 Creating git worktree for issue #%d...", issue.Number)
	branch, worktreePath, err := o.worktrees.CreateWorktree(ctx, issue.Number, issue.Title)
	if err != nil {
		log.Printf("   ❌ Worktree creation failed: %v", err)
		o.sessions.Update(issue.Number, func(s *Session) {
			s.Status = StatusError
			s.Error = fmt.Sprintf("worktree creation failed: %v", err)
		})
		return nil, fmt.Errorf("failed to create worktree: %w", err)
	}
	log.Printf("   ✓ Worktree created: %s", worktreePath)
	log.Printf("   ✓ Branch: %s", branch)

	o.sessions.Update(issue.Number, func(s *Session) {
		s.Branch = branch
		s.WorktreePath = worktreePath
	})

	// Step 2: Verify devcontainer.json exists (REQUIRED)
	log.Printf("   🔍 Checking for devcontainer.json...")
	if !o.devcontainer.HasDevcontainerConfig(worktreePath) {
		log.Printf("   ❌ No .devcontainer/devcontainer.json found")
		o.sessions.Update(issue.Number, func(s *Session) {
			s.Status = StatusError
			s.Error = "no .devcontainer/devcontainer.json found in target project"
		})
		return nil, fmt.Errorf("devcontainer.json is required but not found in %s", worktreePath)
	}
	log.Printf("   ✓ devcontainer.json found")

	// Step 3: Start dev container
	log.Printf("   🐳 Starting dev container...")
	containerID, err := o.devcontainer.StartDevContainer(ctx, worktreePath)
	if err != nil {
		log.Printf("   ❌ Dev container failed: %v", err)
		o.sessions.Update(issue.Number, func(s *Session) {
			s.Status = StatusError
			s.Error = fmt.Sprintf("devcontainer start failed: %v", err)
		})
		return nil, fmt.Errorf("failed to start dev container: %w", err)
	}
	log.Printf("   ✓ Container started: %s", containerID[:12])

	o.sessions.Update(issue.Number, func(s *Session) {
		s.ContainerID = containerID
	})

	// Step 4: Create tmux session
	tmuxSessionName := GenerateSessionName(issue.Number)
	log.Printf("   📺 Creating tmux session: %s", tmuxSessionName)
	if err := o.tmux.CreateSession(ctx, tmuxSessionName, worktreePath); err != nil {
		log.Printf("   ❌ Tmux session failed: %v", err)
		// Cleanup container on failure
		o.devcontainer.StopDevContainer(ctx, containerID)
		o.sessions.Update(issue.Number, func(s *Session) {
			s.Status = StatusError
			s.Error = fmt.Sprintf("tmux session creation failed: %v", err)
		})
		return nil, fmt.Errorf("failed to create tmux session: %w", err)
	}
	log.Printf("   ✓ Tmux session created")

	o.sessions.Update(issue.Number, func(s *Session) {
		s.TmuxSession = tmuxSessionName
	})

	// Step 5: Launch Claude Code
	log.Printf("   🤖 Launching Claude Code...")
	if err := o.claude.StartClaudeCode(ctx, o.tmux, tmuxSessionName, worktreePath, issue); err != nil {
		log.Printf("   ❌ Claude Code failed: %v", err)
		// Cleanup on failure
		o.tmux.KillSession(ctx, tmuxSessionName)
		o.devcontainer.StopDevContainer(ctx, containerID)
		o.sessions.Update(issue.Number, func(s *Session) {
			s.Status = StatusError
			s.Error = fmt.Sprintf("Claude Code start failed: %v", err)
		})
		return nil, fmt.Errorf("failed to start Claude Code: %w", err)
	}
	log.Printf("   ✓ Claude Code launched")

	// Mark session as running
	o.sessions.Update(issue.Number, func(s *Session) {
		s.Status = StatusRunning
	})

	return o.sessions.Get(issue.Number), nil
}

// StopDevSession stops and cleans up a dev session.
func (o *Orchestrator) StopDevSession(ctx context.Context, issueNumber int) error {
	session := o.sessions.Get(issueNumber)
	if session == nil {
		log.Printf("   ℹ️  No active session found for issue #%d", issueNumber)
		return nil // No session to stop
	}

	o.sessions.Update(issueNumber, func(s *Session) {
		s.Status = StatusStopping
	})

	var errors []error

	// Step 1: Kill tmux session (this stops Claude Code)
	if session.TmuxSession != "" {
		log.Printf("   📺 Killing tmux session: %s", session.TmuxSession)
		if err := o.tmux.KillSession(ctx, session.TmuxSession); err != nil {
			log.Printf("   ⚠️  Tmux cleanup warning: %v", err)
			errors = append(errors, fmt.Errorf("tmux: %w", err))
		} else {
			log.Printf("   ✓ Tmux session killed")
		}
	}

	// Step 2: Stop dev container
	if session.ContainerID != "" {
		log.Printf("   🐳 Stopping container: %s", session.ContainerID[:12])
		if err := o.devcontainer.StopDevContainer(ctx, session.ContainerID); err != nil {
			log.Printf("   ⚠️  Container cleanup warning: %v", err)
			errors = append(errors, fmt.Errorf("container: %w", err))
		} else {
			log.Printf("   ✓ Container stopped")
		}
	}

	// Step 3: Optionally remove worktree
	if o.config.CleanupWorktreeOnStop && session.WorktreePath != "" {
		log.Printf("   🔧 Removing worktree: %s", session.WorktreePath)
		if err := o.worktrees.RemoveWorktree(ctx, session.WorktreePath); err != nil {
			log.Printf("   ⚠️  Worktree cleanup warning: %v", err)
			errors = append(errors, fmt.Errorf("worktree: %w", err))
		} else {
			log.Printf("   ✓ Worktree removed")
		}
	}

	// Remove session from manager
	o.sessions.Remove(issueNumber)

	if len(errors) > 0 {
		return fmt.Errorf("cleanup errors: %v", errors)
	}

	return nil
}

// GetSession returns a session by issue number.
func (o *Orchestrator) GetSession(issueNumber int) *Session {
	return o.sessions.Get(issueNumber)
}

// ListSessions returns all active sessions.
func (o *Orchestrator) ListSessions() []*Session {
	return o.sessions.List()
}

// IsConfigured returns true if the orchestrator has the required configuration.
func (o *Orchestrator) IsConfigured() bool {
	return o.config.ProjectPath != ""
}
