import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import type { Card } from "./types/card";
import type { Result } from "./types/result";
import type { ConfigError, GitHubError } from "./types/result";
import { ok } from "./types/result";
import type { AntlerConfig } from "./config";
import { loadConfig } from "./config";
import { fetchIssuesWithPRs } from "./services/github";
import type { SyncResult } from "./services/cardSync";
import { syncCards } from "./services/cardSync";

// ============================================================================
// Card State (in-memory for now)
// ============================================================================

let cards: Card[] = [];

function getCards(): readonly Card[] {
  return cards;
}

function setCards(newCards: Card[]): void {
  cards = newCards;
}

// ============================================================================
// Config Cache
// ============================================================================

let cachedConfig: AntlerConfig | null = null;

function getCachedConfig(): Result<AntlerConfig, ConfigError> {
  if (cachedConfig) {
    return ok(cachedConfig);
  }

  const result = loadConfig();
  if (result.ok) {
    cachedConfig = result.value;
  }
  return result;
}

function clearConfigCache(): void {
  cachedConfig = null;
}

// ============================================================================
// IPC Handlers
// ============================================================================

type FetchIssuesResult = Result<SyncResult, ConfigError | GitHubError>;

ipcMain.handle("github:fetch-issues", async (): Promise<FetchIssuesResult> => {
  const configResult = getCachedConfig();
  if (!configResult.ok) {
    return configResult;
  }

  const issuesResult = await fetchIssuesWithPRs(configResult.value.github.repository);
  if (!issuesResult.ok) {
    return issuesResult;
  }

  const syncResult = syncCards(getCards(), issuesResult.value);
  setCards(syncResult.cards);

  return ok(syncResult);
});

ipcMain.handle("cards:get", (): Card[] => {
  return [...getCards()];
});

ipcMain.handle("config:reload", (): Result<AntlerConfig, ConfigError> => {
  clearConfigCache();
  return getCachedConfig();
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: !process.env.ELECTRON_E2E_TEST,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load from Vite dev server during development, file in production
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
