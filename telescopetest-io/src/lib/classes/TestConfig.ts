// Test-related types and utilities

// Types of sources allowed for tests
export enum TestSource {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  UPLOAD = 'upload',
  API = 'api',
  CLI = 'cli',
  AGENT = 'agent',
  UNKNOWN = 'unknown',
}

export enum ContentRating {
  SAFE = 'safe', // was rated, is safe
  UNSAFE = 'unsafe', // was rated, is unsafe
  UNKNOWN = 'unknown', // not yet rated, default on test creation, will prevent test from being listed if AI rating enabled
  RATING = 'rating', // in process of running an AI rating, to retrigger/prevent spam
}

// Config.json structure from Telescope test archives
export interface ConfigJson {
  url: string;
  date: string;
  options: {
    browser: string;
  };
}

// Return type from D1
export type Tests = {
  test_id: string;
  url: string;
  test_date: number;
  browser: string;
  name: string | null;
  description: string | null;
  content_rating: string;
};

// Upload type into D1
export interface TestConfig {
  testId: string;
  zipKey: string;
  name?: string;
  description?: string;
  source: TestSource;
  url: string;
  testDate: number;
  browser: string;
}

// Generate a test_id
export function generateTestId(): string {
  const date_ob = new Date();
  const date = date_ob.getDate().toString().padStart(2, '0');
  const month = (date_ob.getMonth() + 1).toString().padStart(2, '0');
  const year = date_ob.getFullYear();
  const hour = date_ob.getHours().toString().padStart(2, '0');
  const minute = date_ob.getMinutes().toString().padStart(2, '0');
  const second = date_ob.getSeconds().toString().padStart(2, '0');
  return `${year}_${month}_${date}_${hour}_${minute}_${second}_${crypto.randomUUID()}`;
}
