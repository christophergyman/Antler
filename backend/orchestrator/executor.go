package orchestrator

import (
	"bytes"
	"context"
	"os/exec"
)

// Executor defines the interface for running external commands.
// This abstraction allows for easy testing with mock implementations.
type Executor interface {
	// Run executes a command and returns its combined output.
	Run(ctx context.Context, name string, args ...string) ([]byte, error)
	// RunDir executes a command in a specific directory.
	RunDir(ctx context.Context, dir, name string, args ...string) ([]byte, error)
}

// RealExecutor implements Executor using actual system commands.
type RealExecutor struct{}

func NewRealExecutor() *RealExecutor {
	return &RealExecutor{}
}

func (e *RealExecutor) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		// Include stderr in error for better debugging
		if stderr.Len() > 0 {
			return nil, &CommandError{
				Command: name,
				Args:    args,
				Err:     err,
				Stderr:  stderr.String(),
			}
		}
		return nil, err
	}
	return stdout.Bytes(), nil
}

func (e *RealExecutor) RunDir(ctx context.Context, dir, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		if stderr.Len() > 0 {
			return nil, &CommandError{
				Command: name,
				Args:    args,
				Dir:     dir,
				Err:     err,
				Stderr:  stderr.String(),
			}
		}
		return nil, err
	}
	return stdout.Bytes(), nil
}

// CommandError provides detailed information about command failures.
type CommandError struct {
	Command string
	Args    []string
	Dir     string
	Err     error
	Stderr  string
}

func (e *CommandError) Error() string {
	msg := "command failed: " + e.Command
	if e.Dir != "" {
		msg += " (in " + e.Dir + ")"
	}
	msg += ": " + e.Err.Error()
	if e.Stderr != "" {
		msg += "\nstderr: " + e.Stderr
	}
	return msg
}

func (e *CommandError) Unwrap() error {
	return e.Err
}
