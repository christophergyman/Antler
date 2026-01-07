package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/chezu/antler/backend/github"
	"github.com/chezu/antler/backend/orchestrator"
)

// SessionsHandler handles API requests for dev sessions.
type SessionsHandler struct {
	Orchestrator *orchestrator.Orchestrator
	GitHubClient *github.Client
}

// NewSessionsHandler creates a new sessions handler.
func NewSessionsHandler(orch *orchestrator.Orchestrator, ghClient *github.Client) *SessionsHandler {
	return &SessionsHandler{
		Orchestrator: orch,
		GitHubClient: ghClient,
	}
}

// setCORSHeaders sets CORS headers for the response.
func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// HandleIssueRoutes handles routes under /api/issues/:number/
func (h *SessionsHandler) HandleIssueRoutes(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Parse issue number from path: /api/issues/123/labels or /api/issues/123/start-dev
	path := strings.TrimPrefix(r.URL.Path, "/api/issues/")
	parts := strings.SplitN(path, "/", 2)

	if len(parts) < 2 {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	issueNumber, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "Invalid issue number", http.StatusBadRequest)
		return
	}

	action := parts[1]

	switch action {
	case "labels":
		h.handleLabels(w, r, issueNumber)
	case "start-dev":
		h.handleStartDev(w, r, issueNumber)
	case "stop-dev":
		h.handleStopDev(w, r, issueNumber)
	default:
		http.Error(w, "Unknown action", http.StatusNotFound)
	}
}

// UpdateLabelsRequest represents the request body for label updates.
type UpdateLabelsRequest struct {
	Add    []string `json:"add"`
	Remove []string `json:"remove"`
}

// handleLabels handles POST /api/issues/:number/labels
func (h *SessionsHandler) handleLabels(w http.ResponseWriter, r *http.Request, issueNumber int) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateLabelsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.GitHubClient.UpdateLabels(issueNumber, req.Add, req.Remove); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// SessionResponse represents the API response for session operations.
type SessionResponse struct {
	Session *orchestrator.Session `json:"session,omitempty"`
	Error   string                `json:"error,omitempty"`
}

// handleStartDev handles POST /api/issues/:number/start-dev
func (h *SessionsHandler) handleStartDev(w http.ResponseWriter, r *http.Request, issueNumber int) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.Orchestrator == nil || !h.Orchestrator.IsConfigured() {
		http.Error(w, "Orchestrator not configured. Set orchestrator.project_path in config.", http.StatusServiceUnavailable)
		return
	}

	// Fetch issue from GitHub to get context
	issue, err := h.GitHubClient.GetIssue(issueNumber)
	if err != nil {
		http.Error(w, "Failed to fetch issue: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Parse issue body for context
	problem, solution, alternatives, additionalContext := parseBody(issue.Body)

	// Build issue context for orchestrator
	issueCtx := &orchestrator.IssueContext{
		Number:            issue.Number,
		Title:             issue.Title,
		Problem:           problem,
		Solution:          solution,
		Alternatives:      alternatives,
		AdditionalContext: additionalContext,
	}

	for _, label := range issue.Labels {
		issueCtx.Labels = append(issueCtx.Labels, label.Name)
	}
	if len(issue.Assignees) > 0 {
		issueCtx.Assignee = issue.Assignees[0].Login
	}
	if issue.Milestone != nil {
		issueCtx.Milestone = issue.Milestone.Title
	}

	// Start the dev session
	session, err := h.Orchestrator.StartDevSession(r.Context(), issueCtx)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SessionResponse{Error: err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SessionResponse{Session: session})
}

// handleStopDev handles POST /api/issues/:number/stop-dev
func (h *SessionsHandler) handleStopDev(w http.ResponseWriter, r *http.Request, issueNumber int) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.Orchestrator == nil {
		http.Error(w, "Orchestrator not configured", http.StatusServiceUnavailable)
		return
	}

	if err := h.Orchestrator.StopDevSession(r.Context(), issueNumber); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(SessionResponse{Error: err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ListSessionsHandler handles GET /api/sessions
func (h *SessionsHandler) ListSessionsHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if h.Orchestrator == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"sessions": []interface{}{}})
		return
	}

	sessions := h.Orchestrator.ListSessions()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"sessions": sessions})
}

// GetSessionHandler handles GET /api/sessions/:number
func (h *SessionsHandler) GetSessionHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse issue number from path: /api/sessions/123
	path := strings.TrimPrefix(r.URL.Path, "/api/sessions/")
	issueNumber, err := strconv.Atoi(path)
	if err != nil {
		http.Error(w, "Invalid issue number", http.StatusBadRequest)
		return
	}

	if h.Orchestrator == nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	session := h.Orchestrator.GetSession(issueNumber)
	if session == nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SessionResponse{Session: session})
}
