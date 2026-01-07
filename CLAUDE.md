# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antler is a self-hostable Kanban board for managing multi-agent workflows. It displays GitHub Issues as draggable task cards organized into columns based on issue labels.

## Architecture

**Backend (Go):** REST API server that fetches GitHub issues via the `gh` CLI and transforms them into Kanban-structured data.
- Entry point: `backend/main.go`
- Loads config from `antler-config.yaml` (GitHub repository setting)
- Uses GitHub CLI (`gh`) for API access - must be installed and authenticated
- Maps issues to columns by label: "feature" → Feature, "development" → Dev, "test/merge" → Test/Merge
- Parses issue body sections: `## Problem`, `## Solution`, `## Alternatives`, `## Additional Context`

**Frontend (React + TypeScript + Vite):** Interactive Kanban board with drag-and-drop.
- Main component: `kanban-app/src/App.tsx` - handles state, drag-and-drop, modals
- Uses Framer Motion for animations
- Warm macOS-inspired design with glass-morphism effects

**API Endpoints:**
- `GET /api/issues` - Returns columns with tasks as JSON
- `GET /health` - Health check

## Common Commands

### Build and Run Everything
```bash
./build.sh  # Builds backend, starts both services (frontend :3000, backend :8082)
```

### Backend Only
```bash
cd backend
go build -o ../antler-backend .
PORT=8082 ../antler-backend
```

### Frontend Only
```bash
cd kanban-app
npm run dev      # Dev server with HMR
npm run build    # Production build (tsc + vite)
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Configuration

Edit `antler-config.yaml` to set the GitHub repository:
```yaml
github:
  repository: "owner/repo"
```

## Prerequisites

- Go 1.23+
- Node.js or Bun
- GitHub CLI (`gh`) installed and authenticated
