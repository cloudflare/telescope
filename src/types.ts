/**
 * Central type definitions for Telescope
 * All shared types are defined here and exported for use across the codebase
 */

import type { BrowserContext, HTTPCredentials } from 'playwright';

// ============================================================================
// Cookie Types
// ============================================================================

/**
 * Cookie type extracted from Playwright's BrowserContext
 */
export type Cookie = Parameters<BrowserContext['addCookies']>[0][number];

// ============================================================================
// Network Types
// ============================================================================

/**
 * Available connection types for network throttling
 */
export type ConnectionType =
  | '3g'
  | '3gfast'
  | '3gslow'
  | '2g'
  | 'cable'
  | 'dsl'
  | '4g'
  | 'fios'
  | false;

/**
 * Network profile configuration for throttling
 */
export interface NetworkProfile {
  down: number;
  up: number;
  rtt: number;
}

/**
 * Map of connection types to their network profiles
 */
export type NetworkTypes = Record<
  Exclude<ConnectionType, false>,
  NetworkProfile
>;

// ============================================================================
// Browser Types
// ============================================================================

/**
 * Supported browser names
 */
export type BrowserName =
  | 'chrome'
  | 'chrome-beta'
  | 'canary'
  | 'firefox'
  | 'safari'
  | 'edge';

/**
 * Playwright browser engines
 */
export type PlaywrightEngine = 'chromium' | 'webkit' | 'firefox';

/**
 * Browser channel for Chromium-based browsers
 */
export type BrowserChannel =
  | 'chrome'
  | 'chrome-beta'
  | 'chrome-canary'
  | 'msedge';

/**
 * Base browser configuration
 */
export interface BaseBrowserConfig {
  engine: PlaywrightEngine;
  headless: boolean;
}

/**
 * Chromium-specific browser configuration
 */
export interface ChromiumBrowserConfig extends BaseBrowserConfig {
  engine: 'chromium';
  channel: BrowserChannel;
  flags: boolean;
  args: string[];
}

/**
 * Firefox-specific browser configuration
 */
export interface FirefoxBrowserConfig extends BaseBrowserConfig {
  engine: 'firefox';
  firefoxUserPrefs: Record<string, string | number | boolean>;
  mozLog: boolean;
}

/**
 * WebKit-specific browser configuration
 */
export interface WebKitBrowserConfig extends BaseBrowserConfig {
  engine: 'webkit';
}

/**
 * Union of all browser configurations
 */
export type BrowserConfigEntry =
  | ChromiumBrowserConfig
  | FirefoxBrowserConfig
  | WebKitBrowserConfig;

/**
 * Full browser configuration with all runtime options
 */
export interface BrowserConfigOptions {
  engine: PlaywrightEngine;
  channel?: BrowserChannel;
  headless: boolean;
  viewport: { width: number; height: number };
  recordHar: { path: string };
  recordVideo: { dir: string; size: { width: number; height: number } };
  args?: string[];
  ignoreDefaultArgs?: string[];
  firefoxUserPrefs?: Record<string, string | number | boolean>;
  env?: Record<string, string>;
  javaScriptEnabled?: boolean;
  httpCredentials?: HTTPCredentials;
  logger?: {
    isEnabled: (name: string, severity: string) => boolean;
    log: (name: string, severity: string, message: string) => void;
  };
}

// ============================================================================
// Launch Options
// ============================================================================

/**
 * Options for launching a test (CLI and programmatic API)
 */
export interface LaunchOptions {
  url: string;
  browser?: BrowserName;
  headers?: Record<string, string>;
  cookies?: Cookie | Cookie[];
  args?: string[];
  blockDomains?: string[];
  block?: string[];
  firefoxPrefs?: Record<string, string | number | boolean>;
  cpuThrottle?: number;
  connectionType?: ConnectionType;
  width?: number;
  height?: number;
  frameRate?: number;
  disableJS?: boolean;
  debug?: boolean;
  auth?: HTTPCredentials | false;
  timeout?: number;
  html?: boolean;
  openHtml?: boolean;
  list?: boolean;
  overrideHost?: Record<string, string>;
  zip?: boolean;
  dry?: boolean;
  command?: string[];
}

/**
 * Default options type (subset of LaunchOptions that have defaults)
 */
export interface DefaultOptions {
  browser: BrowserName;
  width: number;
  height: number;
  frameRate: number;
  timeout: number;
  blockDomains: string[];
  block: string[];
  disableJS: boolean;
  debug: boolean;
  html: boolean;
  openHtml: boolean;
  list: boolean;
  overrideHost: Record<string, string>;
  connectionType: ConnectionType;
  auth: HTTPCredentials | false;
  zip: boolean;
  dry: boolean;
}

// ============================================================================
// Test Results
// ============================================================================

/**
 * Successful test result
 */
export interface SuccessfulTestResult {
  success: true;
  testId: string;
  resultsPath: string;
  dry?: boolean;
}

/**
 * Failed test result
 */
export interface FailedTestResult {
  success: false;
  error: string;
}

/**
 * Union type for all test results
 */
export type TestResult = SuccessfulTestResult | FailedTestResult;

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Server timing entry from Performance API
 */
export interface ServerTiming {
  name: string;
  description: string;
  duration: number;
}

/**
 * Navigation timing from Performance API
 */
export interface NavigationTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  navigationStart: number;
  unloadEventStart: number;
  unloadEventEnd: number;
  redirectStart: number;
  redirectEnd: number;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  domLoading: number;
  domInteractive: number;
  domContentLoadedEventStart: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
  loadEventStart: number;
  loadEventEnd: number;
  serverTiming?: ServerTiming[];
  // Chromium-specific timings
  firstInterimResponseStart?: number;
  finalResponseHeadersStart?: number;
}

