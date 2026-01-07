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
	"sync"

	"github.com/chezu/antler/backend/config"
	"github.com/chezu/antler/backend/github"
	"github.com/chezu/antler/backend/handlers"
)

// repoPattern validates "owner/repo" format
var repoPattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$`)

func main() {
	// Find config file - look in parent directory (Antler root)
	execPath, err := os.Executable()
	if err != nil {
		execPath = "."
	}

	// Try multiple config locations
	configPaths := []string{
		"../antler-config.yaml",
		filepath.Join(filepath.Dir(execPath), "..", "antler-config.yaml"),
		"/home/chezu/github/Antler/antler-config.yaml",
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

	// Create GitHub client with mutex for thread-safe updates
	var mu sync.RWMutex
	ghClient := github.NewClient(cfg.GitHub.Repository)
	issuesHandler := handlers.NewIssuesHandler(ghClient)

	// Setup routes - use wrapper to always use current handler
	http.HandleFunc("/api/issues", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		handler := issuesHandler
		mu.RUnlock()
		handler.ServeHTTP(w, r)
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
				Repository string `json:"repository"`
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

			// Update config and save to file
			cfg.GitHub.Repository = req.Repository
			if err := config.Save(configPath, cfg); err != nil {
				http.Error(w, "Failed to save config: "+err.Error(), http.StatusInternalServerError)
				return
			}

			// Update GitHub client with mutex protection
			mu.Lock()
			ghClient = github.NewClient(cfg.GitHub.Repository)
			issuesHandler = handlers.NewIssuesHandler(ghClient)
			mu.Unlock()

			log.Printf("Config updated: repository changed to %s", req.Repository)

			json.NewEncoder(w).Encode(map[string]interface{}{
				"repository": cfg.GitHub.Repository,
				"message":    "Config saved successfully",
			})
			return
		}

		// GET request
		json.NewEncoder(w).Encode(map[string]interface{}{
			"repository":    cfg.GitHub.Repository,
			"host":          cfg.Server.Host,
			"backend_port":  cfg.Server.BackendPort,
			"frontend_port": cfg.Server.FrontendPort,
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
