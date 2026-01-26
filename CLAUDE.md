# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antler is a Tauri v2 desktop application for managing parallel GitHub work sessions. Built with React 18, TypeScript, Tailwind CSS, and a minimal Rust backend.

## Prerequisites

- **Bun** - JavaScript runtime and package manager
- **Rust** (stable) - Required for Tauri backend compilation
- **Git** - Version control
- **GitHub CLI** (`gh`) - Required for fetching issues and PRs
- **Docker runtime** - Required for devcontainer work sessions:
  - **macOS**: [Colima](https://github.com/abiosoft/colima) (`brew install colima`) - auto-started by Antler
  - **Linux/Windows**: Docker Desktop or Docker daemon

## Commands

```bash
# Install dependencies
bun install

# Development (hot reload)
bun run dev

# Build
bun run build

# E2E tests
bun run test:e2e              # headless
bun run test:e2e:headed       # visible browser
bun run test:e2e:debug        # interactive debug
```

## Configuration

Antler stores its configuration in the platform-specific app data directory:

| Platform | Location |
|----------|----------|
| **macOS** | `~/Library/Application Support/com.antler.app/antler.yaml` |
| **Windows** | `%APPDATA%/com.antler.app/antler.yaml` |
| **Linux** | `~/.config/com.antler.app/antler.yaml` |

### Settings Panel (Recommended)

Users can configure Antler via the in-app Settings panel (gear icon). Settings are automatically saved to the config file.

### Manual Configuration

Create/edit the config file directly. See `antler.example.yaml` for the full schema:

```yaml
github:
  repository: owner/repo-name

# Optional: Terminal settings for opening worktrees
terminal:
  app: iTerm           # App name or full path
  postOpenCommand: bun run dev  # Command to run after opening
```

The user must also be authenticated with GitHub CLI (`gh auth login`).

## Tauri Philosophy: TypeScript-First

**All business logic lives in TypeScript.** Tauri is used primarily as a cross-platform compilation target, not as a backend framework.

The Rust backend should remain minimal - its role is to host plugins that provide native capabilities (shell execution, filesystem access) which TypeScript cannot access directly in a WebView. The actual logic for using those capabilities stays in TypeScript.

When native functionality is needed:
1. **Prefer official Tauri plugins** (`@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`) - these expose native APIs to TypeScript
2. **If a custom Rust command is required**, define it in Rust and invoke it from TypeScript via Tauri's IPC - but keep the command thin (just the native bridge) with logic in TypeScript

## Tauri Inter-Process Communication (IPC)

Tauri uses asynchronous message passing between the WebView (frontend) and Rust (backend). See the [official IPC documentation](https://v2.tauri.app/concept/inter-process-communication/) for implementation details.

**Two IPC primitives:**
- **Commands**: Frontend invokes Rust functions via `invoke()`. Arguments and return values must be JSON-serializable.
- **Events**: Fire-and-forget messages that can be emitted by either frontend or backend.

In this project, we use Tauri plugins which handle IPC internally. If custom commands are ever needed, they should be thin wrappers that delegate to TypeScript for business logic.

## Tauri Configuration

Key configuration files in `src-tauri/`:

- **`tauri.conf.json`** - App metadata, window settings, build commands, plugin scopes
- **`capabilities/default.json`** - Permission definitions for plugins

**Current permissions:**
- `shell:allow-execute` - Execute shell commands (scoped to `gh`, `git`, `docker`, `colima`, `devcontainer`)
- `fs:allow-read`, `fs:allow-exists` - Read files (for config loading)
- `fs:allow-write`, `fs:allow-mkdir`, `fs:allow-remove` - Write files (for logging)
- `path:default` - Access path utilities
- `os:default` - Platform detection (for macOS-specific Colima handling)

**Shell plugin scope:** Commands `gh`, `git`, `docker`, `colima`, `devcontainer` are allowed. To add other commands, update `shell:allow-execute` in `src-tauri/capabilities/default.json`.

## Architecture

### Tauri Two-Tier Model
- **WebView (Frontend)** - React app with all business logic in TypeScript
- **Rust Backend** (`src-tauri/`) - Minimal plugin host (~10 lines of code)

### Directory Structure
- **src/core/** - Shared TypeScript (Card types, operations, utilities)
- **src/services/** - Frontend services using Tauri plugins (github.ts, config.ts, cardSync.ts, logging.ts, dockerRuntime.ts)
- **src/renderer/** - React components and hooks
  - `components/` - KanbanBoard/, KanbanColumn/, KanbanCard/, DotBackground/, ui/
  - `hooks/` - useCards, useKanbanBoard, useDataSource
  - `constants/` - Status colors and column configuration
  - `data/` - Mock card data for development
- **src-tauri/** - Minimal Rust backend (plugin registration only)

### Card System
The core data structure is the `Card` - an immutable representation of a parallel work session:

- **Types** in `src/core/types/` - `Card`, `CardStatus`, `GitHubInfo`, `CIStatus`
- **Operations** in `src/core/card.ts` - factory (`createCard`), updates (`updateCard`, `updateGitHub`), status helpers, serialization
- **Collections** in `src/core/utils/collection.ts` - filtering, finding, batch ops, parallel operations (`mapParallel`, `filterParallel`)

All Card operations are **immutable** (return new objects via `Object.freeze`). Collection utilities are designed for **parallel-safe** processing.

**Status values:** `idle`, `in_progress`, `waiting`, `done`

Status changes auto-clear errors when moving cards out of the 'waiting' column.

### Build Output
Vite compiles frontend to `dist/`. Tauri builds platform-specific binaries to `src-tauri/target/`.

## UI Components

### Kanban Board
The main UI is a 4-column Kanban board with drag-and-drop:

- `KanbanBoard.tsx` - DndContext wrapper, handles drag start/end events
- `KanbanColumn.tsx` - Droppable column with color-coded header
- `KanbanCard.tsx` - Card display with title, labels, error badge
- `SortableCard.tsx` - Drag-and-drop wrapper using @dnd-kit/sortable

**Libraries:** `@dnd-kit/core`, `@dnd-kit/sortable`

**Column configuration:** Defined in `src/renderer/constants/status.ts`

| Column | Color | Purpose |
|--------|-------|---------|
| Idle | Gray | Cards not currently being worked on |
| In Progress | Blue | Active work items |
| Waiting | Amber | Blocked or awaiting review |
| Done | Green | Completed work |

## React Hooks

- **useCards** - Data fetching with loading/error state and refresh capability
- **useKanbanBoard** - Drag-and-drop handling, updates card status on drop
- **useDataSource** - Toggle between mock data and live GitHub data

## Error Handling

The codebase uses **Result types** for type-safe error handling (no thrown exceptions for expected errors):

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

- Use `ok(value)` to return success
- Use `err(error)` to return failure
- Check `result.ok` before accessing `result.value` or `result.error`
- Specific result types: `ConfigResult<T>`, `GitHubResult<T>`

## Logging System

The app uses a three-layer logging system: console output (development), DevTools visibility, and file persistence.

### Log Levels

| Level | Use Case |
|-------|----------|
| `debug` | Detailed diagnostic info (gh commands, internal operations) |
| `info` | Normal operations (app start, data refresh, status changes) |
| `warn` | Recoverable issues (config not found, retry scenarios) |
| `error` | Failures (network errors, parse errors, command failures) |

### Log Categories

| Category | Use Case |
|----------|----------|
| `system` | App lifecycle (start, shutdown, initialization) |
| `config` | Config loading and validation |
| `data_sync` | GitHub API calls, data fetching |
| `user_action` | User interactions (card moves, toggles, refreshes) |
| `performance` | Timing metrics |
| `worktree` | Git worktree operations (create, remove, list) |
| `devcontainer` | Devcontainer lifecycle (start, stop, port allocation) |
| `docker` | Docker runtime detection and Colima management |
| `prerequisites` | Tool installation checks (git, docker, devcontainer CLI) |

### Usage

```typescript
import {
  logSystem, logConfig, logDataSync, logUserAction, logPerformance,
  logWorktree, logDevcontainer, logDocker, logPrerequisites
} from '@services/logging';

// Category-specific logging
logSystem('info', 'App started');
logConfig('error', 'Config validation failed', { code: 'config_invalid' });
logDataSync('debug', 'Fetching issues', { repo: 'owner/repo' });
logUserAction('card_status_change', 'Card moved', { cardId, from, to });
logPerformance('Data fetch completed', 1234);

// Work session logging
logWorktree('info', 'Creating worktree', { branchName, cardId });
logDevcontainer('error', 'Devcontainer start failed', { code, message, port });
logDocker('info', 'Docker runtime ready');
logPrerequisites('error', 'Git not installed');

// Convenience functions
logCardStatusChange(cardId, 'idle', 'in_progress');
logDataRefresh('github', 15);

// Quick logging (defaults to system category)
debug('Diagnostic info');
info('Normal operation');
warn('Recoverable issue');
error('Failure occurred');
```

### Log Files

**Location:** Platform-specific app data directory
- macOS: `~/Library/Application Support/com.antler.app/logs/`
- Windows: `%APPDATA%/com.antler.app/logs/`
- Linux: `~/.config/com.antler.app/logs/`

**Format:** `antler-YYYY-MM-DD.log` (one file per day)

**Retention:** 5 most recent files (~25MB max)

**Line format:**
```
2024-01-23T14:30:45.123Z INFO  [user_action]   Card moved from idle to in_progress {"cardId":"abc-123"}
```

## Key Patterns

- **TypeScript-first**: All business logic, data transformations, and state management in TypeScript
- **Minimal Rust**: Backend only registers plugins; no custom commands unless absolutely necessary
- **Result types**: Use `Result<T, E>` for error handling instead of throwing exceptions
- **Cards are immutable**: Always use update functions, never mutate directly
- **Factory functions**: Use `createCard()`, `createGitHubInfo()` for type-safe object creation
- **Parallel operations**: Use `Promise.all`/`Promise.allSettled` for concurrent work
- **Tauri plugins**: Services use `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`, and `@tauri-apps/plugin-os` for native access
- **Auto-start Docker**: On macOS, Colima is auto-started at app boot if Docker isn't running
- **Path aliases**: `@core/*` for core module, `@services/*` for services
- **Drag-and-drop**: @dnd-kit with DndContext at board level, useDroppable for columns, useSortable for cards
