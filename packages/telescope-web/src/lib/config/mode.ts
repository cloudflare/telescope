/**
 * Runtime mode detection for telescope-web.
 *
 * Mode is selected via the `TELESCOPE_MODE` environment variable:
 *   - `cloudflare` (default): uses D1, R2, and Workers AI bindings
 *   - `local`: reads/writes from a local results directory on disk
 */

export type TelescopeMode = 'cloudflare' | 'local';

/**
 * Returns the current runtime mode. Defaults to `cloudflare` for
 * backward compatibility with the existing deployment.
 */
export function getMode(): TelescopeMode {
  // Astro exposes server env vars on import.meta.env in SSR.
  // Fall back to process.env for plain Node contexts (tests, scripts).
  const fromImport =
    typeof import.meta !== 'undefined' &&
    (import.meta.env?.TELESCOPE_MODE as string | undefined);
  const fromProcess =
    typeof process !== 'undefined'
      ? (process.env?.TELESCOPE_MODE as string | undefined)
      : undefined;
  const raw = fromImport || fromProcess;
  return raw === 'local' ? 'local' : 'cloudflare';
}

export function isLocalMode(): boolean {
  return getMode() === 'local';
}

export function isCloudflareMode(): boolean {
  return getMode() === 'cloudflare';
}

/**
 * Local results directory. Only used in local mode.
 * Defaults to `./results` relative to the process cwd.
 */
export function getResultsDir(): string {
  const fromImport =
    typeof import.meta !== 'undefined' &&
    (import.meta.env?.RESULTS_DIR as string | undefined);
  const fromProcess =
    typeof process !== 'undefined'
      ? (process.env?.RESULTS_DIR as string | undefined)
      : undefined;
  return fromImport || fromProcess || './results';
}
