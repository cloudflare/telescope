import { z } from 'zod';

export const CookieSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    domain: z.string().optional(),
    path: z.string().optional(),
    expires: z.number().optional(),
    httpOnly: z.boolean().optional(),
    secure: z.boolean().optional(),
    sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    url: z.string().optional(),
  })
  .passthrough();

export const CookiesSchema = z.union([z.array(CookieSchema), CookieSchema]);

export const HeadersSchema = z.record(z.string(), z.string());

export const AuthSchema = z.object({
  username: z.string(),
  password: z.string(),
  origin: z.string().optional(),
  send: z.enum(['unauthorized', 'always']).optional(),
});

export const FirefoxPrefsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
);

export const OverrideHostSchema = z.record(z.string(), z.string());

export const DelaySchema = z.record(z.string(), z.number());

export const StringArraySchema = z.array(z.string());

export const PositiveIntSchema = z.coerce.number().int().positive();
export const PositiveFloatSchema = z.coerce.number().positive();

const CustomDeviceSchema = z.object({
  defaultBrowserType: z.enum(['chromium', 'firefox', 'webkit']),
  deviceScaleFactor: z.number(),
  hasTouch: z.boolean(),
  isMobile: z.boolean(),
  userAgent: z.string(),
  viewport: z.object({
    height: z.number(),
    width: z.number()
  })
});

export const ConfigCLIOptionsSchema = z.object({
  auth: AuthSchema.or(z.boolean()).optional(),
  agentExtra: z.string().optional(),
  block: z.array(z.string()).optional(),
  blockDomains: z.array(z.string()).optional(),
  browser: z.enum(['chrome','chrome-beta', 'canary', 'firefox', 'safari', 'edge']).optional(),
  connectionType: z.enum(['3g', '3gfast', '3gslow', '2g', 'cable', 'dsl', '4g', 'fios']).or(z.boolean()).optional(),
  cookies: z.array(CookieSchema).optional(),
  cpuThrottle: z.coerce.number().optional(),
  debug: z.coerce.boolean().optional(),
  delay: z.record(z.string(), z.coerce.number()).optional(),
  delayUsing: z.enum(['fulfill', 'continue']).optional(),
  device: CustomDeviceSchema.optional(),
  disableJS: z.coerce.boolean().optional(),
  firefoxPrefs: z.record(z.string(), z.string().or(z.coerce.number()).or(z.coerce.boolean())).optional(),
  frameRate: z.coerce.number().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  height: z.coerce.number().optional(),
  html: z.coerce.boolean().optional(),
  list: z.coerce.boolean().optional(),
  openHtml: z.coerce.boolean().optional(),
  overrideHost: z.record(z.string(), z.string()).optional(),
  timeout: z.coerce.number().optional(),
  uploadUrl: z.string().url().or(z.null()).optional(),
  userAgent: z.string().optional(),
  width: z.coerce.number().optional(),
  zip: z.coerce.boolean().optional()
});

export const BrowserConfigSchema = z.object({
  args: z.array(z.string()).optional(),
  channel: z.enum(['chrome', 'chrome-beta', 'chrome-canary', 'msedge']).optional(),
  engine: z.enum(['chromium', 'webkit', 'firefox']),
  firefoxUserPrefs: z.record(z.string(), z.string().or(z.coerce.number()).or(z.boolean())).optional(),
  headless: z.coerce.boolean().optional(),
  httpCredentials: AuthSchema.optional(),
  javaScriptEnabled: z.coerce.boolean().optional(),
  viewport: z.object({
    height: z.coerce.number(),
    width: z.coerce.number()
  }).optional()
});

/**
 * Schema for an input config file
 **/

export const ConfigFileSchema = z.object({
  url: z.string().url().optional(),
  options: ConfigCLIOptionsSchema.optional(),
  browserConfig: BrowserConfigSchema.optional(),
});
