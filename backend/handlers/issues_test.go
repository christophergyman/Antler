package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/chezu/antler/backend/github"
)

// mockGitHubClient creates a handler with mock data for testing
type mockGitHubClient struct {
	issues []github.Issue
	err    error
}

func (m *mockGitHubClient) ListIssues() ([]github.Issue, error) {
	return m.issues, m.err
}

func TestParseBody_AllSections(t *testing.T) {
	body := `## Problem
This is the problem description.
It has multiple lines.

## Solution
This is the solution.

## Alternatives
Consider these alternatives.

## Additional Context
Some extra context here.
`
	problem, solution, alternatives, additionalContext := parseBody(body)

	if problem != "This is the problem description.\nIt has multiple lines." {
		t.Errorf("problem = %q", problem)
	}
	if solution != "This is the solution." {
		t.Errorf("solution = %q", solution)
	}
	if alternatives != "Consider these alternatives." {
		t.Errorf("alternatives = %q", alternatives)
	}
	if additionalContext != "Some extra context here." {
		t.Errorf("additionalContext = %q", additionalContext)
	}
}

func TestParseBody_H3Headers(t *testing.T) {
	body := `### Problem
The problem.

### Solution
The solution.
`
	problem, solution, _, _ := parseBody(body)

	if problem != "The problem." {
		t.Errorf("problem = %q", problem)
	}
	if solution != "The solution." {
		t.Errorf("solution = %q", solution)
	}
}

func TestParseBody_CaseInsensitive(t *testing.T) {
	body := `## PROBLEM
Upper case problem.

## solution
Lower case solution.
`
	problem, solution, _, _ := parseBody(body)

	if problem != "Upper case problem." {
		t.Errorf("problem = %q", problem)
	}
	if solution != "Lower case solution." {
		t.Errorf("solution = %q", solution)
	}
}

func TestParseBody_AdditionalContextVariants(t *testing.T) {
	tests := []struct {
		name   string
		header string
	}{
		{"with space", "## Additional Context"},
		{"with underscore", "## Additional_Context"},
		{"no space", "## AdditionalContext"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := tt.header + "\nContext content here."
			_, _, _, additionalContext := parseBody(body)
			if additionalContext != "Context content here." {
				t.Errorf("additionalContext = %q", additionalContext)
			}
		})
	}
}

func TestParseBody_NoSections(t *testing.T) {
	body := "Just some plain text without any sections."
	problem, solution, alternatives, additionalContext := parseBody(body)

	if problem != "Just some plain text without any sections." {
		t.Errorf("problem = %q, expected entire body", problem)
	}
	if solution != "" {
		t.Errorf("solution = %q, expected empty", solution)
	}
	if alternatives != "" {
		t.Errorf("alternatives = %q, expected empty", alternatives)
	}
	if additionalContext != "" {
		t.Errorf("additionalContext = %q, expected empty", additionalContext)
	}
}

func TestParseBody_EmptyBody(t *testing.T) {
	problem, solution, alternatives, additionalContext := parseBody("")

	if problem != "" {
		t.Errorf("problem = %q, expected empty", problem)
	}
	if solution != "" {
		t.Errorf("solution = %q, expected empty", solution)
	}
	if alternatives != "" {
		t.Errorf("alternatives = %q, expected empty", alternatives)
	}
	if additionalContext != "" {
		t.Errorf("additionalContext = %q, expected empty", additionalContext)
	}
}

func TestParseBody_EmptySections(t *testing.T) {
	body := `## Problem

## Solution
The solution.
`
	problem, solution, _, _ := parseBody(body)

	if problem != "" {
		t.Errorf("problem = %q, expected empty", problem)
	}
	if solution != "The solution." {
		t.Errorf("solution = %q", solution)
	}
}

