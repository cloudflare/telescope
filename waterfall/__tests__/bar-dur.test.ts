/**
 * Bar duration label alignment tests.
 *
 * Verifies that the gap between the right edge of the last bar segment and the
 * left edge of the duration label is consistent across all request rows.
 *
 * Uses index.html (JS-upgraded) so that bar positions are computed accurately
 * from the live layout rather than SSR percentage estimates.
 */

import { type Browser, type Page } from 'playwright';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer, launchBrowser } from './helpers.js';

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

async function openIndex(): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/index.html`);
  // Wait until the JS upgrade has injected the scrubber (signals render complete)
  await page.waitForSelector('.wf-scrubber');
  return page;
}

describe('duration label gap (index.html)', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openIndex();
  });

  it('every row has a duration label', async () => {
    const counts = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('li.wf-row'));
      return rows.map((row) => row.querySelectorAll('.wf-bar-dur').length);
    });
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((n) => n === 1)).toBe(true);
  });

  it('every row has at least one bar segment', async () => {
    const counts = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('li.wf-row'));
      return rows.map((row) => row.querySelectorAll('.wb').length);
    });
    expect(counts.every((n) => n >= 1)).toBe(true);
  });

  it('gap between last bar right edge and duration label left edge is consistent across all rows', async () => {
    const gaps: number[] = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('li.wf-row'));
      return rows.map((row) => {
        const bars = Array.from(row.querySelectorAll<HTMLElement>('.wb'));
        const label = row.querySelector<HTMLElement>('.wf-bar-dur');
        if (!bars.length || !label) return NaN;

        // Find the rightmost bar — the one whose right edge is furthest right.
        let maxRight = -Infinity;
        for (const bar of bars) {
          const r = bar.getBoundingClientRect().right;
          if (r > maxRight) maxRight = r;
        }

        return label.getBoundingClientRect().left - maxRight;
      });
    });

    const valid = gaps.filter((g) => !isNaN(g));
    expect(valid.length).toBeGreaterThan(0);

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    // All gaps should be within 1px of each other (sub-pixel rounding tolerance).
    expect(max - min).toBeLessThanOrEqual(1);
  });
});
