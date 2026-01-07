# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antler is a self-hostable Kanban board for managing multi-agent workflows. It displays GitHub Issues as draggable task cards organized into columns based on issue labels.

## Architecture

**Backend (Go):** REST API server that fetches GitHub issues via the `gh` CLI and transforms them into Kanban-structured data.
- Entry point: `backend/main.go`
- Config: `backend/config/config.go` - loads/saves `antler-config.yaml`
- GitHub client: `backend/github/client.go` - fetches issues via `gh` CLI
- Handlers: `backend/handlers/issues.go` - maps issues to columns, parses body sections
- Uses GitHub CLI (`gh`) for API access - must be installed and authenticated

**Column Mapping (by label):**
- `feature` → Feature column
- `development` → Dev column
- `test/merge` → Test/Merge column
- Closed issues → Done column

**Issue Body Parsing:** Extracts `## Problem`, `## Solution`, `## Alternatives`, `## Additional Context` sections

**Frontend (React + TypeScript + Vite):** Interactive Kanban board with drag-and-drop.
- Main component: `kanban-app/src/App.tsx` - state, drag-and-drop, modals, settings
- Uses Framer Motion for animations
- Supports light/dark/system theme with localStorage persistence
- Settings modal for runtime config changes (repository, closed issue limit, theme)

**API Endpoints:**
- `GET /api/issues` - Returns columns with tasks as JSON
- `GET /api/config` - Returns current configuration
- `POST /api/config` - Updates repository and closed_issue_limit (saves to file)
- `GET /health` - Health check

## Common Commands

### Build and Run Everything
```bash
./build.sh  # Builds backend, starts both services (frontend :3000, backend :8083)
```

### Backend Only
```bash
cd backend
go build -o ../antler-backend .
PORT=8083 ../antler-backend
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

Edit `antler-config.yaml`:
```yaml
github:
  repository: "owner/repo"
  closed_issue_limit: 15  # Number of closed issues in Done column

server:
  host: "localhost"       # Server hostname/IP
  backend_port: 8083
  frontend_port: 3000
```

Repository can also be changed at runtime via the Settings modal in the UI.

## Claude Code Integration

**Custom Commands (`.claude/commands/`):**
- `/feature` - Create a GitHub feature request via interview
- `/bug` - Create a GitHub bug report via interview
- `/review` - Review code changes on current branch vs main

**Skills (`.claude/skills/`):**
- `frontend-design` - Create production-grade frontend interfaces

**GitHub Issue Templates (`.github/ISSUE_TEMPLATE/`):**
- `bug_report.md` - Bug report template
- `feature_request.md` - Feature request template

## Prerequisites

- Go 1.23+
- Node.js or Bun
- GitHub CLI (`gh`) installed and authenticated
