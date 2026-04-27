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
// Matches SavedConfig from telescope/src/types.ts
export interface ConfigJson {
  url: string;
  date: string;
  options: {
    url: string;
    browser?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    args?: string[];
    blockDomains?: string[];
    block?: string[];
    firefoxPrefs?: Record<string, string | number | boolean>;
    cpuThrottle?: number;
    connectionType?: string | false;
    width?: number;
    height?: number;
    frameRate?: number;
    disableJS?: boolean;
    debug?: boolean;
    auth?: unknown;
    timeout?: number;
    html?: boolean;
    openHtml?: boolean;
    list?: boolean;
    overrideHost?: Record<string, string>;
    zip?: boolean;
    uploadUrl?: string | null;
    dry?: boolean;
    userAgent?: string;
    agentExtra?: string;
    command?: string[];
    delay?: Record<string, number>;
    delayUsing?: string;
  };
  browserConfig: {
    engine: string;
    channel?: string;
    headless: boolean;
    viewport: { width: number; height: number };
    recordHar: { path: string };
    recordVideo: { dir: string; size: { width: number; height: number } };
    args?: string[];
    ignoreDefaultArgs?: string[];
    firefoxUserPrefs?: Record<string, string | number | boolean>;
    env?: Record<string, string>;
    javaScriptEnabled?: boolean;
    httpCredentials?: unknown;
    userAgent?: string;
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
