import { test, expect } from '../fixtures/electron-app';

test.describe('IPC Tests', () => {
  test('preload exposes electron API', async ({ window }) => {
    const hasElectron = await window.evaluate(() => {
      return 'electron' in window;
    });
    expect(hasElectron).toBe(true);
  });

  test('platform is exposed correctly', async ({ window }) => {
    const platform = await window.evaluate(() => {
      return (window as any).electron.platform;
    });
    expect(['darwin', 'win32', 'linux']).toContain(platform);
  });

  test('context isolation is working', async ({ window }) => {
    const hasRequire = await window.evaluate(() => {
      return 'require' in window;
    });
    expect(hasRequire).toBe(false);
  });

  test('node integration is disabled', async ({ window }) => {
    const hasProcess = await window.evaluate(() => {
      return typeof (window as any).process !== 'undefined';
    });
    expect(hasProcess).toBe(false);
  });
});
