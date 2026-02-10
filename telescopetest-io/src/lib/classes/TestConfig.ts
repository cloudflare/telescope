// Test-related types and utilities

// Test 'source' field options
export enum TestSource {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  UPLOAD = 'upload',
  API = 'api',
  CLI = 'cli',
  AGENT = 'agent',
  UNKNOWN = 'unknown',
}

// Config.json structure from Telescope test archives
export interface ConfigJson {
  url: string;
  date: string;
  options: {
    browser: string;
  };
}

// Test configuration interface matching database schema
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

/**
 * Generate a unique test ID with timestamp and UUID
 * Format: YYYY_MM_DD_HH_MM_SS_<uuid>
 */
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
