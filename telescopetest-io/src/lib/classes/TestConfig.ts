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

// Return type from D1
export type Tests = {
  test_id: string;
  url: string;
  test_date: number;
  browser: string;
  name: string | null;
  description: string | null;
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
