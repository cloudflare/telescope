/**
 * Test metadata store abstraction.
 *
 * Two implementations exist:
 *   - D1TestStore: backed by Cloudflare D1 via Prisma
 *   - LocalTestStore: scans the local results directory and reads
 *     `config.json` from each test folder
 *
 * Use `getTestStore()` from `@/lib/storage/factory` to obtain the
 * right instance based on TELESCOPE_MODE.
 */

import type { TestConfig, Tests } from '@/lib/types/tests';
import type { ContentRating } from '@/lib/types/tests';

export interface ITestStore {
  /**
   * Return all visible tests, ordered newest first.
   * Implementations may filter unsafe tests when AI rating is enabled.
   */
  getAll(aiEnabled: boolean): Promise<Tests[]>;

  /**
   * Return a single test by its testId, or `null` if not found.
   */
  getById(testId: string): Promise<Tests | null>;

  /**
   * Return content rating + url for a single test, or `null` if not found.
   */
  getRating(testId: string): Promise<{ rating: string; url: string } | null>;

  /**
   * Persist test metadata. In cloudflare mode this writes a D1 row.
   * In local mode this is a no-op (metadata lives in `config.json`,
   * which is written via the storage layer during upload).
   */
  create(testConfig: TestConfig): Promise<void>;

  /**
   * Cloudflare-only duplicate check by SHA-256 hash of zip contents.
   * Local mode never calls this; it dedups by folder name via
   * `findByTestId`.
   */
  findByZipKey(
    zipKey: string,
  ): Promise<{ testId: string; contentRating: string } | null>;

  /**
   * Local-mode duplicate check — returns the testId if a test folder
   * with that id already exists. Cloudflare mode also supports this.
   */
  findByTestId(
    testId: string,
  ): Promise<{ testId: string; contentRating: string } | null>;

  /**
   * Update the AI content rating for a test. No-op in local mode.
   */
  updateContentRating(testId: string, rating: ContentRating): Promise<void>;
}
