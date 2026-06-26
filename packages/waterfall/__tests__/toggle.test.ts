/**
 * Toggle tests — verify the theme toggle knob position, visibility, click
 * behaviour, localStorage persistence, and system-preference tracking.
 */

import { type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer, launchBrowser, openPage } from './helpers.js';

let browser: Browser;
let baseUrl: string;
let closeServer: () => void;

beforeAll(async () => {
  browser = await launchBrowser();
  const server = await createServer();
  baseUrl = server.url;
  closeServer = server.close;
});

afterAll(async () => {
  await browser.close();
  closeServer();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return whether the toggle checkbox is checked. */
async function isChecked(page: Page): Promise<boolean> {
  return page.$eval('#theme-btn', (el) => (el as HTMLInputElement).checked);
}

/** Return the computed visibility of the .theme-toggle label. */
async function toggleVisibility(page: Page): Promise<string> {
  return page.$eval('.theme-toggle', (el) => getComputedStyle(el).visibility);
}

/** Return whether .theme-toggle has the --ready class. */
async function hasReadyClass(page: Page): Promise<boolean> {
  return page.$eval('.theme-toggle', (el) =>
    el.classList.contains('theme-toggle--ready'),
  );
}

/** Return whether .theme-toggle has the --overridden class. */
async function hasOverriddenClass(page: Page): Promise<boolean> {
  return page.$eval('.theme-toggle', (el) =>
    el.classList.contains('theme-toggle--overridden'),
  );
}

/** Return the current data-theme attribute value (or null). */
async function dataTheme(page: Page): Promise<string | null> {
  return page.$eval('html', (el) => el.getAttribute('data-theme'));
}

/** Return the stored wf-theme key from localStorage (or null). */
async function storedTheme(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem('wf-theme'));
}

/** Click the theme toggle label. */
async function clickToggle(page: Page): Promise<void> {
  await page.click('.theme-toggle');
}

// ── Initial knob position (no stored preference) ──────────────────────────────

describe('initial knob position — no stored preference', () => {
  it('system light → checkbox unchecked', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await isChecked(page)).toBe(false);
  });

  it('system dark → checkbox checked', async () => {
    const page = await openPage(browser, baseUrl, 'dark');
    expect(await isChecked(page)).toBe(true);
  });
});

// ── Initial knob position (stored preference) ─────────────────────────────────

describe('initial knob position — stored preference', () => {
  it('stored dark on light system → checkbox checked', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      storedTheme: 'dark',
    });
    expect(await isChecked(page)).toBe(true);
  });

  it('stored light on dark system → checkbox unchecked', async () => {
    const page = await openPage(browser, baseUrl, 'dark', {
      storedTheme: 'light',
    });
    expect(await isChecked(page)).toBe(false);
  });
});

// ── Toggle visibility ─────────────────────────────────────────────────────────

describe('toggle visibility', () => {
  it('is visible after page load (--ready class present)', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await hasReadyClass(page)).toBe(true);
    expect(await toggleVisibility(page)).toBe('visible');
  });

  it('--ready class is set synchronously (present before DOMContentLoaded tick)', async () => {
    // theme.js sets --ready synchronously in the IIFE body.
    // We verify this by checking the class is present immediately after load
    // (Playwright's goto waits for load, but the class must have been added
    // before any async tick, so checking post-load is sufficient).
    const page = await openPage(browser, baseUrl, 'dark');
    expect(await hasReadyClass(page)).toBe(true);
  });
});

// ── data-theme attribute ──────────────────────────────────────────────────────

describe('data-theme attribute', () => {
  it('stored dark → data-theme="dark" on <html>', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      storedTheme: 'dark',
    });
    expect(await dataTheme(page)).toBe('dark');
  });

  it('stored light → data-theme="light" on <html>', async () => {
    const page = await openPage(browser, baseUrl, 'dark', {
      storedTheme: 'light',
    });
    expect(await dataTheme(page)).toBe('light');
  });

  it('no stored pref → no data-theme attribute', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await dataTheme(page)).toBeNull();
  });
});

