import { access, constants, readFileSync, stat } from 'node:fs';

import type {
  BrowserConfigType,
  LaunchOptions,
  CLIOptions,
  ConfigCLIOptionsType,
  ConfigFileType,
  ConnectionType,
  BrowserName,
  CustomDeviceDescriptor,
  PlaywrightEngine,
} from './types.js';
import { parseUnknown } from './validation.js';
import { ConfigCLIOptionsSchema, ConfigFileSchema, StringArraySchema } from './schemas.js';

import { DEFAULT_OPTIONS } from './defaultOptions.js';
import { devices } from 'playwright';

/**
 * Maps a Playwright engine name to the corresponding Telescope BrowserName.
 * Used to derive a default browser from a device's defaultBrowserType.
 */
const ENGINE_TO_BROWSER_NAME: Record<PlaywrightEngine, BrowserName> = {
  chromium: 'chrome',
  firefox: 'firefox',
  webkit: 'safari',
};

/**
 * Normalize CLI options into a typed LaunchOptions config.
 * Applies defaults and maps CLI field names to internal config fields.
 *
 * This function is not part of the public API -- only browserAgent() calls it,
 * and the programmatic API (launchTest, Telescope) takes LaunchOptions directly.
 * Since the only caller is the CLI path, inputs are already validated by
 * Commander's argParser callbacks before they reach here.
 *
 * The caller (browserAgent) is responsible for resolving the URL from either
 * the positional argument or the `--url` flag and must ensure `options.url` is
 * set before calling this function. We assert that contract here.
 *
 * @param options - CLI options (typed fields already validated by Commander)
 * @returns Normalized config object with correct types and defaults applied
 * @throws If `options.url` is not set (programmer error: caller broke contract)
 */
export function normalizeCLIConfig(options: CLIOptions): LaunchOptions {
  const config: LaunchOptions = {
    url: options.url || "", // Might come from config file
    browser: options.browser as BrowserName | undefined,
    width: options.width,
    height: options.height,
    frameRate: options.frameRate,
    timeout: options.timeout,
    blockDomains: options.blockDomains,
    block: options.block,
    disableJS: options.disableJS,
    debug: options.debug,
    html: options.html,
    openHtml: options.openHtml,
    list: options.list,
    connectionType: options.connectionType as ConnectionType,
    auth: DEFAULT_OPTIONS.auth,
    zip: options.zip,
    dry: options.dry,
    delayUsing: DEFAULT_OPTIONS.delayUsing,
    userAgent: options.userAgent,
    agentExtra: options.agentExtra,
  };

  // Already-parsed JSON options: pass through directly
  if (options.cookies) {
    config.cookies = options.cookies;
  }

  if (options.headers) {
    config.headers = options.headers;
  }

  if (options.auth) {
    config.auth = options.auth;
  }

  if (options.delay) {
    config.delay = options.delay;
  }

  if (options.delayUsing) {
    config.delayUsing = options.delayUsing;
  }

  if (options.firefoxPrefs) {
    config.firefoxPrefs = options.firefoxPrefs;
  }

  if (options.overrideHost) {
    config.overrideHost = options.overrideHost;
  }

  // flags already parsed to string[] by argParser
  if (options.flags) {
    config.args = options.flags;
  }

  // cpuThrottle already parsed to number by argParser
  if (options.cpuThrottle) {
    config.cpuThrottle = options.cpuThrottle;
  }

  if (options.block) {
    try {
      config.block = parseJSONArrayOrCommaSeparatedStrings(
        '--block',
        options.block,
      );
    } catch (err) {
      throw new Error(
        `Problem parsing "--block" options - ${(err as Error).message}`,
      );
    }
  }

  if (options.blockDomains) {
    try {
      config.blockDomains = parseJSONArrayOrCommaSeparatedStrings(
        '--blockDomains',
        options.blockDomains,
      );
    } catch (err) {
      throw new Error(
        `Problem parsing "--blockDomains" options - ${(err as Error).message}`,
      );
    }
  }

  // Validate uploadUrl if provided
  if (options.uploadUrl) {
    try {
      new URL(options.uploadUrl);
    } catch (_err) {
      throw new Error(`--uploadUrl must be a valid URL`);
    }
    config.uploadUrl = options.uploadUrl;
  }
  // Handle device emulation
  // the 'device' in options is the name of the device to emulate provided by the user
  if (options.device) {
    const playwrightDevice =
      devices[options.device as keyof typeof devices];
    if (!playwrightDevice) {
      throw new Error(
        `Device "${options.device}" not found in Playwright device list`,
      );
    }
    // the 'device' in config is the playwright object with device metadata
    config.device = playwrightDevice as CustomDeviceDescriptor;
  }

  // resolve browser: device default first, explicit -b overrides, then fallback
  if (config.device) {
    config.browser = ENGINE_TO_BROWSER_NAME[config.device.defaultBrowserType];
  }

  if (options.browser) {
    config.browser = options.browser as BrowserName;
  }

  if (options.config) {
    config.config = options.config;
  }

  return config;
}

