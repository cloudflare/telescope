import type { DefaultOptions } from './types.js';

/**
 * Default values for all test options.
 * Used by both CLI (Commander.js) and programmatic API (normalizeConfig).
 * Single source of truth prevents defaults from drifting between interfaces.
 */
export const DEFAULT_OPTIONS: DefaultOptions = {
  // Browser engine to use for testing
  browser: 'chrome',
  // Viewport width and height in pixels
  width: 1366,
  height: 768,
  // Filmstrip capture rate (frames per second)
  frameRate: 1,
  // Test timeout in milliseconds
  timeout: 30000,
  // Domains to block from loading (request blocking)
  blockDomains: [],
  // URL substrings to block (request blocking)
  block: [],
  // Disable JavaScript execution
  disableJS: false,
  // Enable debug logging
  debug: false,
  // Generate HTML report
  html: false,
  // Open HTML report in browser
  openHtml: false,
  // Generate list of results in HTML
  list: false,
  // Hosts to override
  overrideHost: {},
  // Network throttling type (false = no throttling)
  connectionType: false,
  // HTTP basic auth credentials (false = no auth)
  auth: false,
  // Compress output to zip file (false = no zip)
  zip: false,
  // Dry run (false = no dry run)
  dry: false,
};
