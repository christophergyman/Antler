/**
 * Devcontainer Template Definitions
 * Preset templates for common development environments
 */

export interface DevcontainerTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly content: string;
}

export const DEVCONTAINER_TEMPLATES: readonly DevcontainerTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Minimal starter template",
    content: JSON.stringify(
      {
        name: "dev-environment",
        image: "mcr.microsoft.com/devcontainers/base:ubuntu",
        features: {},
        customizations: {
          vscode: {
            extensions: [],
          },
        },
      },
      null,
      2
    ),
  },
  {
    id: "nodejs",
    name: "Node.js",
    description: "Node.js 20 with npm",
    content: JSON.stringify(
      {
        name: "node-dev",
        image: "mcr.microsoft.com/devcontainers/javascript-node:20",
        features: {},
        customizations: {
          vscode: {
            extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
          },
        },
        postCreateCommand: "npm install",
      },
      null,
      2
    ),
  },
  {
    id: "python",
    name: "Python",
    description: "Python 3.12 with pip",
    content: JSON.stringify(
      {
        name: "python-dev",
        image: "mcr.microsoft.com/devcontainers/python:3.12",
        features: {},
        customizations: {
          vscode: {
            extensions: ["ms-python.python", "ms-python.vscode-pylance"],
          },
        },
        postCreateCommand: "pip install -r requirements.txt || true",
      },
      null,
      2
    ),
  },
  {
    id: "go",
    name: "Go",
    description: "Go 1.22",
    content: JSON.stringify(
      {
        name: "go-dev",
        image: "mcr.microsoft.com/devcontainers/go:1.22",
        features: {},
        customizations: {
          vscode: {
            extensions: ["golang.go"],
          },
        },
        postCreateCommand: "go mod download || true",
      },
      null,
      2
    ),
  },
  {
    id: "rust",
    name: "Rust",
    description: "Rust with cargo",
    content: JSON.stringify(
      {
        name: "rust-dev",
        image: "mcr.microsoft.com/devcontainers/rust:latest",
        features: {},
        customizations: {
          vscode: {
            extensions: ["rust-lang.rust-analyzer"],
          },
        },
        postCreateCommand: "cargo build || true",
      },
      null,
      2
    ),
  },
] as const;
