# Antler

**A Kanban-style desktop app for managing parallel GitHub work sessions.**

Antler provides a visual workflow to track issues and PRs across multiple branches. Drag cards between columns to update status, see CI results at a glance, and switch between live GitHub data and mock mode for development.

![Kanban Board](./docs/assets/screenshot-kanban.png)

## Features

- **Kanban Board** - 4-column workflow: Idle, In Progress, Waiting, Done
- **Drag-and-Drop** - Move cards between columns to change status instantly
- **GitHub Integration** - Fetches issues and PRs via GitHub CLI with labels and CI status
- **Mock Data Mode** - Toggle for development without API calls

## Screenshots

| Main View | Drag-and-Drop |
|-----------|---------------|
| ![Kanban](./docs/assets/screenshot-kanban.png) | ![Drag](./docs/assets/screenshot-drag.png) |

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Tauri | 2 | Lightweight desktop application framework |
| React | 18 | UI library |
| TypeScript | 5 | Type-safe JavaScript |
| Tailwind CSS | 3 | Utility-first CSS framework |
| Bun | latest | JavaScript runtime & package manager |
| Vite | 7 | Frontend build tooling |
| Rust | stable | Minimal backend (plugin hosting) |
| Playwright | 1.57 | E2E testing framework |

## Prerequisites

- [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- [Rust](https://rustup.rs) - Required for Tauri backend compilation
- Git
- [GitHub CLI](https://cli.github.com) (`gh`) - For fetching issues and PRs

## Installation

```bash
git clone https://github.com/christophergyman/Antler.git
cd Antler
bun install
```

## Configuration

Create `antler.yaml` in the project root (use `antler.example.yaml` as a template):

```yaml
github:
  repository: owner/repo-name
```

Make sure you're authenticated with GitHub CLI:

```bash
gh auth login
```

## Development

Start the development server with hot reload:

```bash
bun run dev
```

This runs both the Vite dev server and the Tauri application. First run will compile Rust dependencies (takes a few minutes), subsequent runs are fast.

## Building

```bash
# Build for production
bun run build
```

This creates platform-specific binaries in `src-tauri/target/release/`.

## E2E Testing

```bash
# Run tests in headless mode
bun run test:e2e

# Run tests with visible browser
bun run test:e2e:headed

# Interactive debugging mode
bun run test:e2e:debug
```

## Architecture

Antler uses Tauri's two-tier architecture with all business logic in TypeScript:

```
┌─────────────────────────────────────┐
│        WebView (Frontend)           │
│ ┌─────────────────────────────────┐ │
│ │   React App + TypeScript        │ │
│ │   - src/core/      (types, ops) │ │
│ │   - src/services/  (github, fs) │ │
│ │   - src/renderer/  (components) │ │
│ └─────────────────────────────────┘ │
│              │                      │
│    Tauri JS Plugins                 │
│    (@tauri-apps/plugin-shell)       │
│    (@tauri-apps/plugin-fs)          │
└─────────────────────────────────────┘
               │
┌─────────────────────────────────────┐
│      Rust Backend (minimal)         │
│      - Plugin hosting only          │
│      - ~10 lines of code            │
└─────────────────────────────────────┘
```

## Project Structure

```
src/
├── core/           # Shared TypeScript (types, card operations, utilities)
│   ├── card.ts     # Card factory & immutable operations
│   ├── types/      # Card, GitHubInfo, CIStatus, Result types
│   └── utils/      # Collection utilities, UID generation
├── services/       # Frontend services using Tauri plugins
│   ├── github.ts   # GitHub CLI wrapper (@tauri-apps/plugin-shell)
│   ├── config.ts   # Config loader (@tauri-apps/plugin-fs)
│   └── cardSync.ts # Card sync logic
└── renderer/       # React application
    ├── components/ # KanbanBoard/, KanbanColumn/, KanbanCard/, DotBackground/, ui/
    ├── hooks/      # useCards, useKanbanBoard, useDataSource
    ├── constants/  # Status colors and column configuration
    └── data/       # Mock card data for development

src-tauri/          # Minimal Rust backend
├── src/            # ~10 lines: plugin registration
├── Cargo.toml      # Rust dependencies
├── tauri.conf.json # Tauri configuration
└── capabilities/   # Permission definitions

e2e/
├── fixtures/       # Playwright test fixtures
└── tests/          # E2E test files
```

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun run dev` | Start Tauri development with hot reload |
| `build` | `bun run build` | Build production application |
| `vite:dev` | `bun run vite:dev` | Start Vite dev server only |
| `vite:build` | `bun run vite:build` | Build frontend only |
| `test:e2e` | `bun run test:e2e` | Run E2E tests headless |
| `test:e2e:headed` | `bun run test:e2e:headed` | Run E2E tests with visible browser |
| `test:e2e:debug` | `bun run test:e2e:debug` | Run E2E tests in debug mode |

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration with path aliases |
| `src-tauri/tauri.conf.json` | Tauri app configuration |
| `src-tauri/capabilities/default.json` | Tauri permission definitions |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `tsconfig.json` | TypeScript configuration with path aliases |
| `e2e/playwright.config.ts` | Playwright E2E test configuration |
| `antler.yaml` | Local config (create from `antler.example.yaml`) |

## Key Patterns

- **Immutable Cards**: All card operations return new frozen objects
- **Result Types**: Type-safe error handling with `Result<T, E>`
- **Path Aliases**: Use `@core/*` and `@services/*` for clean imports
- **Parallel Operations**: Collection utilities support `Promise.all`/`Promise.allSettled`
