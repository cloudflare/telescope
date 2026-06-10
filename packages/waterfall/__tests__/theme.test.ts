/**
 * Theme tests — verify chart-internal background colours respond correctly
 * to the system color-scheme preference and the `data-theme` override
 * attribute.
 *
 * Uses the shared fixture pages (see __tests__/fixture-server.ts), NOT the
 * demo pages. Two fixtures are exercised:
 *   - `/static`        — pre-rendered chart, no JS. Used for assertions
 *                         that don't require the JS upgrade (col headers,
 *                         data-theme override behaviour).
 *   - `/progressive`   — pre-rendered chart + JS bundle. Used for chip /
 *                         toggle-button assertions that depend on the
 *                         upgraded toolbar state.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

import { createFixtureServer, type FixtureServer } from './fixture-server.js';
import { bgColor, WHITE, DARK_PANEL, BRAND_SUBTLE } from './helpers.js';

/**
 * `.wf-filter-btn` has `transition: background 0.12s, color 0.12s, ...`.
 * When the custom element upgrades (`:not(:defined)` no longer matches),
 * the chip background transitions from `transparent` (the un-upgraded
 * "label" style) to `var(--wf-panel)`. Tests that query computed styles
 * immediately after upgrade can catch the value mid-transition, producing
 * flaky alpha values like `rgba(255,255,255,0.15)`.
 *
 * Inject a stylesheet that disables transitions so computed colours always
 * reflect the final stylesheet-driven value.
 */
async function disableTransitions(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; }',
  });
}

/** Open a fixture page with the given OS colour scheme. */
async function openFixture(
  browser: Browser,
  baseUrl: string,
  fixture: 'static' | 'progressive',
  scheme: 'light' | 'dark',
  opts: { dataTheme?: 'light' | 'dark' } = {},
): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/${fixture}`);
  if (opts.dataTheme) {
    await page.evaluate(
      (t) => document.documentElement.setAttribute('data-theme', t),
      opts.dataTheme,
    );
  }
  return page;
}

/** Open /progressive and wait until the custom element has upgraded. */
async function openProgressiveUpgraded(
  browser: Browser,
  baseUrl: string,
  scheme: 'light' | 'dark',
): Promise<Page> {
  const page = await openFixture(browser, baseUrl, 'progressive', scheme);
  // .wf-scrubber is JS-only — its presence signals the upgrade has run.
  await page.waitForSelector('.wf-scrubber');
  await disableTransitions(page);
  return page;
}

let browser: Browser;
let server: FixtureServer;

beforeAll(async () => {
  browser = await chromium.launch();
  server = await createFixtureServer();
});

afterAll(async () => {
  await browser.close();
  await server.close();
});

// ── Light-mode chart-internal backgrounds ────────────────────────────────────

describe('light mode backgrounds', () => {
  it('column headers background is white', async () => {
    const page = await openFixture(browser, server.url, 'static', 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('inactive filter button background is white', async () => {
    const page = await openProgressiveUpgraded(browser, server.url, 'light');
    expect(await bgColor(page, '.wf-filter-btn:not(.active)')).toBe(WHITE);
  });

  it('active filter button background is brand-subtle in light mode', async () => {
    // In light mode the active chip uses --wf-brand-subtle (#dbeafe) as a
    // soft tint rather than the strong --wf-brand colour; in dark mode the
    // override flips it to var(--wf-brand). See .wf-filter-btn.active and
    // its @media (prefers-color-scheme: dark) override.
    const page = await openProgressiveUpgraded(browser, server.url, 'light');
    expect(await bgColor(page, '.wf-filter-btn.active')).toBe(BRAND_SUBTLE);
  });

  it('toggle (cols) button background is transparent', async () => {
    const page = await openProgressiveUpgraded(browser, server.url, 'light');
    expect(await bgColor(page, '.wf-toggle-cols')).toBe('rgba(0, 0, 0, 0)');
  });
});

// ── Theme override via data-theme attribute ──────────────────────────────────
//
// waterfall.css has `[data-theme='dark']` rules on :root that override the
// `prefers-color-scheme` media query. The host fixture does not need to know
// about `data-theme` for the *chart* to switch theme — `waterfall.css`
// handles it directly. (The fixture body bg stays whatever the media query
// resolves it to — that's intentional, since these tests verify the chart,
// not the host.)

describe('theme override via data-theme attribute', () => {
  it('system light, no override → white panel', async () => {
    const page = await openFixture(browser, server.url, 'static', 'light');
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('system dark, no override → dark panel', async () => {
    const page = await openFixture(browser, server.url, 'static', 'dark');
    expect(await bgColor(page, '.wf-col-headers')).toBe(DARK_PANEL);
  });

  it('system dark + data-theme=light → white panel', async () => {
    const page = await openFixture(browser, server.url, 'static', 'dark', {
      dataTheme: 'light',
    });
    expect(await bgColor(page, '.wf-col-headers')).toBe(WHITE);
  });

  it('system light + data-theme=dark → dark panel', async () => {
    const page = await openFixture(browser, server.url, 'static', 'light', {
      dataTheme: 'dark',
    });
    expect(await bgColor(page, '.wf-col-headers')).toBe(DARK_PANEL);
  });
});
