import playwright from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Browser, Page } from 'playwright';

import { collectAvailableJSAPIs } from '../src/baselineJsApiAvailability.js';
import { JS_API_REGISTRY } from '../src/baselineJsApiRegistry.js';
import { BrowserConfig } from '../src/browsers.js';
import type { JSAPIKind, JSAPIRegistryEntry } from '../src/types.js';

function api(
  bcdKey: string,
  kind: JSAPIKind,
  path: string,
): JSAPIRegistryEntry {
  return { bcdKey, kind, path };
}

describe('JS_API_REGISTRY', () => {
  it('contains representative API shapes from the curated prototype', () => {
    expect(JS_API_REGISTRY).toEqual(
      expect.arrayContaining([
        api('api.IntersectionObserver', 'constructor', 'IntersectionObserver'),
        api('api.fetch', 'global_function', 'fetch'),
        api('api.Navigator.sendBeacon', 'method', 'navigator.sendBeacon'),
        api(
          'api.Document.adoptedStyleSheets',
          'property',
          'Document.prototype.adoptedStyleSheets',
        ),
        api('api.Navigator.clipboard', 'property', 'navigator.clipboard'),
        api(
          'api.Document.startViewTransition',
          'method',
          'document.startViewTransition',
        ),
        api('api.AbortSignal.any_static', 'static_method', 'AbortSignal.any'),
        api('api.structuredClone', 'global_function', 'structuredClone'),
      ]),
    );
  });

  it('has one non-empty BCD key and global path per entry', () => {
    const bcdKeys = JS_API_REGISTRY.map(entry => entry.bcdKey);
    const paths = JS_API_REGISTRY.map(entry => entry.path);

    expect(JS_API_REGISTRY.length).toBeGreaterThan(0);
    expect(bcdKeys.every(Boolean)).toBe(true);
    expect(paths.every(Boolean)).toBe(true);
    expect(new Set(bcdKeys).size).toBe(bcdKeys.length);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

const browsers = BrowserConfig.getBrowsers();

describe.each(browsers)('collectAvailableJSAPIs — %s', browserName => {
  const config = BrowserConfig.browserConfigs[browserName];
  let browser: Browser;

  beforeAll(async () => {
    browser = await playwright[config.engine].launch({
      headless: config.headless,
      ...('channel' in config && config.channel
        ? { channel: config.channel }
        : {}),
    });
  }, 120000);

  afterAll(async () => {
    await browser.close();
  });

  async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const page = await browser.newPage();
    try {
      await page.setContent('<main>availability test</main>');
      return await fn(page);
    } finally {
      await page.close();
    }
  }

  it('reports available APIs by BCD key and skips unavailable APIs', async () => {
    const registry: readonly JSAPIRegistryEntry[] = [
      api('test.property', 'property', 'document.body'),
      api('test.constructor', 'constructor', 'URL'),
      api('test.global_function', 'global_function', 'structuredClone'),
      api('test.method', 'method', 'Array.prototype.flat'),
      api('test.static_method', 'static_method', 'Promise.allSettled'),
      api('test.missing', 'property', '__telescopeMissingApi.value'),
      api('test.not_callable', 'method', 'document.body'),
    ];

    const available = await withPage(page =>
      collectAvailableJSAPIs(page, registry),
    );

    expect(available).toEqual([
      'test.constructor',
      'test.global_function',
      'test.method',
      'test.property',
      'test.static_method',
    ]);
  });

  it('isolates throwing lookups and does not invoke the final property getter', async () => {
    const registry: readonly JSAPIRegistryEntry[] = [
      api(
        'test.throwing_parent',
        'property',
        '__availabilityFixture.throwingParent.value',
      ),
      api(
        'test.throwing_property',
        'property',
        '__availabilityFixture.throwingProperty',
      ),
      api(
        'test.still_available',
        'property',
        '__availabilityFixture.stillAvailable',
      ),
    ];

    const available = await withPage(async page => {
      await page.evaluate(() => {
        const fixture = { stillAvailable: true };
        Object.defineProperties(fixture, {
          throwingParent: {
            get() {
              throw new Error('parent getter must be isolated');
            },
          },
          throwingProperty: {
            get() {
              throw new Error('final getter must not run');
            },
          },
        });
        Object.defineProperty(globalThis, '__availabilityFixture', {
          configurable: true,
          value: fixture,
        });
      });

      return collectAvailableJSAPIs(page, registry);
    });

    expect(available).toEqual([
      'test.still_available',
      'test.throwing_property',
    ]);
  });

  it('deduplicates and sorts results without replacing browser APIs', async () => {
    const registry: readonly JSAPIRegistryEntry[] = [
      api('test.url', 'constructor', 'URL'),
      api('test.array', 'method', 'Array.prototype.flat'),
      api('test.url', 'constructor', 'URL'),
    ];

    const result = await withPage(async page => {
      await page.evaluate(() => {
        Object.defineProperties(globalThis, {
          __originalArrayFlat: { value: Array.prototype.flat },
          __originalURL: { value: URL },
        });
      });
      const available = await collectAvailableJSAPIs(page, registry);
      const identitiesUnchanged = await page.evaluate(() => {
        const fixture = globalThis as typeof globalThis & {
          __originalArrayFlat: typeof Array.prototype.flat;
          __originalURL: typeof URL;
        };
        return (
          Array.prototype.flat === fixture.__originalArrayFlat &&
          URL === fixture.__originalURL
        );
      });
      return { available, identitiesUnchanged };
    });

    expect(result).toEqual({
      available: ['test.array', 'test.url'],
      identitiesUnchanged: true,
    });
  });

  it('detects representative entries from the production registry', async () => {
    const available = await withPage(page => collectAvailableJSAPIs(page));

    expect(available).toEqual(
      expect.arrayContaining([
        'api.URL',
        'api.fetch',
        'javascript.builtins.Array.flat',
      ]),
    );
  });
});
