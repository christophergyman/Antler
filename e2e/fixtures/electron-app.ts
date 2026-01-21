import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TestFixtures = {
  electronApp: ElectronApplication;
  window: Page;
};

export const test = base.extend<TestFixtures>({
  electronApp: async ({}, use) => {
    const projectRoot = path.resolve(__dirname, '../..');

    execSync('bun run build', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    const electronApp = await electron.launch({
      args: [path.join(projectRoot, 'dist/main/index.js')],
      cwd: projectRoot,
      env: { ...process.env, ELECTRON_E2E_TEST: '1' },
    });

    await use(electronApp);

    await electronApp.close();
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
