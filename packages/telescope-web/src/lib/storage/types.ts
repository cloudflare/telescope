import type { ContentRating, TestConfig, Tests } from '@/lib/types/tests';

export interface StoredResult {
  body: BodyInit;
  arrayBuffer(): Promise<ArrayBuffer>;
  json<T>(): Promise<T>;
}

export interface ResultStore {
  put(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<StoredResult | null>;
  has(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

export interface TestStore {
  create(testConfig: TestConfig): Promise<void>;
  findByZipKey(
    zipKey: string,
  ): Promise<{ testId: string; contentRating: string } | null>;
  getById(testId: string): Promise<Tests | null>;
  getAll(aiEnabled: boolean): Promise<Tests[]>;
  getRating(testId: string): Promise<{ rating: string; url: string } | null>;
  updateRating(testId: string, rating: ContentRating): Promise<void>;
}

export interface RuntimeServices {
  tests: TestStore;
  results: ResultStore;
  aiEnabled: boolean;
  ai?: Ai;
  waitUntil?: (promise: Promise<unknown>) => void;
}
