/**
 * Storage abstraction for test result files.
 *
 * Two implementations exist:
 *   - CloudflareStorage: backed by an R2 bucket (env.RESULTS_BUCKET)
 *   - LocalStorage: backed by the local filesystem (RESULTS_DIR)
 *
 * Use `getStorage()` from `./factory.js` to obtain the right instance
 * based on TELESCOPE_MODE.
 */

export interface IStorage {
  /**
   * Read a file as raw bytes. Returns `null` if the file does not exist.
   */
  get(testId: string, filename: string): Promise<Uint8Array | null>;

  /**
   * Read a file and parse as JSON. Returns `null` if missing or invalid.
   */
  getJSON<T>(testId: string, filename: string): Promise<T | null>;

  /**
   * Write bytes to a file. Creates parent directories as needed.
   */
  put(testId: string, filename: string, data: Uint8Array): Promise<void>;

  /**
   * List all files belonging to a test. Returns relative paths
   * (without the testId prefix). Returns an empty array if the
   * test does not exist.
   */
  list(testId: string): Promise<string[]>;

  /**
   * Returns true if the file exists in storage.
   */
  exists(testId: string, filename: string): Promise<boolean>;
}
