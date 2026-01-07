package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/chezu/antler/backend/config"
	"github.com/chezu/antler/backend/github"
	"github.com/chezu/antler/backend/handlers"
)

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
	for _, path := range configPaths {
		cfg, err = config.Load(path)
		if err == nil {
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

	// Create GitHub client
	ghClient := github.NewClient(cfg.GitHub.Repository)

	// Create handlers
	issuesHandler := handlers.NewIssuesHandler(ghClient)

	// Setup routes
	http.Handle("/api/issues", issuesHandler)

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "OK")
	})

	// Config endpoint for frontend
	http.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
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
