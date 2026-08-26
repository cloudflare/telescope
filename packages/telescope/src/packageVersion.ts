import { readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/**
 * Reads Telescope's version from its nearest package manifest.
 * @returns The package version.
 * @throws If the Telescope package manifest cannot be found.
 */
export function getPackageVersion(): string {
  let directory = path.dirname(url.fileURLToPath(import.meta.url));

  while (true) {
    const candidate = path.join(directory, 'package.json');
    try {
      const packageJson = JSON.parse(readFileSync(candidate, 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (packageJson.name === '@cloudflare/telescope' && packageJson.version) {
        return packageJson.version;
      }
    } catch {
      // The package manifest may be higher in the directory tree.
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      throw new Error(
        'Unable to locate @cloudflare/telescope package.json to read version',
      );
    }
    directory = parent;
  }
}
