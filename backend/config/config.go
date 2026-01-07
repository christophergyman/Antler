package config

import (
	"fmt"
	"os"
	"regexp"

	"gopkg.in/yaml.v3"
)

type Config struct {
	GitHub GitHubConfig `yaml:"github"`
	Server ServerConfig `yaml:"server"`
}

type GitHubConfig struct {
	Repository       string `yaml:"repository"`
	ClosedIssueLimit int    `yaml:"closed_issue_limit"`
}

type ServerConfig struct {
	Host         string `yaml:"host"`
	BackendPort  int    `yaml:"backend_port"`
	FrontendPort int    `yaml:"frontend_port"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func Save(path string, cfg *Config) error {
	// Read existing file to preserve comments
	existing, err := os.ReadFile(path)
	if err != nil {
		// If file doesn't exist, create fresh
		data, err := yaml.Marshal(cfg)
		if err != nil {
			return err
		}
		return os.WriteFile(path, data, 0644)
	}

	content := string(existing)

	// Replace repository line while preserving comments
	repoRegex := regexp.MustCompile(`(?m)^(\s*repository:\s*)["']?[^"'\n]*["']?(.*)$`)
	content = repoRegex.ReplaceAllString(content, `${1}"`+cfg.GitHub.Repository+`"${2}`)

	// Replace or add closed_issue_limit
	limitRegex := regexp.MustCompile(`(?m)^(\s*closed_issue_limit:\s*)\d+(.*)$`)
	if limitRegex.MatchString(content) {
		content = limitRegex.ReplaceAllString(content, `${1}`+fmt.Sprintf("%d", cfg.GitHub.ClosedIssueLimit)+`${2}`)
	} else {
		// Add closed_issue_limit after repository line
		repoLineRegex := regexp.MustCompile(`(?m)(^\s*repository:.*$)`)
		content = repoLineRegex.ReplaceAllString(content, `${1}`+"\n  closed_issue_limit: "+fmt.Sprintf("%d", cfg.GitHub.ClosedIssueLimit))
	}

	return os.WriteFile(path, []byte(content), 0644)
}
