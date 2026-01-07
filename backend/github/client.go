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

func (c *Client) ListClosedIssues(limit int) ([]Issue, error) {
	if limit <= 0 {
		return []Issue{}, nil
	}

	cmd := exec.Command("gh", "issue", "list",
		"--repo", c.Repository,
		"--state", "closed",
		"--limit", fmt.Sprintf("%d", limit),
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

// GetIssue fetches a single issue by number.
func (c *Client) GetIssue(issueNumber int) (*Issue, error) {
	cmd := exec.Command("gh", "issue", "view",
		fmt.Sprintf("%d", issueNumber),
		"--repo", c.Repository,
		"--json", "number,title,body,labels,assignees,milestone,state",
	)

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("gh command failed: %s", string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("failed to run gh command: %w", err)
	}

	var issue Issue
	if err := json.Unmarshal(output, &issue); err != nil {
		return nil, fmt.Errorf("failed to parse gh output: %w", err)
	}

	return &issue, nil
}

// AddLabel adds a label to an issue.
func (c *Client) AddLabel(issueNumber int, label string) error {
	cmd := exec.Command("gh", "issue", "edit",
		fmt.Sprintf("%d", issueNumber),
		"--repo", c.Repository,
		"--add-label", label,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to add label: %s", string(output))
	}

	return nil
}

// RemoveLabel removes a label from an issue.
func (c *Client) RemoveLabel(issueNumber int, label string) error {
	cmd := exec.Command("gh", "issue", "edit",
		fmt.Sprintf("%d", issueNumber),
		"--repo", c.Repository,
		"--remove-label", label,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to remove label: %s", string(output))
	}

	return nil
}

// UpdateLabels updates an issue's labels by adding and removing specified labels.
func (c *Client) UpdateLabels(issueNumber int, addLabels, removeLabels []string) error {
	args := []string{"issue", "edit", fmt.Sprintf("%d", issueNumber), "--repo", c.Repository}

	for _, label := range addLabels {
		args = append(args, "--add-label", label)
	}
	for _, label := range removeLabels {
		args = append(args, "--remove-label", label)
	}

	cmd := exec.Command("gh", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to update labels: %s", string(output))
	}

	return nil
}
