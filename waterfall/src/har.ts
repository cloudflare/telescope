/**
 * HAR (HTTP Archive) types based on HAR 1.2 spec
 * https://w3c.github.io/web-performance/specs/HAR/Overview.html
 */

export interface HarTimings {
  /** Time spent in a queue waiting for a network connection (-1 if not applicable) */
  blocked?: number;
  /** DNS resolution time (-1 if not applicable) */
  dns: number;
  /** Time to create TCP connection (-1 if not applicable) */
  connect: number;
  /** SSL/TLS handshake time (-1 if not applicable) */
  ssl?: number;
  /** Time from connection established to first byte of request sent */
  send: number;
  /** Time from request sent to first byte of response received (TTFB) */
  wait: number;
  /** Time to receive the response body */
  receive: number;
  /** Total time (ms) — may be omitted, derived from sum of above */
  _blocked_queueing?: number;
}

export interface HarContent {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  headers: HarHeader[];
  cookies: HarCookie[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  _transferSize?: number;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  headers: HarHeader[];
  cookies: HarCookie[];
  queryString: HarQueryParam[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
}

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface HarQueryParam {
  name: string;
  value: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
  params?: Array<{ name: string; value?: string }>;
}

export interface HarEntry {
  /** ISO 8601 datetime of request start */
  startedDateTime: string;
  /** Total elapsed time (ms) */
  time: number;
  request: HarRequest;
  response: HarResponse;
  timings: HarTimings;
  /** Server IP address */
  serverIPAddress?: string;
  /** Connection ID */
  connection?: string;
  /** Playwright/Chrome extension fields */
  _initiator?: {
    type: string;
    url?: string;
    lineNumber?: number;
  };
  _priority?: string;
  _resourceType?: string;
}

export interface HarBrowser {
  name: string;
  version: string;
}

export interface HarPage {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: {
    onContentLoad?: number;
    onLoad?: number;
    /** Largest Contentful Paint (ms) — non-standard, stored as _lcp */
    _lcp?: number;
  };
}

export interface HarLog {
  version: string;
  creator: { name: string; version: string };
  browser?: HarBrowser;
  pages?: HarPage[];
  entries: HarEntry[];
}

export interface Har {
  log: HarLog;
}
