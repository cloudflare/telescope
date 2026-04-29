import { test, expect } from '@playwright/test';

test.describe('Theme Switcher Gatekeeper', () => {
  const BASE_URL = 'http://localhost:4321/results'; // Use /results instead of index

  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test to start from a clean state
    await page.context().clearCookies();
  });

  test('should respect system preference by default (Light Mode)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(BASE_URL);

    // Verify background is white (Light Theme)
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Verify toggle is NOT checked
    const toggle = page.locator('#theme-toggle-input');
    await expect(toggle).not.toBeChecked();
  });

  test('should respect system preference by default (Dark Mode)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(BASE_URL);

    // Verify background is dark (Dark Theme)
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(15, 15, 15)');

    // Verify visual slider position is dark (1rem) even if checkbox is unchecked (due to no script)
    const slider = page.locator('.slider');
    await expect(slider).toHaveCSS('--slider-pos', '1rem');
  });

  test('should apply manual override and persist via cookie', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(BASE_URL);

    // Click the toggle (via label)
    await page.click('label.theme-toggle');

    // Verify background changed to dark
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(15, 15, 15)');

    // Verify visual slider position (check CSS variable on the slider element)
    const slider = page.locator('.slider');
    await expect(slider).toHaveCSS('--slider-pos', '1rem');

    // Verify cookie was set
    const cookies = await page.context().cookies();
    const themeCookie = cookies.find(c => c.name === 'theme-override');
    expect(themeCookie).toBeDefined();
    expect(themeCookie?.value).toBe('dark');
  });

  test('manual override should have priority over system preference after reload', async ({ page, context }) => {
    // 1. Set manual dark override
    await context.addCookies([{
      name: 'theme-override',
      value: 'dark',
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Emulate LIGHT system
    await page.emulateMedia({ colorScheme: 'light' });
    
    // 3. Go to page
    await page.goto(BASE_URL);

    // Verify it stays DARK because manual choice > system
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(15, 15, 15)');
  });

  test('manual light override should work on dark system', async ({ page, context }) => {
    // 1. Set manual light override
    await context.addCookies([{
      name: 'theme-override',
      value: 'light',
      domain: 'localhost',
      path: '/'
    }]);

    // 2. Emulate DARK system
    await page.emulateMedia({ colorScheme: 'dark' });

    // 3. Go to page
    await page.goto(BASE_URL);

    // Verify it stays LIGHT
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
});
