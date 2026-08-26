import type { APIContext } from 'astro';
import type {
  ResultStore,
  RuntimeServices,
  StoredResult,
  TestStore,
} from '@/lib/storage/types';
import type { ContentRating, TestConfig, Tests } from '@/lib/types/tests';
import { ContentRating as Rating } from '@/lib/types/tests';

class D1TestStore implements TestStore {
  constructor(private readonly database: D1Database) {}

  async create(testConfig: TestConfig): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO tests (
          test_id, zip_key, name, description, source, url, test_date, browser,
          content_rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        testConfig.testId,
        testConfig.zipKey,
        testConfig.name ?? null,
        testConfig.description ?? null,
        testConfig.source,
        testConfig.url,
        testConfig.testDate,
        testConfig.browser,
        Rating.UNKNOWN,
      )
      .run();
  }

  async findByZipKey(
    zipKey: string,
  ): Promise<{ testId: string; contentRating: string } | null> {
    const row = await this.database
      .prepare('SELECT test_id, content_rating FROM tests WHERE zip_key = ?')
      .bind(zipKey)
      .first<{ test_id: string; content_rating: string }>();
    return row
      ? { testId: row.test_id, contentRating: row.content_rating }
      : null;
  }

  async getById(testId: string): Promise<Tests | null> {
    return await this.database
      .prepare(
        `SELECT test_id, url, test_date, browser, name, description,
          content_rating
         FROM tests WHERE test_id = ?`,
      )
      .bind(testId)
      .first<Tests>();
  }

  async getAll(aiEnabled: boolean): Promise<Tests[]> {
    const statement = this.database.prepare(
      `SELECT test_id, url, test_date, browser, name, description,
        content_rating
       FROM tests ${aiEnabled ? 'WHERE content_rating = ?' : ''}
       ORDER BY created_at DESC`,
    );
    const query = aiEnabled ? statement.bind(Rating.SAFE) : statement;
    return (await query.all<Tests>()).results;
  }

  async getRating(
    testId: string,
  ): Promise<{ rating: string; url: string } | null> {
    const row = await this.database
      .prepare('SELECT content_rating, url FROM tests WHERE test_id = ?')
      .bind(testId)
      .first<{ content_rating: string; url: string }>();
    return row ? { rating: row.content_rating, url: row.url } : null;
  }

  async updateRating(testId: string, rating: ContentRating): Promise<void> {
    await this.database
      .prepare(
        `UPDATE tests SET content_rating = ?, updated_at = unixepoch()
         WHERE test_id = ?`,
      )
      .bind(rating, testId)
      .run();
  }
}

class R2StoredResult implements StoredResult {
  readonly body: ReadableStream;

  constructor(private readonly object: R2ObjectBody) {
    this.body = object.body;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return await this.object.arrayBuffer();
  }

  async json<T>(): Promise<T> {
    return await this.object.json<T>();
  }
}

class R2ResultStore implements ResultStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, value: Uint8Array): Promise<void> {
    await this.bucket.put(key, value);
  }

  async get(key: string): Promise<StoredResult | null> {
    const object = await this.bucket.get(key);
    return object ? new R2StoredResult(object) : null;
  }

  async has(key: string): Promise<boolean> {
    return (await this.bucket.head(key)) !== null;
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix, cursor });
      keys.push(...page.objects.map(object => object.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return keys;
  }
}

export async function createRuntimeServices(
  context: APIContext,
): Promise<RuntimeServices> {
  const runtime = context.locals.runtime;
  if (!runtime) throw new Error('Cloudflare runtime bindings are unavailable');

  const env = runtime.env;
  if (!env.TELESCOPE_DB || !env.RESULTS_BUCKET) {
    throw new Error('Required Cloudflare storage bindings are unavailable');
  }
  return {
    tests: new D1TestStore(env.TELESCOPE_DB),
    results: new R2ResultStore(env.RESULTS_BUCKET),
    aiEnabled: env.ENABLE_AI_RATING === 'true',
    ai: env.AI,
    waitUntil: promise => runtime.ctx.waitUntil(promise),
  };
}
