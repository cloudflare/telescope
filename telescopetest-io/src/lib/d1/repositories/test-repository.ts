import { D1Client } from '../d1-client';
import { TestConfig } from '../../../types/testConfig';
export class TestRepository {
  private client: D1Client;
  constructor(d1Binding: any) {
    this.client = new D1Client(d1Binding);
  }
  /**
   * Create a new test entry
   * Will throw error if duplicate zip_key
   */
  async create(testConfig: TestConfig) {
    const sql = `
      INSERT INTO tests (
        test_id, zip_key, name, description, source, 
        url, test_date, browser, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return await this.client.execute(sql, [
      testConfig.test_id,
      testConfig.zip_key,
      testConfig.name,
      testConfig.description,
      testConfig.source,
      testConfig.url,
      testConfig.test_date,
      testConfig.browser,
      testConfig.created_at,
    ]);
  }

  /**
   * Find test by zip_key
   */
  async findTestByZipKey(zipKey: string) {
    const sql = `SELECT * FROM tests WHERE zip_key = ?`;
    return await this.client.first(sql, [zipKey]);
  }
  
  /**
   * Find test_id by zip_key
   * Returns only the test_id string, or null if not found
   * Validates that only one result exists (enforced by UNIQUE constraint on zip_key)
   */
  async findTestIdByZipKey(zipKey: string): Promise<string | null> {
    const sql = `SELECT test_id FROM tests WHERE zip_key = ?`;
    const result = await this.client.first(sql, [zipKey]);
    if (!result) {
      return null;
    }
    const testId = result.test_id;
    if (!testId || typeof testId !== 'string') {
      throw new Error(`Invalid test_id returned for zip_key: ${zipKey}`);
    }
    return testId;
  }
}
