/**
 * Detail-panel timing-row swatch tests.
 *
 * Each connection-phase row in the detail panel ("Blocked", "DNS Lookup",
 * "TCP Connect", "TLS Handshake", "Send", "Wait", "Receive") must use a
 * distinct CSS class so its swatch renders with a distinguishable colour
 * — otherwise users cannot tell at a glance which phase dominated a
 * request. Until this was fixed, both "Wait" and "Receive" used `wb--wait`
 * and rendered identically.
 *
 * Uses the `/interactive` fixture (empty <waterfall-chart> + JS bundle) so
 * the panel is rendered by the dynamic-render path, which is where the
 * timing swatches live. Targets an entry in demo.har that has all seven
 * timing phases > 0 so every swatch is present. demo.har has no
 * `_blocked_queueing` data, so this test exercises the "single Blocked row"
 * path — see blocked-breakdown.test.ts for the queueing/stalled split.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import { createFixtureServer, type FixtureServer } from './fixture-server.js';
import type { Har } from '../dist/har.js';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const DEMO_HAR: Har = JSON.parse(
  fs.readFileSync(path.resolve(PKG_ROOT, 'public', 'demo.har'), 'utf8'),
);

/** Index of the first entry in demo.har that has all seven phases > 0. */
const ROW_WITH_ALL_PHASES = DEMO_HAR.log.entries.findIndex((e) => {
  const t = e.timings;
  return (
    (t.blocked ?? 0) > 0 &&
    t.dns > 0 &&
    t.connect > 0 &&
    (t.ssl ?? 0) > 0 &&
    t.send > 0 &&
    t.wait > 0 &&
    t.receive > 0
  );
});

if (ROW_WITH_ALL_PHASES < 0) {
  throw new Error(
    'demo.har must contain at least one entry with all phases > 0 for this test',
  );
}

/** All seven phase-row swatch classes the detail panel should emit. */
const EXPECTED_SWATCH_CLASSES = [
  'wb--blocked',
  'wb--dns',
  'wb--connect',
  'wb--ssl',
  'wb--send',
  'wb--wait',
  'wb--receive',
] as const;

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

async function openInteractive(): Promise<Page> {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(`${server.url}/interactive`);
  await page.waitForFunction(() => !!customElements.get('waterfall-chart'));
  await page.evaluate((har) => {
    (document.querySelector('waterfall-chart') as unknown as { har: Har }).har =
      har;
  }, DEMO_HAR);
  await page.waitForSelector('waterfall-chart .wf-scrubber');
  return page;
}

describe('detail-panel timing swatches', () => {
  let page: Page;

  beforeAll(async () => {
    page = await openInteractive();
    // Open the detail panel for the entry that has all seven phases > 0,
    // so every swatch we want to compare is actually rendered.
    await page
      .locator(`li.wf-row[data-index="${ROW_WITH_ALL_PHASES}"]`)
      .click();
    await page.waitForSelector('.wf-panel');
  });

  it('renders exactly one swatch per expected phase class', async () => {
    for (const cls of EXPECTED_SWATCH_CLASSES) {
      const count = await page
        .locator(`.wf-panel .wf-timing-swatch.${cls}`)
        .count();
      expect(count, `expected exactly one .${cls} swatch`).toBe(1);
    }
  });

  it('every phase swatch has a distinct computed background colour', async () => {
    const colors = await page.evaluate(
      (classes) => {
        const out: Record<string, string> = {};
        for (const cls of classes) {
          const el = document.querySelector(
            `.wf-panel .wf-timing-swatch.${cls}`,
          ) as HTMLElement | null;
          out[cls] = el ? getComputedStyle(el).backgroundColor : '';
        }
        return out;
      },
      EXPECTED_SWATCH_CLASSES as unknown as string[],
    );

    // Every swatch must have a non-empty computed colour.
    for (const cls of EXPECTED_SWATCH_CLASSES) {
      expect(
        colors[cls],
        `expected .${cls} to have a background colour`,
      ).toBeTruthy();
    }

    // And all seven colours must be pairwise distinct. Surface any
    // collision as a readable error.
    const colorToClass = new Map<string, string>();
    for (const cls of EXPECTED_SWATCH_CLASSES) {
      const c = colors[cls]!;
      const prev = colorToClass.get(c);
      expect(
        prev,
        `phase swatches .${cls} and .${prev} both render as ${c}`,
      ).toBeUndefined();
      colorToClass.set(c, cls);
    }
  });
});
