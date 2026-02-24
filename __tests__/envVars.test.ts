/**
 * Tests for BROWSERS and HEADLESS environment variable handling in src/browsers.ts.
 *
 * Because the module evaluates CI, HEADLESS, and BROWSERS at load time (top-level
 * const), each group of tests must re-import the module after setting the desired
 * env vars. We use jest.resetModules() + a dynamic import() inside each test/
 * beforeEach to achieve true module isolation.
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
  BrowserConfig: { getBrowsers(): BrowserName[]; browserConfigs: Record<string, { headless: boolean }> };
}> {
  jest.resetModules();
  return import('../src/browsers.js') as Promise<{
    BrowserConfig: { getBrowsers(): BrowserName[]; browserConfigs: Record<string, { headless: boolean }> };
  }>;
}

const ALL_BROWSERS: BrowserName[] = [
  'chrome',
  'chrome-beta',
  'canary',
  'firefox',
  'safari',
  'edge',
];

// ---------------------------------------------------------------------------
// BROWSERS env var — getBrowsers()
// ---------------------------------------------------------------------------

describe('BROWSERS environment variable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.BROWSERS;
    delete process.env.HEADLESS;
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
    expect(BrowserConfig.getBrowsers()).toEqual(['chrome', 'firefox', 'safari']);
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
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('hotdog'),
    );
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
    expect(BrowserConfig.getBrowsers()).toEqual(['firefox', 'firefox', 'chrome']);
  });

  it('BROWSERS is ignored when CI is set — always returns only firefox', async () => {
    process.env.CI = 'true';
    process.env.BROWSERS = 'chrome,safari';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['firefox']);
  });
});

// ---------------------------------------------------------------------------
// HEADLESS env var — headless flag on browserConfigs entries
// ---------------------------------------------------------------------------

describe('HEADLESS environment variable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.BROWSERS;
    delete process.env.HEADLESS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('defaults to false when neither CI nor HEADLESS is set', async () => {
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(false);
    }
  });

  it('is true when HEADLESS=true', async () => {
    process.env.HEADLESS = 'true';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(true);
    }
  });

  it('is false when HEADLESS=false, even if CI is set', async () => {
    process.env.CI = 'true';
    process.env.HEADLESS = 'false';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(false);
    }
  });

  it('HEADLESS is case-insensitive (TRUE)', async () => {
    process.env.HEADLESS = 'TRUE';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(true);
    }
  });

  it('treats any non-"true" HEADLESS value as false', async () => {
    process.env.HEADLESS = 'yes';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// CI env var — interaction with getBrowsers() and headless
// ---------------------------------------------------------------------------

describe('CI environment variable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CI;
    delete process.env.BROWSERS;
    delete process.env.HEADLESS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('CI=true restricts browsers to firefox only', async () => {
    process.env.CI = 'true';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(['firefox']);
  });

  it('CI=true enables headless mode', async () => {
    process.env.CI = 'true';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(true);
    }
  });

  it('CI=false is treated as CI not being set (all browsers, not headless)', async () => {
    process.env.CI = 'false';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(ALL_BROWSERS);
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(false);
    }
  });

  it('CI=0 is treated as CI not being set', async () => {
    process.env.CI = '0';
    const { BrowserConfig } = await freshBrowserConfig();
    expect(BrowserConfig.getBrowsers()).toEqual(ALL_BROWSERS);
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(false);
    }
  });

  it('HEADLESS=true overrides CI headless mode when CI is not set', async () => {
    process.env.HEADLESS = 'true';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(true);
    }
  });

  it('HEADLESS=false overrides headless even when CI is set', async () => {
    process.env.CI = 'true';
    process.env.HEADLESS = 'false';
    const { BrowserConfig } = await freshBrowserConfig();
    for (const config of Object.values(BrowserConfig.browserConfigs)) {
      expect(config.headless).toBe(false);
    }
  });
});
