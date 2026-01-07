package github

import (
	"testing"
)

func TestGetColumnForIssue_Feature(t *testing.T) {
	issue := Issue{
		Labels: []Label{{Name: "feature"}},
	}
	got := GetColumnForIssue(issue)
	if got != "feature" {
		t.Errorf("GetColumnForIssue() = %q, want %q", got, "feature")
	}
}

func TestGetColumnForIssue_FeatureCaseInsensitive(t *testing.T) {
	issue := Issue{
		Labels: []Label{{Name: "FEATURE"}},
	}
	got := GetColumnForIssue(issue)
	if got != "feature" {
		t.Errorf("GetColumnForIssue() = %q, want %q", got, "feature")
	}
}

func TestGetColumnForIssue_Development(t *testing.T) {
	issue := Issue{
		Labels: []Label{{Name: "development"}},
	}
	got := GetColumnForIssue(issue)
	if got != "development" {
		t.Errorf("GetColumnForIssue() = %q, want %q", got, "development")
	}
}

func TestGetColumnForIssue_TestMerge(t *testing.T) {
	tests := []struct {
		label string
	}{
		{"test/merge"},
		{"test"},
		{"merge"},
		{"TEST/MERGE"},
		{"Test"},
		{"MERGE"},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			issue := Issue{
				Labels: []Label{{Name: tt.label}},
			}
			got := GetColumnForIssue(issue)
			if got != "test-merge" {
				t.Errorf("GetColumnForIssue() with label %q = %q, want %q", tt.label, got, "test-merge")
			}
		})
	}
}

func TestGetColumnForIssue_DefaultToFeature(t *testing.T) {
	tests := []struct {
		name   string
		labels []Label
	}{
		{"no labels", nil},
		{"empty labels", []Label{}},
		{"unknown label", []Label{{Name: "bug"}}},
		{"multiple unknown labels", []Label{{Name: "bug"}, {Name: "enhancement"}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issue := Issue{Labels: tt.labels}
			got := GetColumnForIssue(issue)
			if got != "feature" {
				t.Errorf("GetColumnForIssue() = %q, want %q (default)", got, "feature")
			}
		})
	}
}

func TestGetColumnForIssue_FirstMatchingLabel(t *testing.T) {
	// When multiple kanban labels exist, the first one wins
	issue := Issue{
		Labels: []Label{
			{Name: "bug"},
			{Name: "development"},
			{Name: "feature"},
		},
	}
	got := GetColumnForIssue(issue)
	if got != "development" {
		t.Errorf("GetColumnForIssue() = %q, want %q (first matching)", got, "development")
	}
}

func TestGetPrimaryLabel_Feature(t *testing.T) {
	issue := Issue{
		Labels: []Label{{Name: "feature"}},
	}
	got := GetPrimaryLabel(issue)
	if got != "feature" {
		t.Errorf("GetPrimaryLabel() = %q, want %q", got, "feature")
	}
}

func TestGetPrimaryLabel_Development(t *testing.T) {
	issue := Issue{
		Labels: []Label{{Name: "Development"}},
	}
	got := GetPrimaryLabel(issue)
	if got != "development" {
		t.Errorf("GetPrimaryLabel() = %q, want %q", got, "development")
	}
}

func TestGetPrimaryLabel_TestMerge(t *testing.T) {
	tests := []struct {
		label    string
		expected string
	}{
		{"test/merge", "test/merge"},
		{"test", "test"},
		{"merge", "merge"},
	}

	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			issue := Issue{
				Labels: []Label{{Name: tt.label}},
			}
			got := GetPrimaryLabel(issue)
			if got != tt.expected {
				t.Errorf("GetPrimaryLabel() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestGetPrimaryLabel_DefaultToFeature(t *testing.T) {
	tests := []struct {
		name   string
		labels []Label
	}{
		{"no labels", nil},
		{"empty labels", []Label{}},
		{"unknown label", []Label{{Name: "bug"}}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issue := Issue{Labels: tt.labels}
			got := GetPrimaryLabel(issue)
			if got != "feature" {
				t.Errorf("GetPrimaryLabel() = %q, want %q (default)", got, "feature")
			}
		})
	}
}

func TestNewClient(t *testing.T) {
	client := NewClient("owner/repo")
	if client == nil {
		t.Fatal("NewClient() returned nil")
	}
	if client.Repository != "owner/repo" {
		t.Errorf("Repository = %q, want %q", client.Repository, "owner/repo")
	}
}

// Integration test - requires gh CLI to be authenticated
func TestListIssues_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := NewClient("christophergyman/claude-quick")
	issues, err := client.ListIssues()
	if err != nil {
		t.Fatalf("ListIssues() error = %v", err)
	}

	// Just verify we got a valid response (may be empty if no issues)
	t.Logf("Found %d issues", len(issues))

	// Verify structure of returned issues
	for i, issue := range issues {
		if issue.Number <= 0 {
			t.Errorf("Issue %d has invalid number: %d", i, issue.Number)
		}
		if issue.Title == "" {
			t.Errorf("Issue %d has empty title", issue.Number)
		}
		t.Logf("Issue #%d: %s (labels: %v)", issue.Number, issue.Title, issue.Labels)
	}
}

func TestListIssues_InvalidRepo(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := NewClient("nonexistent-owner-xyz/nonexistent-repo-xyz")
	_, err := client.ListIssues()
	if err == nil {
		t.Error("Expected error for nonexistent repo, got nil")
	}
	t.Logf("Got expected error: %v", err)
}
