#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/antler-config.yaml"

# Parse config values from antler-config.yaml
if [ -f "$CONFIG_FILE" ]; then
    TAILSCALE_IP=$(grep "host:" "$CONFIG_FILE" | head -1 | sed 's/.*host:[[:space:]]*"\([^"]*\)".*/\1/' | tr -d ' ')
    BACKEND_PORT=$(grep "backend_port:" "$CONFIG_FILE" | sed 's/.*backend_port:[[:space:]]*//' | tr -d ' ')
    FRONTEND_PORT=$(grep "frontend_port:" "$CONFIG_FILE" | sed 's/.*frontend_port:[[:space:]]*//' | tr -d ' ')
fi

# Defaults if not found in config
TAILSCALE_IP=${TAILSCALE_IP:-"localhost"}
BACKEND_PORT=${BACKEND_PORT:-8083}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# Kill any existing processes on our ports (only antler/node, not Docker)
kill_port() {
    local port=$1
    local pid=$(lsof -t -i:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        local proc_name=$(ps -p $pid -o comm= 2>/dev/null)
        # Only kill our own processes, not Docker containers
        if [[ "$proc_name" == "antler-backend" ]] || [[ "$proc_name" == "node" ]]; then
            echo "Stopping existing process on port $port (PID: $pid)..."
            kill $pid 2>/dev/null
            sleep 1
        fi
    fi
}

kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

echo "=========================================="
echo "  Antler - Kanban Board"
echo "=========================================="
echo ""
echo "Building Go backend..."
echo ""

cd "$SCRIPT_DIR/backend" || exit 1
go build -o ../antler-backend . || exit 1

cd "$SCRIPT_DIR" || exit 1

echo "Starting backend on port ${BACKEND_PORT}..."
PORT=${BACKEND_PORT} ./antler-backend &
BACKEND_PID=$!

echo ""
echo "Starting frontend on port ${FRONTEND_PORT}..."
echo ""
echo "Connect from your local machine at:"
echo ""
echo "  Frontend: http://${TAILSCALE_IP}:${FRONTEND_PORT}"
echo "  Backend:  http://${TAILSCALE_IP}:${BACKEND_PORT}/api/issues"
echo ""
echo "=========================================="
echo ""

cd "$SCRIPT_DIR/kanban-app" || exit 1

cleanup() {
    echo ""
    echo "Stopping backend..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

VITE_BACKEND_PORT=${BACKEND_PORT} npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT}