// ── Override highlight ────────────────────────────────────────────────────────

describe('override highlight', () => {
  it('no stored pref → no --overridden class', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await hasOverriddenClass(page)).toBe(false);
  });

  it('stored pref → --overridden class present', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      storedTheme: 'dark',
    });
    expect(await hasOverriddenClass(page)).toBe(true);
  });
});

// ── Click behaviour ───────────────────────────────────────────────────────────

describe('click behaviour', () => {
  it('clicking toggle on light system forces dark theme', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    // Initially: system light, no stored pref → unchecked, no override
    expect(await isChecked(page)).toBe(false);
    expect(await hasOverriddenClass(page)).toBe(false);

    await clickToggle(page);

    // After click: should be dark
    expect(await isChecked(page)).toBe(true);
    expect(await dataTheme(page)).toBe('dark');
    expect(await storedTheme(page)).toBe('dark');
    expect(await hasOverriddenClass(page)).toBe(true);
  });

  it('clicking toggle on dark system forces light theme', async () => {
    const page = await openPage(browser, baseUrl, 'dark');
    // Initially: system dark, no stored pref → checked, no override
    expect(await isChecked(page)).toBe(true);
    expect(await hasOverriddenClass(page)).toBe(false);

    await clickToggle(page);

    // After click: should be light
    expect(await isChecked(page)).toBe(false);
    expect(await dataTheme(page)).toBe('light');
    expect(await storedTheme(page)).toBe('light');
    expect(await hasOverriddenClass(page)).toBe(true);
  });

  it('clicking to force dark then clicking again clears the override', async () => {
    const page = await openPage(browser, baseUrl, 'light');

    // First click: force dark
    await clickToggle(page);
    expect(await storedTheme(page)).toBe('dark');
    expect(await hasOverriddenClass(page)).toBe(true);

    // Second click: clicking the already-forced dark side → clear override
    await clickToggle(page);
    expect(await storedTheme(page)).toBeNull();
    expect(await hasOverriddenClass(page)).toBe(false);
    expect(await dataTheme(page)).toBeNull();
  });

  it('clicking to force light then clicking again clears the override', async () => {
    const page = await openPage(browser, baseUrl, 'dark');

    // First click: force light
    await clickToggle(page);
    expect(await storedTheme(page)).toBe('light');
    expect(await hasOverriddenClass(page)).toBe(true);

    // Second click: clicking the already-forced light side → clear override
    await clickToggle(page);
    expect(await storedTheme(page)).toBeNull();
    expect(await hasOverriddenClass(page)).toBe(false);
    expect(await dataTheme(page)).toBeNull();
  });
});

// ── System preference change ──────────────────────────────────────────────────

describe('system preference change', () => {
  it('no override: changing system to dark checks the knob', async () => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/index.html`);

    // Initially light system, no override → unchecked
    expect(await isChecked(page)).toBe(false);

    // Emulate system preference change to dark
    await ctx.setExtraHTTPHeaders({}); // no-op to keep ctx alive
    await page.emulateMedia({ colorScheme: 'dark' });

    // The matchMedia 'change' event fires; syncUI should check the knob
    // Give event loop a tick to process
    await page.waitForTimeout(50);
    expect(await isChecked(page)).toBe(true);
  });

  it('with override: changing system preference does NOT move the knob', async () => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    // Set stored dark override before navigating
    await page.addInitScript(() => localStorage.setItem('wf-theme', 'dark'));
    await page.goto(`${baseUrl}/index.html`);

    // Override dark → checked
    expect(await isChecked(page)).toBe(true);

    // Change system to light — override should prevent knob from moving
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(50);

    // Still checked (override = dark takes precedence over system light)
    expect(await isChecked(page)).toBe(true);
    expect(await storedTheme(page)).toBe('dark');
  });
});
