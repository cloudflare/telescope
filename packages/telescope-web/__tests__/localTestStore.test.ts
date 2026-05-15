import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalTestStore } from '@/lib/repositories/localTestStore';
import { ContentRating } from '@/lib/types/tests';

interface MinimalConfig {
  url: string;
  date: string;
  options: { url: string; browser?: string };
  browserConfig: { engine: string };
  name?: string;
  description?: string;
}

function writeTest(
  baseDir: string,
  testId: string,
  config: MinimalConfig,
): void {
  const dir = join(baseDir, testId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config));
}

describe('LocalTestStore', () => {
  let dir: string;
  let store: LocalTestStore;

  beforeEach(() => {
    dir = join(
      tmpdir(),
      `telescope-localteststore-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(dir, { recursive: true });
    store = new LocalTestStore(dir);
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty array when results directory has no tests', async () => {
    expect(await store.getAll(false)).toEqual([]);
  });

  it('returns empty array when results directory does not exist', async () => {
    rmSync(dir, { recursive: true, force: true });
    expect(await store.getAll(false)).toEqual([]);
  });

  it('reads tests from config.json with name and description', async () => {
    writeTest(dir, '2026_01_15_10_30_00_test-uuid-1', {
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com', browser: 'chrome' },
      browserConfig: { engine: 'chromium' },
      name: 'My Test',
      description: 'A description',
    });

    const tests = await store.getAll(false);
    expect(tests).toHaveLength(1);
    expect(tests[0]).toMatchObject({
      test_id: '2026_01_15_10_30_00_test-uuid-1',
      url: 'https://example.com',
      browser: 'chrome',
      name: 'My Test',
      description: 'A description',
      content_rating: ContentRating.SAFE,
    });
    expect(tests[0].test_date).toBeGreaterThan(0);
  });

  it('treats name and description as null when missing', async () => {
    writeTest(dir, '2026_01_15_10_30_00_test-uuid-2', {
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com', browser: 'firefox' },
      browserConfig: { engine: 'firefox' },
    });

    const test = await store.getById('2026_01_15_10_30_00_test-uuid-2');
    expect(test).not.toBeNull();
    expect(test!.name).toBeNull();
    expect(test!.description).toBeNull();
    expect(test!.browser).toBe('firefox');
  });

  it('falls back to browserConfig.engine when options.browser is missing', async () => {
    writeTest(dir, '2026_01_15_10_30_00_test-uuid-3', {
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com' },
      browserConfig: { engine: 'webkit' },
    });

    const test = await store.getById('2026_01_15_10_30_00_test-uuid-3');
    expect(test!.browser).toBe('webkit');
  });

  it('sorts tests newest-first by test_date', async () => {
    writeTest(dir, 'a', {
      url: 'https://a.com',
      date: 'Wed, 01 Jan 2025 00:00:00 GMT',
      options: { url: 'https://a.com' },
      browserConfig: { engine: 'chromium' },
    });
    writeTest(dir, 'b', {
      url: 'https://b.com',
      date: 'Wed, 01 Jan 2026 00:00:00 GMT',
      options: { url: 'https://b.com' },
      browserConfig: { engine: 'chromium' },
    });
    writeTest(dir, 'c', {
      url: 'https://c.com',
      date: 'Wed, 01 Jul 2025 00:00:00 GMT',
      options: { url: 'https://c.com' },
      browserConfig: { engine: 'chromium' },
    });

    const tests = await store.getAll(false);
    expect(tests.map(t => t.test_id)).toEqual(['b', 'c', 'a']);
  });

  it('skips folders without a config.json', async () => {
    mkdirSync(join(dir, 'no-config-here'), { recursive: true });
    writeTest(dir, 'has-config', {
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com' },
      browserConfig: { engine: 'chromium' },
    });
    const tests = await store.getAll(false);
    expect(tests).toHaveLength(1);
    expect(tests[0].test_id).toBe('has-config');
  });

  it('skips folders with malformed config.json', async () => {
    mkdirSync(join(dir, 'bad'), { recursive: true });
    writeFileSync(join(dir, 'bad', 'config.json'), '{ not json');
    expect(await store.getAll(false)).toEqual([]);
    expect(await store.getById('bad')).toBeNull();
  });

  it('returns null from getById for non-existent test', async () => {
    expect(await store.getById('does-not-exist')).toBeNull();
  });

  it('findByTestId returns SAFE rating for existing folder', async () => {
    writeTest(dir, 'present', {
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com' },
      browserConfig: { engine: 'chromium' },
    });
    expect(await store.findByTestId('present')).toEqual({
      testId: 'present',
      contentRating: ContentRating.SAFE,
    });
    expect(await store.findByTestId('absent')).toBeNull();
  });

  it('findByZipKey always returns null in local mode', async () => {
    expect(await store.findByZipKey('any-hash')).toBeNull();
  });

  it('getRating returns SAFE for existing tests, null for missing', async () => {
    writeTest(dir, 'present', {
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com' },
      browserConfig: { engine: 'chromium' },
    });
    expect(await store.getRating('present')).toEqual({
      rating: ContentRating.SAFE,
      url: 'https://example.com',
    });
    expect(await store.getRating('absent')).toBeNull();
  });

  it('create() and updateContentRating() are no-ops', async () => {
    await expect(
      store.create({
        testId: 'x',
        zipKey: 'k',
        source: 'upload' as never,
        url: 'https://x.com',
        testDate: 0,
        browser: 'chrome',
      }),
    ).resolves.toBeUndefined();
    await expect(
      store.updateContentRating('x', ContentRating.SAFE),
    ).resolves.toBeUndefined();
  });
});
