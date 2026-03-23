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
  IN_PROGRESS = 'in_progress', // in process of running an AI rating, prevents duplicate jobs
}

// Config.json structure from Telescope test archives
export interface ConfigJson {
  url: string;
  date: string;
  options: {
    browser: string;
    width?: number;
    height?: number;
    frameRate?: number;
    timeout?: number;
    blockDomains?: string[];
    block?: string[];
    disableJS?: boolean;
    debug?: boolean;
    html?: boolean;
    openHtml?: boolean;
    list?: boolean;
    overrideHost?: Record<string, string>;
    connectionType?: string | false;
    cpuThrottle?: number;
    auth?: boolean | string;
    zip?: boolean;
    dry?: boolean;
    device?: boolean | string;
    deviceName?: string | false;
    url?: string;
    command?: string[];
  };
  browserConfig?: {
    engine?: string;
    headless?: boolean;
    firefoxUserPrefs?: Record<string, unknown>;
    mozLog?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    recordHar?: {
      path: string;
    };
    recordVideo?: {
      dir: string;
      size?: {
        width: number;
        height: number;
      };
    };
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