/**
 * Get the base configuration from a file.
 *
 * @param configFileName - Name and path to configuration file
 * @return configuration object to be used by executeTest
 */

export function getBaseConfig(configFileName: string): LaunchOptions {
  let baseConfig: ConfigFileType = { };

  access(configFileName, constants.R_OK, (err) => {
    if (err) {
      throw new Error(`Can not read file ${configFileName}`);
    }
  });

  stat(configFileName, (err, cfgStat) => {
    if (err) {
      throw err;
    }

    if (cfgStat.size > 4096) { // Arbitrary size
      throw new Error(`Config file ${configFileName} is suspect - oversized.`);
    }
  });

  try {
    const cfgData = readFileSync(configFileName, "utf-8");
    const cfgObject = JSON.parse(cfgData);
    baseConfig = ConfigFileSchema.parse(cfgObject);
  } catch (err) {
    console.error(err);
    throw new Error(`Problem parsing ${configFileName}`);
  }

  let cfg: LaunchOptions = { url: baseConfig.url || '' }; // Always required

  if (baseConfig.options) {
    type CommonCLIKeys = Extract<keyof ConfigCLIOptionsType, keyof LaunchOptions>;

    for (const key of Object.keys(ConfigCLIOptionsSchema.shape) as CommonCLIKeys[]) {
      const value = baseConfig.options[key];
      if (value !== undefined) {
        // Safe because of the Extract above
        cfg[key] = value as any; // eslint-disable-line
      }
    }
  }

  if (baseConfig.browserConfig) {
    extractBrowserConfig(cfg, baseConfig.browserConfig);
  }

  return cfg;
}

/**
 * Extract the useful settings from the configuration file browserConfig section
 * @params cfg - The configuration object
 *         browserConfig - the browserConfig object from the configuration file
 * @returns Updated cfg
 */

function extractBrowserConfig(cfg: LaunchOptions, browserConfig: BrowserConfigType) {
  if (browserConfig.args && Array.isArray(browserConfig.args)) {
    cfg.args = browserConfig.args;
  }

  const engine = browserConfig.engine; // Required

  if (engine === 'firefox') {
    cfg.browser = 'firefox';
    if (browserConfig.firefoxUserPrefs) {
      cfg.firefoxPrefs = browserConfig.firefoxUserPrefs;
    }
  } else if (engine === 'webkit') {
    cfg.browser = 'safari';
  } else { // chromium
    const channel = browserConfig.channel;
    if (channel === 'chrome') {
      cfg.browser = 'chrome';
    } else if (channel === 'chrome-beta') {
      cfg.browser = 'chrome-beta';
    } else if (channel === 'chrome-canary') {
      cfg.browser = 'canary';
    } else if (channel === 'msedge') {
      cfg.browser = 'edge';
    }
  }

  if (browserConfig.httpCredentials) {
    cfg.auth = browserConfig.httpCredentials;
  }

  if (browserConfig.javaScriptEnabled !== undefined) {
    cfg.disableJS = !browserConfig.javaScriptEnabled;
  }

  // Overrides options.height/width
  if (browserConfig.viewport) {
    cfg.height = browserConfig.viewport.height;
    cfg.width = browserConfig.viewport.width;
  }

  return cfg;
}

/**
 * Parse the command line parameters options whether they be a JSON array or
 * comma separated strings.
 *
 * @param flagName - The CLI flag name (for error messages)
 * @param choices - List of options to a command line parameter
 * @returns The parsed list of options
 */
function parseJSONArrayOrCommaSeparatedStrings(
  flagName: string,
  choices: string[],
): string[] {
  const chosen: string[] = [];

  choices.forEach(opt_group => {
    if (opt_group.includes('[')) {
      // Looks like a JSON array
      const parsed: unknown = JSON.parse(opt_group);
      chosen.push(...parseUnknown(flagName, parsed, StringArraySchema));
    } else {
      opt_group.split(/,/).forEach(opt => {
        if (opt) {
          chosen.push(opt);
        }
      });
    }
  });

  return chosen;
}
