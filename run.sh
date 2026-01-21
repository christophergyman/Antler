#!/bin/bash

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    bun install
fi

echo "Building application..."
bun run build

echo "Starting Electron app..."
bun run start