func TestIssueToTask(t *testing.T) {
	issue := github.Issue{
		Number: 42,
		Title:  "Test Issue",
		Body: `## Problem
A test problem.

## Solution
A test solution.
`,
		Labels: []github.Label{{Name: "feature"}},
		Assignees: []github.Assignee{
			{Login: "johndoe"},
		},
		Milestone: &github.Milestone{Title: "v1.0"},
	}

	task := issueToTask(issue)

	if task.ID != "42" {
		t.Errorf("ID = %q, want %q", task.ID, "42")
	}
	if task.Title != "Test Issue" {
		t.Errorf("Title = %q, want %q", task.Title, "Test Issue")
	}
	if task.Problem != "A test problem." {
		t.Errorf("Problem = %q", task.Problem)
	}
	if task.Solution != "A test solution." {
		t.Errorf("Solution = %q", task.Solution)
	}
	if task.Assignee != "JO" {
		t.Errorf("Assignee = %q, want %q", task.Assignee, "JO")
	}
	if task.Label != "feature" {
		t.Errorf("Label = %q, want %q", task.Label, "feature")
	}
	if task.Milestone != "v1.0" {
		t.Errorf("Milestone = %q, want %q", task.Milestone, "v1.0")
	}
}

func TestIssueToTask_NoAssignee(t *testing.T) {
	issue := github.Issue{
		Number:    1,
		Title:     "No assignee",
		Assignees: nil,
	}

	task := issueToTask(issue)

	if task.Assignee != "" {
		t.Errorf("Assignee = %q, want empty", task.Assignee)
	}
}

func TestIssueToTask_ShortLogin(t *testing.T) {
	issue := github.Issue{
		Number:    1,
		Title:     "Short login",
		Assignees: []github.Assignee{{Login: "x"}},
	}

	task := issueToTask(issue)

	if task.Assignee != "X" {
		t.Errorf("Assignee = %q, want %q", task.Assignee, "X")
	}
}

func TestIssueToTask_NoMilestone(t *testing.T) {
	issue := github.Issue{
		Number:    1,
		Title:     "No milestone",
		Milestone: nil,
	}

	task := issueToTask(issue)

	if task.Milestone != "" {
		t.Errorf("Milestone = %q, want empty", task.Milestone)
	}
}

func TestIssuesHandler_OPTIONS(t *testing.T) {
	handler := NewIssuesHandler(&github.Client{Repository: "test/repo"}, 15)

	req := httptest.NewRequest("OPTIONS", "/api/issues", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Status = %d, want %d", w.Code, http.StatusOK)
	}

	// Check CORS headers
	if w.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Error("Missing Access-Control-Allow-Origin header")
	}
	if w.Header().Get("Access-Control-Allow-Methods") != "GET, OPTIONS" {
		t.Error("Missing Access-Control-Allow-Methods header")
	}
}

func TestIssuesHandler_MethodNotAllowed(t *testing.T) {
	handler := NewIssuesHandler(&github.Client{Repository: "test/repo"}, 15)

	methods := []string{"POST", "PUT", "DELETE", "PATCH"}
	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/api/issues", nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != http.StatusMethodNotAllowed {
				t.Errorf("Status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
			}
		})
	}
}

func TestIssuesHandler_ResponseStructure(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Use real client for integration test
	client := github.NewClient("christophergyman/claude-quick")
	handler := NewIssuesHandler(client, 15)

	req := httptest.NewRequest("GET", "/api/issues", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Status = %d, want %d. Body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	// Check Content-Type
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want %q", ct, "application/json")
	}

	// Parse response
	var response IssuesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse JSON: %v", err)
	}

	// Verify columns structure (4 columns: Feature, Dev, Test/Merge, Done)
	if len(response.Columns) != 4 {
		t.Errorf("Expected 4 columns, got %d", len(response.Columns))
	}

	expectedColumns := []struct {
		id    string
		title string
	}{
		{"feature", "Feature"},
		{"development", "Dev"},
		{"test-merge", "Test/Merge"},
		{"done", "Done"},
	}

	for i, expected := range expectedColumns {
		if i >= len(response.Columns) {
			break
		}
		col := response.Columns[i]
		if col.ID != expected.id {
			t.Errorf("Column %d ID = %q, want %q", i, col.ID, expected.id)
		}
		if col.Title != expected.title {
			t.Errorf("Column %d Title = %q, want %q", i, col.Title, expected.title)
		}
		// Tasks should be initialized (not nil)
		if col.Tasks == nil {
			t.Errorf("Column %d Tasks is nil", i)
		}
	}

	t.Logf("Response: %s", w.Body.String())
}
