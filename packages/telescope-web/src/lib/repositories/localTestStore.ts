/**
 * LocalTestStore — filesystem-backed implementation of ITestStore.
 *
 * Test metadata is derived from `config.json` inside each test folder
 * under RESULTS_DIR. Name and description are read from `config.json`
 * (added by the telescope CLI via --name and --description).
 *
 * In local mode there is no persistent metadata DB:
 *   - `create()` is a no-op (the storage layer writes config.json directly)
 *   - `findByZipKey()` always returns null (dedup is by folder name)
 *   - `updateContentRating()` is a no-op (no AI rating in local mode)
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigJson, TestConfig, Tests } from '@/lib/types/tests';
import { ContentRating } from '@/lib/types/tests';

import type { ITestStore } from './testStore.js';
import { getResultsDir } from '@/lib/config/mode';

export class LocalTestStore implements ITestStore {
  private resultsDir: string;

  constructor(resultsDir?: string) {
    this.resultsDir = resultsDir ?? getResultsDir();
  }

  async getAll(_aiEnabled: boolean): Promise<Tests[]> {
    if (!existsSync(this.resultsDir)) return [];
    const tests: Tests[] = [];
    for (const entry of readdirSync(this.resultsDir)) {
      const full = join(this.resultsDir, entry);
      try {
        if (!statSync(full).isDirectory()) continue;
      } catch {
        continue;
      }
      const test = this.readTest(entry);
      if (test) tests.push(test);
    }
    // Sort newest-first by test_date (unix seconds)
    tests.sort((a, b) => b.test_date - a.test_date);
    return tests;
  }

  async getById(testId: string): Promise<Tests | null> {
    return this.readTest(testId);
  }

  async getRating(
    testId: string,
  ): Promise<{ rating: string; url: string } | null> {
    const test = this.readTest(testId);
    if (!test) return null;
    return { rating: ContentRating.SAFE, url: test.url };
  }

  async create(_testConfig: TestConfig): Promise<void> {
    // No-op. Test metadata is persisted by writing config.json via the
    // storage layer during upload.
  }

  async findByZipKey(
    _zipKey: string,
  ): Promise<{ testId: string; contentRating: string } | null> {
    // Local mode dedups by folder name, not content hash.
    return null;
  }

  async findByTestId(
    testId: string,
  ): Promise<{ testId: string; contentRating: string } | null> {
    const dir = join(this.resultsDir, testId);
    if (!existsSync(dir)) return null;
    return { testId, contentRating: ContentRating.SAFE };
  }

  async updateContentRating(
    _testId: string,
    _rating: ContentRating,
  ): Promise<void> {
    // No-op. AI rating is disabled in local mode.
  }

  /**
   * Read and parse `config.json` for a single test folder.
   * Returns `null` if the folder, file, or JSON is invalid.
   */
  private readTest(testId: string): Tests | null {
    const configPath = join(this.resultsDir, testId, 'config.json');
    if (!existsSync(configPath)) return null;
    let parsed: ConfigJson;
    try {
      parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as ConfigJson;
    } catch (error) {
      console.error(`[LocalTestStore] failed to parse ${configPath}`, error);
      return null;
    }
    const dateMs = Date.parse(parsed.date);
    const test_date = Number.isFinite(dateMs) ? Math.floor(dateMs / 1000) : 0;
    const browser =
      parsed.options?.browser ||
      parsed.browserConfig?.engine ||
      'unknown';
    return {
      test_id: testId,
      url: parsed.url ?? '',
      test_date,
      browser,
      name: parsed.name ?? null,
      description: parsed.description ?? null,
      content_rating: ContentRating.SAFE,
    };
  }
}
