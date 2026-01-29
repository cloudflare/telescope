import { D1Client } from '../d1-client';
import { TestConfig } from '../../../types/testConfig';
export class TestRepository {
  private client: D1Client;
  constructor(d1Binding: any) {
    this.client = new D1Client(d1Binding);
  }
  /**
   * Create a new test entry
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
   * Find test by ID
   */
  async findById(testId: string) {
    const sql = `SELECT * FROM tests WHERE test_id = ?`;
    return await this.client.first(sql, [testId]);
  }
  /**
   * Find test by zip_key
   */
  async findByZipKey(zipKey: string) {
    const sql = `SELECT * FROM tests WHERE zip_key = ?`;
    return await this.client.first(sql, [zipKey]);
  }
  /**
   * Find all tests
   */
  async findAll(limit: number = 100, offset: number = 0) {
    const sql = `SELECT * FROM tests ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    return await this.client.all(sql, [limit, offset]);
  }
  /**
   * Delete test by ID
   */
  async deleteById(testId: string) {
    const sql = `DELETE FROM tests WHERE test_id = ?`;
    return await this.client.execute(sql, [testId]);
  }
  /**
   * Update test
   */
  async update(testId: string, updates: Partial<TestConfig>) {
    const entries = Object.entries(updates);
    const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, value]) => value);
    
    const sql = `UPDATE tests SET ${setClauses} WHERE test_id = ?`;
    return await this.client.execute(sql, [...values, testId]);
  }
}