# Antler

A modern Electron desktop application built with React, TypeScript, Tailwind CSS, and Bun.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 33 | Desktop application framework |
| React | 18 | UI library |
| TypeScript | 5 | Type-safe JavaScript |
| Tailwind CSS | 3 | Utility-first CSS framework |
| Bun | latest | JavaScript runtime & package manager |
| electron-vite | 5 | Build tooling for Electron |
| Playwright | 1.57 | E2E testing framework |

## Prerequisites

- [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- Git

## Installation

```bash
git clone https://github.com/christophergyman/Antler.git
cd Antler
bun install
```

## Development

Start the development server with hot reload:

```bash
bun run dev
```

## Building

```bash
# Build for development/testing
bun run build

# Preview the production build
bun run preview

# Create distributable packages
bun run package
```

The `package` command creates platform-specific distributables:
- **macOS:** DMG and ZIP
- **Windows:** NSIS installer and ZIP
- **Linux:** AppImage and DEB

## E2E Testing

```bash
# Run tests in headless mode
bun run test:e2e

# Run tests with visible browser
bun run test:e2e:headed

# Interactive debugging mode
bun run test:e2e:debug
```

## Project Structure

```
src/
├── main/          # Electron main process
├── preload/       # Preload scripts (IPC bridge)
└── renderer/      # React application

e2e/
├── fixtures/      # Playwright test fixtures
└── tests/         # E2E test files
```

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `bun run dev` | Start development server with hot reload |
| `build` | `bun run build` | Build the application |
| `preview` | `bun run preview` | Preview the built application |
| `package` | `bun run package` | Build and package for distribution |
| `test:e2e` | `bun run test:e2e` | Run E2E tests headless |
| `test:e2e:headed` | `bun run test:e2e:headed` | Run E2E tests with visible browser |
| `test:e2e:debug` | `bun run test:e2e:debug` | Run E2E tests in debug mode |

## Manual Testing

To test IPC calls, open DevTools in the Electron window (Cmd+Option+I) and run in the console:

```javascript
await window.electron.fetchGitHubIssues()  // Fetch issues from configured repo
await window.electron.getCards()            // Get current cards
await window.electron.reloadConfig()        // Reload antler.yaml config
```

## Configuration

| File | Purpose |
|------|---------|
| `electron.vite.config.ts` | electron-vite build configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `tsconfig.json` | TypeScript configuration |
| `e2e/playwright.config.ts` | Playwright E2E test configuration |
| `antler.yaml` | Local config (create from `antler.example.yaml`) |
