import { test, expect } from '../fixtures/electron-app';

test.describe('UI Tests', () => {
  test('Hello World button renders', async ({ window }) => {
    const button = window.getByRole('button', { name: 'Hello World' });
    await expect(button).toBeVisible();
  });

  test('button has correct styling', async ({ window }) => {
    const button = window.getByRole('button', { name: 'Hello World' });
    await expect(button).toHaveClass(/bg-blue-600/);
    await expect(button).toHaveClass(/text-white/);
  });

  test('button is clickable', async ({ window }) => {
    const button = window.getByRole('button', { name: 'Hello World' });
    await button.click();
  });

  test('page has centered content', async ({ window }) => {
    const container = window.locator('div.flex.items-center.justify-center');
    await expect(container).toBeVisible();
  });

  test('screenshot matches', async ({ window }) => {
    await expect(window).toHaveScreenshot('main-window.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
