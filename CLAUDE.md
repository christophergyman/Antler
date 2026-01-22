# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antler is a Tauri v2 desktop application for managing parallel GitHub work sessions. Built with React 18, TypeScript, Tailwind CSS, and a minimal Rust backend.

## Prerequisites

- **Bun** - JavaScript runtime and package manager
- **Rust** (stable) - Required for Tauri backend compilation
- **Git** - Version control
- **GitHub CLI** (`gh`) - Required for fetching issues and PRs

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

The app requires an `antler.yaml` file in the project root (use `antler.example.yaml` as template):

```yaml
github:
  repository: owner/repo-name
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
- `shell:allow-execute` - Execute shell commands (scoped to `gh` only)
- `fs:allow-read`, `fs:allow-exists` - Read files (for config loading)
- `path:default` - Access path utilities

**Shell plugin scope:** Only the `gh` command is allowed. To add other commands, update `plugins.shell.scope` in `tauri.conf.json`.

## Architecture

### Tauri Two-Tier Model
- **WebView (Frontend)** - React app with all business logic in TypeScript
- **Rust Backend** (`src-tauri/`) - Minimal plugin host (~10 lines of code)

### Directory Structure
- **src/core/** - Shared TypeScript (Card types, operations, utilities)
- **src/services/** - Frontend services using Tauri plugins (github.ts, config.ts, cardSync.ts)
- **src/renderer/** - React components and hooks
- **src-tauri/** - Minimal Rust backend (plugin registration only)

### Card System
The core data structure is the `Card` - an immutable representation of a parallel work session:

- **Types** in `src/core/types/` - `Card`, `CardStatus`, `GitHubInfo`, `CIStatus`
- **Operations** in `src/core/card.ts` - factory (`createCard`), updates (`updateCard`, `updateGitHub`), status helpers, serialization
- **Collections** in `src/core/utils/collection.ts` - filtering, finding, batch ops, parallel operations (`mapParallel`, `filterParallel`)

All Card operations are **immutable** (return new objects via `Object.freeze`). Collection utilities are designed for **parallel-safe** processing.

### Build Output
Vite compiles frontend to `dist/`. Tauri builds platform-specific binaries to `src-tauri/target/`.

## Error Handling

The codebase uses **Result types** for type-safe error handling (no thrown exceptions for expected errors):

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

- Use `ok(value)` to return success
- Use `err(error)` to return failure
- Check `result.ok` before accessing `result.value` or `result.error`
- Specific result types: `ConfigResult<T>`, `GitHubResult<T>`

## Key Patterns

- **TypeScript-first**: All business logic, data transformations, and state management in TypeScript
- **Minimal Rust**: Backend only registers plugins; no custom commands unless absolutely necessary
- **Result types**: Use `Result<T, E>` for error handling instead of throwing exceptions
- **Cards are immutable**: Always use update functions, never mutate directly
- **Factory functions**: Use `createCard()`, `createGitHubInfo()` for type-safe object creation
- **Parallel operations**: Use `Promise.all`/`Promise.allSettled` for concurrent work
- **Tauri plugins**: Services use `@tauri-apps/plugin-shell` and `@tauri-apps/plugin-fs` for native access
- **Path aliases**: `@core/*` for core module, `@services/*` for services
