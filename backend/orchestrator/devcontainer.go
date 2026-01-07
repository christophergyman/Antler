package orchestrator

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DevContainerManager handles dev container lifecycle operations.
type DevContainerManager struct {
	exec Executor
}

// NewDevContainerManager creates a new dev container manager.
func NewDevContainerManager(exec Executor) *DevContainerManager {
	return &DevContainerManager{exec: exec}
}

// HasDevcontainerConfig checks if a devcontainer.json exists in the worktree.
func (m *DevContainerManager) HasDevcontainerConfig(worktreePath string) bool {
	configPath := filepath.Join(worktreePath, ".devcontainer", "devcontainer.json")
	_, err := os.Stat(configPath)
	return err == nil
}

// StartDevContainer starts a dev container for the given worktree.
// Returns the container ID.
func (m *DevContainerManager) StartDevContainer(ctx context.Context, worktreePath string) (string, error) {
	if !m.HasDevcontainerConfig(worktreePath) {
		return "", fmt.Errorf("no devcontainer.json found in %s/.devcontainer", worktreePath)
	}

	// Use the devcontainer CLI to start the container
	// devcontainer up --workspace-folder <path>
	output, err := m.exec.Run(ctx, "devcontainer", "up", "--workspace-folder", worktreePath)
	if err != nil {
		return "", fmt.Errorf("failed to start dev container: %w", err)
	}

	// Parse the output to get container ID
	containerID, err := m.parseContainerID(output)
	if err != nil {
		return "", fmt.Errorf("failed to parse container ID: %w", err)
	}

	return containerID, nil
}

// StopDevContainer stops and removes a dev container.
func (m *DevContainerManager) StopDevContainer(ctx context.Context, containerID string) error {
	if containerID == "" {
		return nil // No container to stop
	}

	// Stop the container
	_, err := m.exec.Run(ctx, "docker", "stop", containerID)
	if err != nil {
		// Container might already be stopped, try to remove anyway
	}

	// Remove the container
	_, err = m.exec.Run(ctx, "docker", "rm", "-f", containerID)
	if err != nil {
		return fmt.Errorf("failed to remove container: %w", err)
	}

	return nil
}

// ExecInContainer executes a command inside the dev container.
func (m *DevContainerManager) ExecInContainer(ctx context.Context, containerID string, command ...string) ([]byte, error) {
	args := append([]string{"exec", "-i", containerID}, command...)
	return m.exec.Run(ctx, "docker", args...)
}

// parseContainerID extracts the container ID from devcontainer up output.
// The output is typically JSON with an "containerId" field.
func (m *DevContainerManager) parseContainerID(output []byte) (string, error) {
	// devcontainer up outputs JSON with containerId
	var result struct {
		Outcome     string `json:"outcome"`
		ContainerID string `json:"containerId"`
	}

	// Output may have multiple lines, find the JSON line
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "{") {
			if err := json.Unmarshal([]byte(line), &result); err == nil {
				if result.ContainerID != "" {
					return result.ContainerID, nil
				}
			}
		}
	}

	// Fallback: try to parse entire output as JSON
	if err := json.Unmarshal(output, &result); err == nil {
		if result.ContainerID != "" {
			return result.ContainerID, nil
		}
	}

	return "", fmt.Errorf("container ID not found in output: %s", string(output))
}

// GetContainerWorkspaceFolder returns the workspace folder path inside the container.
func (m *DevContainerManager) GetContainerWorkspaceFolder(ctx context.Context, worktreePath string) (string, error) {
	configPath := filepath.Join(worktreePath, ".devcontainer", "devcontainer.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", err
	}

	var config struct {
		WorkspaceFolder string `json:"workspaceFolder"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return "", err
	}

	if config.WorkspaceFolder != "" {
		return config.WorkspaceFolder, nil
	}

	// Default workspace folder
	return "/workspaces/" + filepath.Base(worktreePath), nil
}
