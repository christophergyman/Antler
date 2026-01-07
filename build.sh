#!/bin/bash

TAILSCALE_IP="100.100.66.102"
FRONTEND_PORT=3000
BACKEND_PORT=8082

echo "=========================================="
echo "  Antler - Kanban Board"
echo "=========================================="
echo ""
echo "Building Go backend..."
echo ""

cd "$(dirname "$0")/backend" || exit 1
go build -o ../antler-backend . || exit 1

cd "$(dirname "$0")" || exit 1

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

cd "$(dirname "$0")/kanban-app" || exit 1

cleanup() {
    echo ""
    echo "Stopping backend..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT}
