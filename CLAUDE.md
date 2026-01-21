# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Antler is an Electron desktop application for managing parallel GitHub work sessions. Built with React 18, TypeScript, Tailwind CSS, and electron-vite.

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

### Electron Three-Process Model
- **Main process** (`src/main/`) - Node.js backend, window management, system APIs
- **Preload** (`src/preload/`) - IPC bridge with context isolation
- **Renderer** (`src/renderer/`) - React frontend

### Card System
The core data structure is the `Card` - an immutable representation of a parallel work session:

- **Types** in `src/main/types/` - `Card`, `CardStatus`, `GitHubInfo`, `CIStatus`
- **Operations** in `src/main/card.ts` - factory (`createCard`), updates (`updateCard`, `updateGitHub`), status helpers, serialization
- **Collections** in `src/main/utils/collection.ts` - filtering, finding, batch ops, parallel operations (`mapParallel`, `filterParallel`)

All Card operations are **immutable** (return new objects via `Object.freeze`). Collection utilities are designed for **parallel-safe** processing.

### Build Output
electron-vite compiles to `dist/` with separate folders for main, preload, and renderer. The `release/` folder contains distributable packages.

## Key Patterns

- Cards are immutable - always use update functions, never mutate directly
- Use factory functions: `createCard()`, `createGitHubInfo()`
- Parallel operations use `Promise.all`/`Promise.allSettled`
- Context isolation enabled - renderer communicates via preload bridge only
