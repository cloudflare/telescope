/**
 * Theme tests — verify that background colors respond correctly to both the
 * system color-scheme preference and the data-theme override attribute.
 */

import { type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  createServer,
  launchBrowser,
  openPage,
  bgColor,
  WHITE,
  DARK_PANEL,
  BRAND_SUBTLE,
} from './helpers.js';

/**
 * `.wf-filter-btn` has `transition: background 0.12s, color 0.12s, ...`.
 * When the custom element upgrades (`:not(:defined)` no longer matches),
 * the chip background transitions from `transparent` (the un-upgraded
 * "label" style) to `var(--wf-panel)`. Tests that query computed styles
 * immediately after `waitForSelector('.wf-scrubber')` can catch the value
 * mid-transition, producing flaky alpha values like `rgba(255,255,255,0.15)`.
 *
 * Inject a stylesheet that disables transitions so computed colours always
 * reflect the final stylesheet-driven value.
 */
async function disableTransitions(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; }',
  });
}

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

// ── Light-mode backgrounds ────────────────────────────────────────────────────

describe('light mode backgrounds', () => {
  it('column headers background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('inactive filter button background is white', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      htmlPage: 'interactive.html',
    });
    await page.waitForSelector('.wf-scrubber');
    await disableTransitions(page);
    expect(await bgColor(page, '.wf-filter-btn:not(.active)')).toBe(WHITE);
  });

  it('active filter button background is brand-subtle in light mode', async () => {
    // In light mode the active chip uses --wf-brand-subtle (#dbeafe) as a
    // soft tint rather than the strong --wf-brand colour; in dark mode the
    // override flips it to var(--wf-brand). See the .wf-filter-btn.active
    // rule and its @media (prefers-color-scheme: dark) override.
    const page = await openPage(browser, baseUrl, 'light', {
      htmlPage: 'interactive.html',
    });
    await page.waitForSelector('.wf-scrubber');
    await disableTransitions(page);
    expect(await bgColor(page, '.wf-filter-btn.active')).toBe(BRAND_SUBTLE);
  });

  it('toggle button background is transparent', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      htmlPage: 'interactive.html',
    });
    await page.waitForSelector('.wf-scrubber');
    await disableTransitions(page);
    expect(await bgColor(page, '.wf-toggle-cols')).toBe('rgba(0, 0, 0, 0)');
  });
});

// ── Theme override via data-theme attribute ───────────────────────────────────

describe('theme override via data-theme attribute', () => {
  it('system light, no override → white panel', async () => {
    const page = await openPage(browser, baseUrl, 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('system dark, no override → dark panel', async () => {
    const page = await openPage(browser, baseUrl, 'dark');
    expect(await bgColor(page, '.wf-col-headers')).toBe(DARK_PANEL);
  });

  it('system dark + data-theme=light → white panel', async () => {
    const page = await openPage(browser, baseUrl, 'dark', {
      dataTheme: 'light',
    });
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('system light + data-theme=dark → dark panel', async () => {
    const page = await openPage(browser, baseUrl, 'light', {
      dataTheme: 'dark',
    });
    expect(await bgColor(page, '.wf-col-headers')).toBe(DARK_PANEL);
  });
});
