package github

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type Client struct {
	Repository string
}

type Issue struct {
	Number     int        `json:"number"`
	Title      string     `json:"title"`
	Body       string     `json:"body"`
	Labels     []Label    `json:"labels"`
	Assignees  []Assignee `json:"assignees"`
	Milestone  *Milestone `json:"milestone"`
	State      string     `json:"state"`
}

type Label struct {
	Name string `json:"name"`
}

type Assignee struct {
	Login string `json:"login"`
}

type Milestone struct {
	Title string `json:"title"`
}

func NewClient(repository string) *Client {
	return &Client{Repository: repository}
}

func (c *Client) ListIssues() ([]Issue, error) {
	cmd := exec.Command("gh", "issue", "list",
		"--repo", c.Repository,
		"--state", "open",
		"--limit", "100",
		"--json", "number,title,body,labels,assignees,milestone,state",
	)

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("gh command failed: %s", string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("failed to run gh command: %w", err)
	}

	var issues []Issue
	if err := json.Unmarshal(output, &issues); err != nil {
		return nil, fmt.Errorf("failed to parse gh output: %w", err)
	}

	return issues, nil
}

// GetColumnForIssue determines which column an issue belongs to based on labels
func GetColumnForIssue(issue Issue) string {
	for _, label := range issue.Labels {
		labelLower := strings.ToLower(label.Name)
		switch labelLower {
		case "feature":
			return "feature"
		case "development":
			return "development"
		case "test/merge", "test", "merge":
			return "test-merge"
		}
	}
	// Default to feature column if no matching label
	return "feature"
}

// GetPrimaryLabel returns the first matching kanban label
func GetPrimaryLabel(issue Issue) string {
	for _, label := range issue.Labels {
		labelLower := strings.ToLower(label.Name)
		switch labelLower {
		case "feature", "development", "test/merge", "test", "merge":
			return labelLower
		}
	}
	return "feature"
}
