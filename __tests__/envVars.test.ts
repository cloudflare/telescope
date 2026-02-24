/**
 * Tests for BROWSERS, HEADLESS, and CI environment variable handling in
 * src/browsers.ts.
 *
 * Because the module evaluates these variables at load time (top-level const),
 * each test must re-import the module after setting the desired env vars.
 * jest.resetModules() + dynamic import() achieves true module isolation.
 */

import { jest } from '@jest/globals';
import type { BrowserName } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Re-import BrowserConfig with a fresh module registry so that the top-level
 * env-var reads in browsers.ts are re-evaluated against the current process.env.
 */
async function freshBrowserConfig(): Promise<{
  BrowserConfig: {
    getBrowsers(): BrowserName[];
    browserConfigs: Record<string, { headless: boolean }>;
  };
}> {
  jest.resetModules();
  return import('../src/browsers.js') as Promise<{
    BrowserConfig: {
      getBrowsers(): BrowserName[];
      browserConfigs: Record<string, { headless: boolean }>;
    };
  }>;
}

/** Assert that every browser config entry has headless === expected. */
async function expectHeadless(expected: boolean): Promise<void> {
  const { BrowserConfig } = await freshBrowserConfig();
  for (const config of Object.values(BrowserConfig.browserConfigs)) {
    expect(config.headless).toBe(expected);
  }
}

const ALL_BROWSERS: BrowserName[] = [
  'chrome',
  'chrome-beta',
  'canary',
  'firefox',
  'safari',
  'edge',
];

const TRUTHY_VALUES = ['true', '1', 'yes', 'on', 'TRUE', 'YES', 'ON'];
const FALSY_VALUES = ['false', '0', 'no', 'off', 'FALSE', 'NO', 'OFF'];

// ---------------------------------------------------------------------------
// Shared env setup
// ---------------------------------------------------------------------------

function cleanEnv(): void {
  delete process.env.CI;
  delete process.env.BROWSERS;
  delete process.env.HEADLESS;
}

// ---------------------------------------------------------------------------
// BROWSERS env var — getBrowsers()
// ---------------------------------------------------------------------------

describe('BROWSERS environment variable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    cleanEnv();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns all browsers when BROWSERS is not set', async () => {
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(ALL_BROWSERS);
  });

  it('returns only the specified browser (single value)', async () => {
    process.env.BROWSERS = 'firefox';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['firefox']);
  });

  it('returns multiple browsers from a comma-separated list', async () => {
    process.env.BROWSERS = 'chrome,firefox';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['chrome', 'firefox']);
  });

  it('handles spaces around browser names', async () => {
    process.env.BROWSERS = 'chrome, firefox, safari';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual([
      'chrome',
      'firefox',
      'safari',
    ]);
  });

  it('handles space-separated browser names (no commas)', async () => {
    process.env.BROWSERS = 'chrome firefox';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['chrome', 'firefox']);
  });

  it('is case-insensitive (uppercased input)', async () => {
    process.env.BROWSERS = 'Chrome,FIREFOX';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['chrome', 'firefox']);
  });

  it('filters out invalid browser names and warns', async () => {
    process.env.BROWSERS = 'firefox,hotdog';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { BrowserConfig } = await freshBrowserConfig();

    const result = BrowserConfig.getBrowsers();

    expect(result).toEqual(['firefox']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('hotdog'));
    warnSpy.mockRestore();
  });

  it('returns an empty array and warns when all BROWSERS values are invalid', async () => {
    process.env.BROWSERS = 'hotdog,notabrowser';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { BrowserConfig } = await freshBrowserConfig();

    const result = BrowserConfig.getBrowsers();

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No valid browsers'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn when all BROWSERS values are valid', async () => {
    process.env.BROWSERS = 'chrome,firefox';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { BrowserConfig } = await freshBrowserConfig();

    BrowserConfig.getBrowsers();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('allows specifying the same browser multiple times, resulting in duplicate entries', async () => {
    process.env.BROWSERS = 'firefox,firefox,chrome';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual([
      'firefox',
      'firefox',
      'chrome',
    ]);
  });

  it('BROWSERS is ignored when CI is set — always returns only firefox', async () => {
    process.env.CI = 'true';
    process.env.BROWSERS = 'chrome,safari';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['firefox']);
  });
});

// ---------------------------------------------------------------------------
// HEADLESS env var
// ---------------------------------------------------------------------------

describe('HEADLESS environment variable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    cleanEnv();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to false when neither CI nor HEADLESS is set', async () => {
    await expectHeadless(false);
  });

  describe.each(TRUTHY_VALUES)('HEADLESS=%s enables headless', value => {
    it('is true', async () => {
      process.env.HEADLESS = value;
      await expectHeadless(true);
    });
  });

  describe.each(FALSY_VALUES)('HEADLESS=%s disables headless', value => {
    it('is false', async () => {
      process.env.HEADLESS = value;
      await expectHeadless(false);
    });
  });

  it('unrecognised HEADLESS value falls back to false (no CI)', async () => {
    process.env.HEADLESS = 'maybe';
    await expectHeadless(false);
  });

  it('unrecognised HEADLESS value falls back to CI value (CI=true)', async () => {
    process.env.CI = 'true';
    process.env.HEADLESS = 'maybe';
    await expectHeadless(true);
  });
});

// ---------------------------------------------------------------------------
// CI env var — interaction with getBrowsers() and headless
// ---------------------------------------------------------------------------

describe('CI environment variable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    cleanEnv();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe.each(TRUTHY_VALUES)('CI=%s', value => {
    it('restricts browsers to firefox only', async () => {
      process.env.CI = value;
      const { BrowserConfig } = await freshBrowserConfig();
      expect(BrowserConfig.getBrowsers()).toEqual(['firefox']);
    });

    it('enables headless mode', async () => {
      process.env.CI = value;
      await expectHeadless(true);
    });
  });

  describe.each(FALSY_VALUES)('CI=%s is treated as CI not being set', value => {
    it('returns all browsers', async () => {
      process.env.CI = value;
      const { BrowserConfig } = await freshBrowserConfig();
      expect(BrowserConfig.getBrowsers()).toEqual(ALL_BROWSERS);
    });

    it('headless is false', async () => {
      process.env.CI = value;
      await expectHeadless(false);
    });
  });

  it('HEADLESS overrides the headless flag set by CI (HEADLESS=false, CI=true)', async () => {
    process.env.CI = 'true';
    process.env.HEADLESS = 'false';
    await expectHeadless(false);
  });

  it('HEADLESS overrides the headless flag set by CI (HEADLESS=0, CI=1)', async () => {
    process.env.CI = '1';
    process.env.HEADLESS = '0';
    await expectHeadless(false);
  });

  it('HEADLESS enables headless independently of CI (HEADLESS=true, CI unset)', async () => {
    process.env.HEADLESS = 'true';
    await expectHeadless(true);
  });

  it('HEADLESS enables headless independently of CI (HEADLESS=1, CI unset)', async () => {
    process.env.HEADLESS = '1';
    await expectHeadless(true);
  });
});
