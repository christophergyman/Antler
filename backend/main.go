package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/chezu/antler/backend/config"
	"github.com/chezu/antler/backend/github"
	"github.com/chezu/antler/backend/handlers"
	"github.com/chezu/antler/backend/orchestrator"
)

// repoPattern validates "owner/repo" format
var repoPattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$`)

func main() {
	// Find config file - look in parent directory (Antler root)
	execPath, err := os.Executable()
	if err != nil {
		execPath = "."
	}

	// Try multiple config locations (current dir first, then parent)
	configPaths := []string{
		"antler-config.yaml",
		"../antler-config.yaml",
		filepath.Join(filepath.Dir(execPath), "antler-config.yaml"),
		filepath.Join(filepath.Dir(execPath), "..", "antler-config.yaml"),
	}

	var cfg *config.Config
	var configPath string
	for _, path := range configPaths {
		cfg, err = config.Load(path)
		if err == nil {
			configPath = path
			log.Printf("Loaded config from: %s", path)
			break
		}
	}

	if cfg == nil {
		log.Fatal("Could not find antler-config.yaml. Please create it with:\ngithub:\n  repository: \"owner/repo\"")
	}

	if cfg.GitHub.Repository == "" {
		log.Fatal("GitHub repository not configured in antler-config.yaml")
	}

	log.Printf("Using GitHub repository: %s", cfg.GitHub.Repository)

	// Set default for closed issue limit if not configured
	if cfg.GitHub.ClosedIssueLimit == 0 {
		cfg.GitHub.ClosedIssueLimit = 15
	}
	log.Printf("Closed issue limit: %d", cfg.GitHub.ClosedIssueLimit)

	// Create GitHub client with mutex for thread-safe updates
	var mu sync.RWMutex
	ghClient := github.NewClient(cfg.GitHub.Repository)
	issuesHandler := handlers.NewIssuesHandler(ghClient, cfg.GitHub.ClosedIssueLimit)

	// Initialize orchestrator if configured
	var orch *orchestrator.Orchestrator
	if cfg.Orchestrator.ProjectPath != "" {
		orch = orchestrator.New(&cfg.Orchestrator)
		log.Printf("Orchestrator enabled: project_path=%s, worktree_base=%s",
			cfg.Orchestrator.ProjectPath, cfg.Orchestrator.WorktreeBase)
	} else {
		log.Printf("Orchestrator not configured (set orchestrator.project_path in config to enable)")
	}

	// Create sessions handler
	sessionsHandler := handlers.NewSessionsHandler(orch, ghClient)

	// Setup routes - use wrapper to always use current handler
	http.HandleFunc("/api/issues", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		handler := issuesHandler
		mu.RUnlock()
		handler.ServeHTTP(w, r)
	})

	// Session management routes
	http.HandleFunc("/api/issues/", func(w http.ResponseWriter, r *http.Request) {
		// Handle /api/issues/:number/* routes
		path := strings.TrimPrefix(r.URL.Path, "/api/issues/")
		if path != "" && path != r.URL.Path {
			mu.RLock()
			handler := sessionsHandler
			mu.RUnlock()
			handler.HandleIssueRoutes(w, r)
			return
		}
		http.NotFound(w, r)
	})

	http.HandleFunc("/api/sessions", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		handler := sessionsHandler
		mu.RUnlock()
		handler.ListSessionsHandler(w, r)
	})

	http.HandleFunc("/api/sessions/", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		handler := sessionsHandler
		mu.RUnlock()
		handler.GetSessionHandler(w, r)
	})

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "OK")
	})

	// Config endpoint for frontend
	http.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		if r.Method == "POST" {
			var req struct {
				Repository       string `json:"repository"`
				ClosedIssueLimit *int   `json:"closed_issue_limit,omitempty"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				http.Error(w, "Invalid request body", http.StatusBadRequest)
				return
			}

			if req.Repository == "" {
				http.Error(w, "Repository is required", http.StatusBadRequest)
				return
			}

			// Validate repository format (owner/repo)
			if !repoPattern.MatchString(req.Repository) {
				http.Error(w, "Repository must be in 'owner/repo' format", http.StatusBadRequest)
				return
			}

			// Update config
			cfg.GitHub.Repository = req.Repository
			if req.ClosedIssueLimit != nil {
				cfg.GitHub.ClosedIssueLimit = *req.ClosedIssueLimit
			}

			// Save to file
			if err := config.Save(configPath, cfg); err != nil {
				http.Error(w, "Failed to save config: "+err.Error(), http.StatusInternalServerError)
				return
			}

			// Update GitHub client with mutex protection
			mu.Lock()
			ghClient = github.NewClient(cfg.GitHub.Repository)
			issuesHandler = handlers.NewIssuesHandler(ghClient, cfg.GitHub.ClosedIssueLimit)
			mu.Unlock()

			log.Printf("Config updated: repository=%s, closed_issue_limit=%d", req.Repository, cfg.GitHub.ClosedIssueLimit)

			json.NewEncoder(w).Encode(map[string]interface{}{
				"repository":         cfg.GitHub.Repository,
				"closed_issue_limit": cfg.GitHub.ClosedIssueLimit,
				"message":            "Config saved successfully",
			})
			return
		}

		// GET request
		json.NewEncoder(w).Encode(map[string]interface{}{
			"repository":         cfg.GitHub.Repository,
			"closed_issue_limit": cfg.GitHub.ClosedIssueLimit,
			"host":               cfg.Server.Host,
			"backend_port":       cfg.Server.BackendPort,
			"frontend_port":      cfg.Server.FrontendPort,
		})
	})

	// Determine port: env var > config > default
	port := os.Getenv("PORT")
	if port == "" && cfg.Server.BackendPort > 0 {
		port = strconv.Itoa(cfg.Server.BackendPort)
	}
	if port == "" {
		port = "8083"
	}
	port = ":" + port
	log.Printf("Starting server on %s", port)
	log.Printf("API endpoint: http://%s%s/api/issues", cfg.Server.Host, port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}
