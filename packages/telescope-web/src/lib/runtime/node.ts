import { mkdirSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { APIContext } from 'astro';
import type {
  ResultStore,
  RuntimeServices,
  StoredResult,
  TestStore,
} from '@/lib/storage/types';
import type { ContentRating, TestConfig, Tests } from '@/lib/types/tests';
import { ContentRating as Rating } from '@/lib/types/tests';

function getDataDirectory(): string {
  return path.resolve(process.env.TELESCOPE_DATA_DIR ?? '.telescope-data');
}

class LocalTestStore implements TestStore {
  readonly database: DatabaseSync;

  constructor(dataDirectory: string) {
    mkdirSync(dataDirectory, { recursive: true });
    this.database = new DatabaseSync(
      path.join(dataDirectory, 'telescope.sqlite'),
      { timeout: 5_000 },
    );
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tests (
        test_id TEXT PRIMARY KEY,
        zip_key TEXT UNIQUE NOT NULL,
        name TEXT,
        description TEXT,
        source TEXT NOT NULL,
        url TEXT NOT NULL,
        test_date INTEGER NOT NULL,
        browser TEXT NOT NULL,
        content_rating TEXT NOT NULL DEFAULT 'unknown',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_tests_file_key ON tests(zip_key);
      CREATE INDEX IF NOT EXISTS idx_tests_content_rating ON tests(content_rating);
      CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);
    `);
  }

  async create(testConfig: TestConfig): Promise<void> {
    this.database
      .prepare(
        `INSERT INTO tests (
          test_id, zip_key, name, description, source, url, test_date, browser,
          content_rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        testConfig.testId,
        testConfig.zipKey,
        testConfig.name ?? null,
        testConfig.description ?? null,
        testConfig.source,
        testConfig.url,
        testConfig.testDate,
        testConfig.browser,
        Rating.UNKNOWN,
      );
  }

  async findByZipKey(
    zipKey: string,
  ): Promise<{ testId: string; contentRating: string } | null> {
    const row = this.database
      .prepare('SELECT test_id, content_rating FROM tests WHERE zip_key = ?')
      .get(zipKey) as { test_id: string; content_rating: string } | undefined;
    return row
      ? { testId: row.test_id, contentRating: row.content_rating }
      : null;
  }

  async getById(testId: string): Promise<Tests | null> {
    const row = this.database
      .prepare(
        `SELECT test_id, url, test_date, browser, name, description,
          content_rating
         FROM tests WHERE test_id = ?`,
      )
      .get(testId) as Tests | undefined;
    return row ?? null;
  }

  async getAll(aiEnabled: boolean): Promise<Tests[]> {
    const where = aiEnabled ? 'WHERE content_rating = ?' : '';
    const statement = this.database.prepare(
      `SELECT test_id, url, test_date, browser, name, description,
        content_rating
       FROM tests ${where} ORDER BY created_at DESC`,
    );
    return (
      aiEnabled ? statement.all(Rating.SAFE) : statement.all()
    ) as Tests[];
  }

  async getRating(
    testId: string,
  ): Promise<{ rating: string; url: string } | null> {
    const row = this.database
      .prepare('SELECT content_rating, url FROM tests WHERE test_id = ?')
      .get(testId) as { content_rating: string; url: string } | undefined;
    return row ? { rating: row.content_rating, url: row.url } : null;
  }

  async updateRating(testId: string, rating: ContentRating): Promise<void> {
    this.database
      .prepare(
        `UPDATE tests SET content_rating = ?, updated_at = unixepoch()
         WHERE test_id = ?`,
      )
      .run(rating, testId);
  }
}

class LocalStoredResult implements StoredResult {
  readonly body: ArrayBuffer;

  constructor(bytes: Uint8Array) {
    this.body = Uint8Array.from(bytes).buffer;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.body;
  }

  async json<T>(): Promise<T> {
    return JSON.parse(new TextDecoder().decode(this.body)) as T;
  }
}

class LocalResultStore implements ResultStore {
  constructor(private readonly rootDirectory: string) {}

  private resolveKey(key: string): string {
    const normalized = key.replaceAll('\\', '/');
    const destination = path.resolve(
      this.rootDirectory,
      ...normalized.split('/'),
    );
    if (
      destination !== this.rootDirectory &&
      !destination.startsWith(`${this.rootDirectory}${path.sep}`)
    ) {
      throw new Error('Invalid result storage key');
    }
    return destination;
  }

  async put(key: string, value: Uint8Array): Promise<void> {
    const destination = this.resolveKey(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, value);
  }

  async get(key: string): Promise<StoredResult | null> {
    try {
      return new LocalStoredResult(await readFile(this.resolveKey(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return (await stat(this.resolveKey(key))).isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const directory = this.resolveKey(prefix);
    const keys: string[] = [];

    const visit = async (currentDirectory: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(currentDirectory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      for (const entry of entries) {
        const entryPath = path.join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
          await visit(entryPath);
        } else if (entry.isFile()) {
          keys.push(
            path
              .relative(this.rootDirectory, entryPath)
              .split(path.sep)
              .join('/'),
          );
        }
      }
    };

    await visit(directory);
    return keys;
  }
}

/** Creates an isolated local runtime backed by SQLite and the filesystem. */
export function createLocalRuntimeServices(
  dataDirectory: string,
): RuntimeServices {
  return {
    tests: new LocalTestStore(dataDirectory),
    results: new LocalResultStore(path.join(dataDirectory, 'results')),
    aiEnabled: false,
  };
}

let services: RuntimeServices | undefined;

export async function createRuntimeServices(
  _context: APIContext,
): Promise<RuntimeServices> {
  if (!services) {
    services = createLocalRuntimeServices(getDataDirectory());
  }
  return services;
}
