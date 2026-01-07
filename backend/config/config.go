package config

import (
	"os"
	"regexp"

	"gopkg.in/yaml.v3"
)

type Config struct {
	GitHub GitHubConfig `yaml:"github"`
	Server ServerConfig `yaml:"server"`
}

type GitHubConfig struct {
	Repository string `yaml:"repository"`
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

	// Replace repository line while preserving comments
	// Matches: repository: "value" or repository: 'value' or repository: value
	repoRegex := regexp.MustCompile(`(?m)^(\s*repository:\s*)["']?[^"'\n]*["']?(.*)$`)
	updated := repoRegex.ReplaceAllString(string(existing), `${1}"`+cfg.GitHub.Repository+`"${2}`)

	return os.WriteFile(path, []byte(updated), 0644)
}
