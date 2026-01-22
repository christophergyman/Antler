# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antler is a Tauri v2 desktop application for managing parallel GitHub work sessions. Built with React 18, TypeScript, Tailwind CSS, and a minimal Rust backend.

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

## Architecture

### Tauri Two-Tier Model
- **WebView (Frontend)** - React app with all business logic in TypeScript
- **Rust Backend** (`src-tauri/`) - Minimal plugin host for shell and filesystem access

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

## Key Patterns

- Cards are immutable - always use update functions, never mutate directly
- Use factory functions: `createCard()`, `createGitHubInfo()`
- Parallel operations use `Promise.all`/`Promise.allSettled`
- Services use Tauri plugins (`@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`)
- Path aliases: `@core/*` for core module, `@services/*` for services
