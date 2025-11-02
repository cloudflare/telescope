/**
 * Normalize options from any source (CLI or programmatic).
 * Converts types, parses JSON strings, and applies defaults.
 *
 * @param {Object} options - Test options (raw from CLI or programmatic)
 * @returns {Object} Normalized config object
 */
export function normalizeConfig(options) {
  const config = {
    url: options.url,
    browser: options.browser || 'chrome',
    width: parseInt(options.width) || 1366,
    height: parseInt(options.height) || 768,
    frameRate: parseInt(options.frameRate) || 1,
    timeout: parseInt(options.timeout) || 30000,
    blockDomains: options.blockDomains || [],
    block: options.block || [],
    disableJS: options.disableJS || false,
    debug: options.debug || false,
    html: options.html || false,
    list: options.list || false,
    connectionType: options.connectionType || false,
    auth: options.auth || false,
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

  if (options.auth && typeof options.auth === 'string') {
    config.auth = JSON.parse(options.auth);
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
