/**
 * Row keyboard-accessibility tests.
 *
 * After JS upgrade, each `<li class="wf-row">` should be:
 *   - keyboard-focusable (tabindex="0")
 *   - announced as a toggle button (role="button", aria-expanded)
 *   - activatable via Enter and Space, mirroring the click behaviour that
 *     opens/closes the detail panel
 *
 * Static HTML (no JS) deliberately keeps rows non-focusable since there is
 * no handler attached.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

import { createFixtureServer, type FixtureServer } from './fixture-server.js';

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

async function openProgressive(): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/progressive`);
  // Wait until the JS upgrade has injected the scrubber (signals render complete)
  await page.waitForSelector('.wf-scrubber');
  return page;
}

describe('row keyboard accessibility', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openProgressive();
  });

  it('every row is focusable and announced as a button after JS upgrade', async () => {
    const attrs = await page.evaluate(() => {
      const rows = Array.from(
        document.querySelectorAll<HTMLElement>('li.wf-row'),
      );
      return rows.map((li) => ({
        tabindex: li.getAttribute('tabindex'),
        role: li.getAttribute('role'),
        ariaExpanded: li.getAttribute('aria-expanded'),
      }));
    });
    expect(attrs.length).toBeGreaterThan(0);
    for (const a of attrs) {
      expect(a.tabindex).toBe('0');
      expect(a.role).toBe('button');
      // Initially every row is closed.
      expect(a.ariaExpanded).toBe('false');
    }
  });

  it('pressing Enter on a focused row opens its detail panel and flips aria-expanded', async () => {
    const firstRow = page.locator('li.wf-row').first();
    await firstRow.focus();
    await page.keyboard.press('Enter');

    // Panel attached
    await page.waitForSelector('.wf-panel');
    expect(await page.locator('.wf-panel').count()).toBe(1);

    // aria-expanded flipped to true on the activated row
    expect(await firstRow.getAttribute('aria-expanded')).toBe('true');
    expect(
      await firstRow.evaluate((el) => el.classList.contains('row--open')),
    ).toBe(true);

    // Pressing Enter again closes it
    await page.keyboard.press('Enter');
    expect(await page.locator('.wf-panel').count()).toBe(0);
    expect(await firstRow.getAttribute('aria-expanded')).toBe('false');
  });

  it('pressing Space on a focused row toggles the panel without scrolling the page', async () => {
    const row = page.locator('li.wf-row').nth(1);
    await row.focus();

    const scrollYBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press(' ');
    const scrollYAfter = await page.evaluate(() => window.scrollY);

    // Space must NOT have scrolled the page (preventDefault).
    expect(scrollYAfter).toBe(scrollYBefore);

    // And it should have opened the panel for this row.
    await page.waitForSelector('.wf-panel');
    expect(await page.locator('.wf-panel').count()).toBe(1);
    expect(await row.getAttribute('aria-expanded')).toBe('true');

    // Tidy up.
    await page.keyboard.press(' ');
    expect(await page.locator('.wf-panel').count()).toBe(0);
  });
});
