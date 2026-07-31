import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { BrowserConfig } from '../src/browsers.js';
import { DEFAULT_OPTIONS } from '../src/defaultOptions.js';
import { TestRunner } from '../src/testRunner.js';
import {
  fixturesDir,
  withHAR,
  createStaticServer,
  listenServer,
  shutdownServer,
} from './testServer.ts';
import { retrieveConfig } from './helpers.js';

import type { Page } from 'playwright';
import type { HarEntry, LaunchOptions, SavedConfig } from '../src/types.js';

const TELESCOPE_ID_HEADER = 'x-telescope-id';

/**
 * Minimal Page stub — the priority correlation setup only reaches for
 * `page.route()` and `page.on()`.
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

// ---------------------------------------------------------------------------
// Route registration is gated on the flag
// ---------------------------------------------------------------------------

describe('setupPriorityCorrelation', () => {
  const runners: TestRunner[] = [];

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

  afterEach(() => {
    while (runners.length) {
      const runner = runners.pop();
      if (runner) {
        rmSync(runner.paths.results, { recursive: true, force: true });
      }
    }
  });

  test('does not touch the page when priority is not set', async () => {
    const page = createMockPage();

    await buildRunner().setupPriorityCorrelation(asPage(page));

    expect(page.route).not.toHaveBeenCalled();
    expect(page.on).not.toHaveBeenCalled();
  });

  test('does not touch the page when priority is false', async () => {
    const page = createMockPage();

    await buildRunner({ priority: false }).setupPriorityCorrelation(
      asPage(page),
    );

    expect(page.route).not.toHaveBeenCalled();
    expect(page.on).not.toHaveBeenCalled();
  });

  test('registers the catch-all route when priority is true', async () => {
    const page = createMockPage();

    await buildRunner({ priority: true }).setupPriorityCorrelation(
      asPage(page),
    );

    expect(page.route).toHaveBeenCalledTimes(1);
    expect(page.route.mock.calls[0][0]).toBe('**/*');
    expect(page.on).toHaveBeenCalledWith(
      'requestfinished',
      expect.any(Function),
    );
  });

  describe('via preparePage', () => {
    test('registers no catch-all route when priority is not set', async () => {
      const page = createMockPage();

      await buildRunner().preparePage(asPage(page));

      const globs = page.route.mock.calls.map(call => call[0]);
      expect(globs).not.toContain('**/*');
    });

    test('registers the catch-all route when priority is true', async () => {
      const page = createMockPage();

      await buildRunner({ priority: true }).preparePage(asPage(page));

      const globs = page.route.mock.calls.map(call => call[0]);
      expect(globs).toContain('**/*');
    });
  });
});

// ---------------------------------------------------------------------------
// Defaults and CLI wiring
// ---------------------------------------------------------------------------

describe('--priority CLI flag', () => {
  test('defaults to false', () => {
    expect(DEFAULT_OPTIONS.priority).toBe(false);
  });

  function runDry(extraArgs: string[]): SavedConfig | null {
    const args = [
      'dist/src/cli.js',
      '--dry',
      '--url',
      'https://www.example.com',
      ...extraArgs,
    ];
    const output = spawnSync('node', args);
    const match = output.stdout.toString().match(/Test ID:(.*)/);
    if (!match || match.length < 2) {
      return null;
    }
    return retrieveConfig(match[1].trim());
  }

  test('is recorded as false in the saved config when omitted', () => {
    const config = runDry([]);

    expect(config).toBeTruthy();
    expect(config?.options.priority).toBe(false);
  });

  test('is recorded as true in the saved config when passed', () => {
    const config = runDry(['--priority']);

    expect(config).toBeTruthy();
    expect(config?.options.priority).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: the header must not reach the server unless opted in
// ---------------------------------------------------------------------------

describe('x-telescope-id header injection', () => {
  let server: ReturnType<typeof createStaticServer>;
  let baseUrl: string;

  beforeAll(async () => {
    server = createStaticServer({
      fixturesDirPath: fixturesDir('priority'),
    });
    baseUrl = await listenServer(server);
  });

  afterAll(async () => {
    await shutdownServer(server);
  });

  function telescopeIdHeaders(entries: HarEntry[]): string[] {
    return entries.flatMap(entry =>
      entry.request.headers
        .filter(header => header.name.toLowerCase() === TELESCOPE_ID_HEADER)
        .map(header => header.value),
    );
  }

  test(
    'is absent from the HAR by default',
    async () => {
      await withHAR(
        { url: `${baseUrl}/index.html`, browser: 'chromium' },
        har => {
          expect(har.log.entries.length).toBeGreaterThan(0);
          expect(telescopeIdHeaders(har.log.entries)).toHaveLength(0);
        },
      );
    },
    60000,
  );

  test(
    'no priority fields are recorded by default',
    async () => {
      await withHAR(
        { url: `${baseUrl}/index.html`, browser: 'chromium' },
        har => {
          const withPriority = har.log.entries.filter(
            entry =>
              entry._priority !== undefined ||
              entry._initialPriority !== undefined,
          );
          expect(withPriority).toHaveLength(0);
        },
      );
    },
    60000,
  );

  test(
    'is present on every request when --priority is enabled',
    async () => {
      await withHAR(
        { url: `${baseUrl}/index.html`, browser: 'chromium', priority: true },
        har => {
          expect(har.log.entries.length).toBeGreaterThan(0);
          expect(telescopeIdHeaders(har.log.entries).length).toBe(
            har.log.entries.length,
          );
        },
      );
    },
    60000,
  );
});
