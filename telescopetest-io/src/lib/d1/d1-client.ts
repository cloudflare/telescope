export class D1Client {
  private db: any; // D1Database binding
  constructor(db: any) {
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
   * Query and return all rows
   */
  async all(sql: string, params: any[] = []) {
    const stmt = this.db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.all();
  }
  /**
   * Query and return first row
   */
  async first(sql: string, params: any[] = []) {
    const stmt = this.db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.first();
  }
  /**
   * Insert a record
   */
  async insert(table: string, data: Record<string, any>) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return await this.execute(sql, values);
  }
}