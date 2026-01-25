#!/bin/bash
# Post-start script - runs each time the container starts

echo "=== Antler Development Environment ==="
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Warning: node_modules not found. Run 'bun install' to install dependencies."
fi

# Check Docker accessibility
if docker info > /dev/null 2>&1; then
    echo "Docker: Available"
else
    echo "Docker: Not accessible (devcontainer features require host Docker socket)"
fi

# Check GitHub CLI auth status
if gh auth status > /dev/null 2>&1; then
    echo "GitHub CLI: Authenticated"
else
    echo "GitHub CLI: Not authenticated (run 'gh auth login')"
fi

# Check if config exists
if [ -f "antler.yaml" ]; then
    echo "Config: antler.yaml found"
else
    echo "Config: antler.yaml not found (copy from antler.example.yaml)"
fi

echo ""
echo "Available commands:"
echo "  bun run dev          - Start development server"
echo "  bun run build        - Build for production"
echo "  bun run test:e2e     - Run E2E tests"
echo ""
