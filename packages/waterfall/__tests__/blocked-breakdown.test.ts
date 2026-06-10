/**
 * Blocked-phase breakdown tests.
 *
 * HAR 1.2's `timings.blocked` represents the TOTAL time a request was held
 * before any network work began. Chrome DevTools also writes a vendor-specific
 * `_blocked_queueing` field representing the *queueing* subset of `blocked`
 * (i.e. _blocked_queueing ≤ blocked, NOT additive).
 *
 * When `_blocked_queueing` is present, the chart breaks the blocked region
 * into two sub-segments in the timeline bar AND two rows in the detail panel:
 *
 *   - "Queueing" (Chrome subset; rendered first / leftmost in the bar; current
 *     darker grey from --wf-blocked)
 *   - "Stalled"  (= blocked − queueing; lighter grey from --wf-stalled)
 *
 * When `_blocked_queueing` is absent, the chart emits a single `wb--blocked`
 * segment (legacy behaviour, unchanged for HARs without the extension).
 *
 * This test injects a synthetic HAR via `.har` so the assertions don't depend
 * on whether the bundled demo.har happens to contain queueing data.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createFixtureServer, type FixtureServer } from './fixture-server.js';
import type { Har, HarEntry } from '../dist/har.js';

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

function makeEntry(overrides: Partial<HarEntry>): HarEntry {
  return {
    startedDateTime: '2025-01-01T00:00:00.000Z',
    time: 200,
    request: {
      method: 'GET',
      url: 'https://example.com/resource',
      httpVersion: 'h2',
      headers: [],
      cookies: [],
      queryString: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'h2',
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: 'text/html' },
      redirectURL: '',
      headersSize: -1,
      bodySize: 0,
    },
    timings: {
      blocked: 0,
      dns: 0,
      connect: 0,
      ssl: 0,
      send: 0,
      wait: 0,
      receive: 0,
    },
    ...overrides,
  };
}

function makeHar(entries: HarEntry[]): Har {
  return {
    log: {
      version: '1.2',
      creator: { name: 'test', version: '0' },
      entries,
    },
  };
}

async function openWithHar(har: Har): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/interactive`);
  await page.waitForFunction(() => !!customElements.get('waterfall-chart'));
  await page.evaluate((h) => {
    (document.querySelector('waterfall-chart') as unknown as { har: Har }).har =
      h;
  }, har);
  await page.waitForSelector('waterfall-chart .wf-scrubber');
  return page;
}

describe('blocked phase: with _blocked_queueing (Chrome breakdown)', () => {
  let page: Page;

  beforeAll(async () => {
    // Entry with blocked=100 ms total, of which 75 ms is queueing → stalled=25 ms.
    const har = makeHar([
      makeEntry({
        time: 200,
        timings: {
          blocked: 100,
          _blocked_queueing: 75,
          dns: 0,
          connect: 0,
          ssl: 0,
          send: 0,
          wait: 50,
          receive: 50,
        },
      }),
    ]);
    page = await openWithHar(har);
  });

  it('emits two timeline bar segments: queueing first (leftmost), then stalled', async () => {
    const segs = await page.evaluate(() => {
      const row = document.querySelector('li.wf-row[data-index="0"]')!;
      const bars = Array.from(
        row.querySelectorAll<HTMLElement>('.wf-bar-wrap .wb'),
      );
      return bars.map((b) => ({
        cls: b.className,
        left: parseFloat(b.style.left),
        title: b.getAttribute('title'),
      }));
    });
    // Filter to phase bars only (wb--phase modifier).
    const phaseBars = segs.filter((s) => s.cls.includes('wb--phase'));
    expect(phaseBars.length).toBe(2);
    expect(phaseBars[0]!.cls).toContain('wb--queueing');
    expect(phaseBars[0]!.title).toBe('Queueing: 75 ms');
    expect(phaseBars[1]!.cls).toContain('wb--stalled');
    expect(phaseBars[1]!.title).toBe('Stalled: 25 ms');
    // Stalled must start to the right of queueing.
    expect(phaseBars[1]!.left).toBeGreaterThan(phaseBars[0]!.left);
  });

  it('queueing and stalled bars have different computed background colours', async () => {
    const colors = await page.evaluate(() => {
      const row = document.querySelector('li.wf-row[data-index="0"]')!;
      const q = row.querySelector('.wb--queueing') as HTMLElement | null;
      const s = row.querySelector('.wb--stalled') as HTMLElement | null;
      return {
        queueing: q ? getComputedStyle(q).backgroundColor : null,
        stalled: s ? getComputedStyle(s).backgroundColor : null,
      };
    });
    expect(colors.queueing).toBeTruthy();
    expect(colors.stalled).toBeTruthy();
    expect(colors.queueing).not.toBe(colors.stalled);
  });

  it('detail panel groups Queueing + Stalled under a "Blocked" parent row', async () => {
    await page.locator('li.wf-row[data-index="0"]').click();
    await page.waitForSelector('.wf-panel');

    // Collect the labels and values from each timing row in document order.
    const rows = await page.evaluate(() => {
      const out: Array<{
        label: string;
        value: string;
        swatchCls: string;
        isSub: boolean;
      }> = [];
      document
        .querySelectorAll<HTMLElement>('.wf-panel .wf-timing-row')
        .forEach((row) => {
          const label = row
            .querySelector('.wf-timing-label')!
            .textContent!.trim();
          const value = row
            .querySelector('.wf-timing-val')!
            .textContent!.trim();
          const swatch = row.querySelector(
            '.wf-timing-label .wf-timing-swatch',
          );
          out.push({
            label,
            value,
            swatchCls: swatch?.className ?? '',
            isSub: row.classList.contains('wf-timing-sub'),
          });
        });
      return out;
    });

    const blockedIdx = rows.findIndex((r) => r.label === 'Blocked');
    const queueingIdx = rows.findIndex((r) => r.label === 'Queueing');
    const stalledIdx = rows.findIndex((r) => r.label === 'Stalled');

    // All three rows present, in this order: Blocked → Queueing → Stalled.
    expect(blockedIdx).toBeGreaterThanOrEqual(0);
    expect(queueingIdx).toBeGreaterThanOrEqual(0);
    expect(stalledIdx).toBeGreaterThanOrEqual(0);
    expect(blockedIdx).toBeLessThan(queueingIdx);
    expect(queueingIdx).toBeLessThan(stalledIdx);

    // Parent "Blocked" row shows the TOTAL (100 ms) and is not a sub-row.
    expect(rows[blockedIdx]!.value).toBe('100 ms');
    expect(rows[blockedIdx]!.swatchCls).toContain('wb--blocked');
    expect(rows[blockedIdx]!.isSub).toBe(false);

    // Queueing and Stalled are sub-rows with their respective values.
    expect(rows[queueingIdx]!.value).toBe('75 ms');
    expect(rows[queueingIdx]!.swatchCls).toContain('wb--queueing');
    expect(rows[queueingIdx]!.isSub).toBe(true);
    expect(rows[stalledIdx]!.value).toBe('25 ms');
    expect(rows[stalledIdx]!.swatchCls).toContain('wb--stalled');
    expect(rows[stalledIdx]!.isSub).toBe(true);

    // The legacy "Blocked/Queued" label must not appear.
    expect(rows.find((r) => r.label === 'Blocked/Queued')).toBeUndefined();
  });
});

describe('blocked phase: without _blocked_queueing (legacy / non-Chrome HAR)', () => {
  let page: Page;

  beforeAll(async () => {
    const har = makeHar([
      makeEntry({
        time: 200,
        timings: {
          blocked: 100, // no queueing breakdown
          dns: 0,
          connect: 0,
          ssl: 0,
          send: 0,
          wait: 50,
          receive: 50,
        },
      }),
    ]);
    page = await openWithHar(har);
  });

  it('emits a single wb--blocked bar segment (no queueing/stalled split)', async () => {
    const segs = await page.evaluate(() => {
      const row = document.querySelector('li.wf-row[data-index="0"]')!;
      const bars = Array.from(
        row.querySelectorAll<HTMLElement>('.wf-bar-wrap .wb'),
      );
      return bars.map((b) => b.className);
    });
    const phaseBars = segs.filter((c) => c.includes('wb--phase'));
    expect(phaseBars).toHaveLength(1);
    expect(phaseBars[0]).toContain('wb--blocked');
    // No queueing/stalled sub-bars should exist.
    expect(segs.find((c) => c.includes('wb--queueing'))).toBeUndefined();
    expect(segs.find((c) => c.includes('wb--stalled'))).toBeUndefined();
  });

  it('detail panel emits a single "Blocked" row (no Queueing/Stalled split)', async () => {
    await page.locator('li.wf-row[data-index="0"]').click();
    await page.waitForSelector('.wf-panel');

    const labels = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll<HTMLElement>(
          '.wf-panel .wf-timing-row .wf-timing-label',
        ),
      ).map((el) => el.textContent!.trim());
    });

    expect(labels).toContain('Blocked');
    expect(labels).not.toContain('Queueing');
    expect(labels).not.toContain('Stalled');
    expect(labels).not.toContain('Blocked/Queued');
  });
});
