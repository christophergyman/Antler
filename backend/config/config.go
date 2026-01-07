package config

import (
	"os"

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
