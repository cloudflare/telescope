export class D1Client {
  private db;
  constructor(db: Env['TELESCOPE_DB']) {
    this.db = db;
  }
  /**
   * Execute a prepared statement with parameters
   * @param sql - SQL query with ? placeholders
   * @param params - Array of values to bind
   * @returns Query result
   */
  async execute(sql: string, params: any[] = []) {
    const stmt = this.db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.run();
  }

  /**
   * Query and return first row
   */
  async first(sql: string, params: any[] = []) {
    const stmt = this.db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.first();
  }
}
