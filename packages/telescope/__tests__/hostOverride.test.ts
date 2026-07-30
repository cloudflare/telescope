import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { BrowserConfig } from '../src/browsers.js';
import { DEFAULT_OPTIONS } from '../src/defaultOptions.js';
import { TestRunner } from '../src/testRunner.js';

import type { Page } from 'playwright';
import type { LaunchOptions } from '../src/types.js';

/**
 * Minimal Page stub — `setupHostOverrides` and `preparePage` only ever reach
 * for `page.route()` and `page.on()`.
 */
function createMockPage() {
  return {
    route: vi.fn(async () => {}),
    on: vi.fn(),
  };
}

type MockPage = ReturnType<typeof createMockPage>;

function asPage(page: MockPage): Page {
  return page as unknown as Page;
}

/**
 * `setupHostOverrides` registers a URL matcher function, while the unrelated
 * `x-telescope-id` catch-all in `preparePage` uses the string glob `**\/*`.
 * Selecting only the function matchers isolates host-override registrations.
 */
function hostOverrideMatchers(page: MockPage): ((url: URL) => boolean)[] {
  return page.route.mock.calls
    .map(call => (call as unknown[])[0])
    .filter(
      (matcher): matcher is (url: URL) => boolean =>
        typeof matcher === 'function',
    );
}

describe('setupHostOverrides', () => {
  const runners: TestRunner[] = [];
  let page: MockPage;

  function buildRunner(options: Partial<LaunchOptions> = {}): TestRunner {
    const launchOptions = {
      url: 'http://127.0.0.1:8080/index.html',
      browser: 'chrome',
      ...options,
    } as LaunchOptions;
    const runner = new TestRunner(
      launchOptions,
      new BrowserConfig().getBrowserConfig('chrome', launchOptions),
    );
    runners.push(runner);
    return runner;
  }

  beforeEach(() => {
    page = createMockPage();
  });

  afterEach(() => {
    while (runners.length) {
      const runner = runners.pop();
      if (runner) {
        rmSync(runner.paths.results, { recursive: true, force: true });
      }
    }
  });

  describe('does not call page.route()', () => {
    test('when no overrides are configured', async () => {
      await buildRunner().setupHostOverrides(asPage(page), {});

      expect(page.route).not.toHaveBeenCalled();
    });

    test('when given the default overrideHost value', async () => {
      await buildRunner().setupHostOverrides(
        asPage(page),
        DEFAULT_OPTIONS.overrideHost,
      );

      expect(page.route).not.toHaveBeenCalled();
    });

    test('when every override target is an empty string', async () => {
      await buildRunner().setupHostOverrides(asPage(page), {
        'example.com': '',
        'cdn.example.com': '',
      });

      expect(page.route).not.toHaveBeenCalled();
    });
  });

  describe('calls page.route()', () => {
    test('once when a single override is configured', async () => {
      await buildRunner().setupHostOverrides(asPage(page), {
        'example.com': '127.0.0.1:8080',
      });

      expect(page.route).toHaveBeenCalledTimes(1);
    });

    test('with a matcher that only matches overridden hosts', async () => {
      await buildRunner().setupHostOverrides(asPage(page), {
        'example.com': '127.0.0.1:8080',
      });

      const [matchHost] = hostOverrideMatchers(page);
      expect(matchHost).toBeTypeOf('function');

      expect(matchHost(new URL('http://example.com/style.css'))).toBe(true);
      expect(matchHost(new URL('https://example.com/'))).toBe(true);
      expect(matchHost(new URL('http://other.com/style.css'))).toBe(false);
      // Sub-domains are not a match — the host must be equal
      expect(matchHost(new URL('http://cdn.example.com/'))).toBe(false);
      // The port is part of the host, so a port mismatch is not a match
      expect(matchHost(new URL('http://example.com:8080/'))).toBe(false);
      // A host appearing only in the path must not match
      expect(matchHost(new URL('http://other.com/example.com/a.css'))).toBe(
        false,
      );
    });

    test('with a matcher ignoring overrides that have empty targets', async () => {
      await buildRunner().setupHostOverrides(asPage(page), {
        'skipped.example.com': '',
        'kept.example.com': '127.0.0.1:8080',
      });

      expect(page.route).toHaveBeenCalledTimes(1);

      const [matchHost] = hostOverrideMatchers(page);

      expect(matchHost(new URL('http://kept.example.com/'))).toBe(true);
      expect(matchHost(new URL('http://skipped.example.com/'))).toBe(false);
    });
  });

  describe('via preparePage', () => {
    test('registers no host-override route when overrideHost is unset', async () => {
      await buildRunner().preparePage(asPage(page));

      expect(hostOverrideMatchers(page)).toHaveLength(0);
    });

    test('registers no host-override route when overrideHost is empty', async () => {
      await buildRunner({ overrideHost: {} }).preparePage(asPage(page));

      expect(hostOverrideMatchers(page)).toHaveLength(0);
    });

    test('registers a host-override route when overrideHost is set', async () => {
      await buildRunner({
        overrideHost: { 'example.com': '127.0.0.1:8080' },
      }).preparePage(asPage(page));

      expect(hostOverrideMatchers(page)).toHaveLength(1);
    });
  });
});
