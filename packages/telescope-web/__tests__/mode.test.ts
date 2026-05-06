import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getMode,
  getResultsDir,
  isCloudflareMode,
  isLocalMode,
} from '@/lib/config/mode';

describe('getMode', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.TELESCOPE_MODE;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.TELESCOPE_MODE;
    } else {
      process.env.TELESCOPE_MODE = original;
    }
  });

  it('defaults to cloudflare when TELESCOPE_MODE is unset', () => {
    delete process.env.TELESCOPE_MODE;
    expect(getMode()).toBe('cloudflare');
    expect(isCloudflareMode()).toBe(true);
    expect(isLocalMode()).toBe(false);
  });

  it('returns local when TELESCOPE_MODE=local', () => {
    process.env.TELESCOPE_MODE = 'local';
    expect(getMode()).toBe('local');
    expect(isLocalMode()).toBe(true);
    expect(isCloudflareMode()).toBe(false);
  });

  it('returns cloudflare for any non-local value', () => {
    process.env.TELESCOPE_MODE = 'production';
    expect(getMode()).toBe('cloudflare');
    process.env.TELESCOPE_MODE = '';
    expect(getMode()).toBe('cloudflare');
  });
});

describe('getResultsDir', () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.RESULTS_DIR;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.RESULTS_DIR;
    } else {
      process.env.RESULTS_DIR = original;
    }
  });

  it('defaults to ./results when RESULTS_DIR is unset', () => {
    delete process.env.RESULTS_DIR;
    expect(getResultsDir()).toBe('./results');
  });

  it('reads RESULTS_DIR when set', () => {
    process.env.RESULTS_DIR = '/var/telescope/results';
    expect(getResultsDir()).toBe('/var/telescope/results');
  });
});
