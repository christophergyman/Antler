import { test, expect } from '../fixtures/electron-app';

test.describe('App Launch', () => {
  test('app starts successfully', async ({ electronApp }) => {
    const isPackaged = await electronApp.evaluate(async ({ app }) => {
      return app.isPackaged;
    });
    expect(isPackaged).toBe(false);
  });

  test('window is created', async ({ window }) => {
    expect(window).toBeTruthy();
  });

  test('window has correct title', async ({ window }) => {
    const title = await window.title();
    expect(title).toBeTruthy();
  });

  test('window dimensions are reasonable', async ({ electronApp, window }) => {
    // window fixture ensures window is ready before checking dimensions
    const windowState = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const bounds = mainWindow.getBounds();
      return bounds;
    });

    expect(windowState.width).toBeGreaterThanOrEqual(400);
    expect(windowState.height).toBeGreaterThanOrEqual(300);
  });
});
