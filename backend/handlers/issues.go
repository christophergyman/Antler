package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/chezu/antler/backend/github"
)

type Task struct {
	ID                string `json:"id"`
	Title             string `json:"title"`
	Problem           string `json:"problem"`
	Solution          string `json:"solution"`
	Alternatives      string `json:"alternatives"`
	AdditionalContext string `json:"additionalContext"`
	Assignee          string `json:"assignee"`
	Label             string `json:"label"`
	Project           string `json:"project"`
	Milestone         string `json:"milestone"`
	Branch            string `json:"branch"`
}

type Column struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Tasks []Task `json:"tasks"`
}

type IssuesResponse struct {
	Columns []Column `json:"columns"`
}

type IssuesHandler struct {
	GitHubClient *github.Client
}

func NewIssuesHandler(client *github.Client) *IssuesHandler {
	return &IssuesHandler{GitHubClient: client}
}

func (h *IssuesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	issues, err := h.GitHubClient.ListIssues()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize columns
	columns := map[string]*Column{
		"feature": {
			ID:    "feature",
			Title: "Feature",
			Tasks: []Task{},
		},
		"development": {
			ID:    "development",
			Title: "Dev",
			Tasks: []Task{},
		},
		"test-merge": {
			ID:    "test-merge",
			Title: "Test/Merge",
			Tasks: []Task{},
		},
	}

	// Map issues to columns
	for _, issue := range issues {
		task := issueToTask(issue)
		columnID := github.GetColumnForIssue(issue)
		if col, ok := columns[columnID]; ok {
			col.Tasks = append(col.Tasks, task)
		}
	}

	response := IssuesResponse{
		Columns: []Column{
			*columns["feature"],
			*columns["development"],
			*columns["test-merge"],
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func issueToTask(issue github.Issue) Task {
	// Parse body sections
	problem, solution, alternatives, additionalContext := parseBody(issue.Body)

	// Get assignee initials
	assignee := ""
	if len(issue.Assignees) > 0 {
		login := issue.Assignees[0].Login
		if len(login) >= 2 {
			assignee = strings.ToUpper(login[:2])
		} else if len(login) > 0 {
			assignee = strings.ToUpper(login)
		}
	}

	// Get milestone
	milestone := ""
	if issue.Milestone != nil {
		milestone = issue.Milestone.Title
	}

	return Task{
		ID:                strconv.Itoa(issue.Number),
		Title:             issue.Title,
		Problem:           problem,
		Solution:          solution,
		Alternatives:      alternatives,
		AdditionalContext: additionalContext,
		Assignee:          assignee,
		Label:             github.GetPrimaryLabel(issue),
		Project:           "",
		Milestone:         milestone,
		Branch:            "",
	}
}

// parseBody extracts sections from GitHub issue body
// Supports markdown headers: ## Problem, ## Solution, etc.
func parseBody(body string) (problem, solution, alternatives, additionalContext string) {
	sections := map[string]*string{
		"problem":            &problem,
		"solution":           &solution,
		"alternatives":       &alternatives,
		"additional context": &additionalContext,
		"additional_context": &additionalContext,
		"additionalcontext":  &additionalContext,
	}

	lines := strings.Split(body, "\n")
	currentSection := ""
	currentContent := []string{}

	flushSection := func() {
		if currentSection != "" {
			if ptr, ok := sections[strings.ToLower(currentSection)]; ok {
				*ptr = strings.TrimSpace(strings.Join(currentContent, "\n"))
			}
		}
		currentContent = []string{}
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Check for markdown headers
		if strings.HasPrefix(trimmed, "## ") || strings.HasPrefix(trimmed, "### ") {
			flushSection()
			// Extract header text
			header := strings.TrimPrefix(trimmed, "### ")
			header = strings.TrimPrefix(header, "## ")
			currentSection = strings.TrimSpace(header)
		} else {
			currentContent = append(currentContent, line)
		}
	}
	flushSection()

	// If no sections found, use entire body as problem
	if problem == "" && solution == "" && alternatives == "" && additionalContext == "" {
		problem = strings.TrimSpace(body)
	}

	return
}
