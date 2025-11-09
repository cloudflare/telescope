import { DEFAULT_OPTIONS } from './defaultOptions.js';

/**
 * Normalize options from any source (CLI or programmatic).
 * Converts types, parses JSON strings, and applies defaults.
 * Handles both CLI string inputs and programmatic object inputs.
 *
 * @param {Object} options - Test options (raw from CLI or programmatic)
 * @returns {Object} Normalized config object with correct types and defaults applied
 */
export function normalizeConfig(options) {
  const config = {
    url: options.url,
    browser: options.browser || DEFAULT_OPTIONS.browser,
    width: parseInt(options.width) || DEFAULT_OPTIONS.width,
    height: parseInt(options.height) || DEFAULT_OPTIONS.height,
    frameRate: parseInt(options.frameRate) || DEFAULT_OPTIONS.frameRate,
    timeout: parseInt(options.timeout) || DEFAULT_OPTIONS.timeout,
    blockDomains: options.blockDomains || DEFAULT_OPTIONS.blockDomains,
    block: options.block || DEFAULT_OPTIONS.block,
    disableJS: options.disableJS || DEFAULT_OPTIONS.disableJS,
    debug: options.debug || DEFAULT_OPTIONS.debug,
    html: options.html || DEFAULT_OPTIONS.html,
    list: options.list || DEFAULT_OPTIONS.list,
    connectionType: options.connectionType || DEFAULT_OPTIONS.connectionType,
    auth: options.auth || DEFAULT_OPTIONS.auth,
  };

  // Parse JSON strings from CLI (pass through objects from programmatic)
  if (options.cookies) {
    config.cookies =
      typeof options.cookies === 'string'
        ? JSON.parse(options.cookies)
        : options.cookies;
  }

  if (options.headers) {
    config.headers =
      typeof options.headers === 'string'
        ? JSON.parse(options.headers)
        : options.headers;
  }

  if (options.auth) {
    config.auth =
      typeof options.auth === 'string'
        ? JSON.parse(options.auth)
        : options.auth;
  }

  if (options.firefoxPrefs) {
    config.firefoxPrefs =
      typeof options.firefoxPrefs === 'string'
        ? JSON.parse(options.firefoxPrefs)
        : options.firefoxPrefs;
  }

  // Convert flags string to array
  if (options.flags) {
    config.args =
      typeof options.flags === 'string'
        ? options.flags.split(',')
        : options.flags;
  }

  // Handle cpuThrottle
  if (options.cpuThrottle) {
    config.cpuThrottle = parseInt(options.cpuThrottle);
  }

  return config;
}
