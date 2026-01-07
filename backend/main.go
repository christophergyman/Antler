package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	port = ":" + port
	log.Printf("Starting server on %s", port)
	log.Printf("API endpoint: http://localhost%s/api/issues", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal(err)
	}
}
