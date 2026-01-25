#!/bin/bash
# Post-create script - runs once after container is created

set -e

echo "=== Antler Devcontainer Setup ==="

# Install project dependencies
echo "Installing dependencies with bun..."
bun install

# Install Playwright browsers
echo "Installing Playwright browsers..."
bunx playwright install chromium

# Setup Rust components
echo "Setting up Rust components..."
rustup component add clippy rustfmt

# Pre-build Tauri backend to warm cargo cache
echo "Pre-building Tauri backend (this may take a while on first run)..."
cd src-tauri && cargo build && cd ..

# Copy example config if antler.yaml doesn't exist
if [ ! -f "antler.yaml" ]; then
    echo "Creating antler.yaml from example..."
    cp antler.example.yaml antler.yaml
    echo "NOTE: Please update antler.yaml with your repository details"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Run 'gh auth login' to authenticate with GitHub"
echo "  2. Update antler.yaml with your repository"
echo "  3. Run 'bun run dev' to start the development server"