/**
 * Paint timing entry from Performance API
 */
export interface PaintTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

/**
 * User timing entry (mark or measure)
 */
export interface UserTiming {
  name: string;
  entryType: 'mark' | 'measure';
  startTime: number;
  duration: number;
}

/**
 * Bounding rectangle for LCP element
 */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * LCP element details
 */
export interface LCPElement {
  nodeName: string;
  boundingRect: BoundingRect;
  outerHTML: string;
  src?: string;
  currentSrc?: string;
  'background-image'?: string;
  content?: string;
}

/**
 * Largest Contentful Paint event
 */
export interface LCPEvent {
  name: string;
  entryType: string;
  startTime: number;
  size: number;
  url: string;
  id: string;
  loadTime: number;
  renderTime: number;
  element?: LCPElement;
}

/**
 * Layout shift source rect
 */
export interface LayoutShiftSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Layout shift source
 */
export interface LayoutShiftSource {
  previousRect: LayoutShiftSourceRect;
  currentRect: LayoutShiftSourceRect;
}

/**
 * Layout shift event from Performance API
 */
export interface LayoutShift {
  name: string;
  entryType: string;
  startTime: number;
  value: number;
  hadRecentInput: boolean;
  lastInputTime: number;
  sources?: LayoutShiftSource[];
}

/**
 * All collected metrics
 */
export interface Metrics {
  navigationTiming: NavigationTiming;
  paintTiming: PaintTiming[];
  userTiming: UserTiming[];
  largestContentfulPaint: LCPEvent[];
  layoutShifts: LayoutShift[];
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request timing data from Playwright
 */
export interface RequestTiming {
  startTime: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  secureConnectionStart: number;
  connectEnd: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
}

/**
 * Request data collected during test
 */
export interface RequestData {
  url: string;
  timing: RequestTiming;
  rawTimings?: boolean;
}

/**
 * Resource timing entry from Performance API
 */
export interface ResourceTiming {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  initiatorType: string;
  fetchStart: number;
  domainLookupStart: number;
  domainLookupEnd: number;
  connectStart: number;
  connectEnd: number;
  secureConnectionStart: number;
  requestStart: number;
  responseStart: number;
  responseEnd: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

// ============================================================================
// Console Message
// ============================================================================

/**
 * Console message location
 */
export interface ConsoleLocation {
  url: string;
  lineNumber: number;
  columnNumber: number;
}

/**
 * Console message collected during test
 */
export interface ConsoleMessage {
  type: string;
  text: string;
  location: ConsoleLocation;
}

// ============================================================================
// Result Assets
// ============================================================================

/**
 * Filmstrip frame data
 */
export interface FilmstripFrame {
  num: number;
  filename: string;
  ms: number;
}

/**
 * Result assets from test
 */
export interface ResultAssets {
  filmstrip?: FilmstripFrame[];
  filmstripFiles?: string[];
  videoFile: string | null;
}

// ============================================================================
// Paths
// ============================================================================

/**
 * Test paths configuration
 */
export interface TestPaths {
  temporaryContext: string;
  results: string;
  filmstrip: string;
}

// ============================================================================
// Config File
// ============================================================================

/**
 * Saved configuration in results directory
 */
export interface SavedConfig {
  url: string;
  date: string;
  options: LaunchOptions;
  browserConfig: BrowserConfigOptions;
}

// ============================================================================
// HAR Types
// ============================================================================

/**
 * HAR entry with extended timing data
 */
export interface HarEntry {
  request: {
    url: string;
    method: string;
  };
  response: {
    status: number;
    _transferSize?: number;
    content: {
      size: number;
      mimeType: string;
    };
  };
  time: number;
  startedDateTime: string;
  timings?: Record<string, number>;
  _dns_start?: number;
  _dns_end?: number;
  _connect_start?: number;
  _connect_end?: number;
  _secure_start?: number;
  _secure_end?: number;
  _request_start?: number;
  _request_end?: number;
  _response_start?: number;
  _response_end?: number;
  _is_lcp?: boolean;
}

/**
 * HAR page timings
 */
export interface HarPageTimings {
  _TTFB?: number;
  _LCP?: number;
}

/**
 * HAR page
 */
export interface HarPage {
  pageTimings: HarPageTimings;
}

/**
 * HAR log
 */
export interface HarLog {
  pages: HarPage[];
  entries: HarEntry[];
  browser: {
    name: string;
    version: string;
  };
}

/**
 * HAR file data
 */
export interface HarData {
  log: HarLog;
}

// ============================================================================
// Window Extensions (for page.evaluate)
// ============================================================================

/**
 * Window extensions for metrics collection
 */
declare global {
  interface Window {
    layoutShifts?: LayoutShift[];
    navTimings?: NavigationTiming[];
    lcpEvents?: LCPEvent[];
  }
}

// ============================================================================
// CLI Options (raw from Commander.js)
// ============================================================================

/**
 * Raw CLI options from Commander.js (all strings)
 */
export interface CLIOptions {
  url: string;
  browser?: string;
  headers?: string;
  cookies?: string;
  flags?: string;
  blockDomains?: string[];
  block?: string[];
  firefoxPrefs?: string;
  cpuThrottle?: string;
  connectionType?: string;
  width?: string;
  height?: string;
  frameRate?: string | number;
  disableJS?: boolean;
  debug?: boolean;
  auth?: string;
  timeout?: string | number;
  html?: boolean;
  openHtml?: boolean;
  list?: boolean;
  overrideHost?: string;
  zip?: boolean;
  dry?: boolean;
}
