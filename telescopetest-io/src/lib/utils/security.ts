import path from 'node:path';
import type { Unzipped } from 'fflate';

// Expected Telescope output files
// Could be expanded/formalized into actual manifest
export const EXPECTED_TELESCOPE_FILES = new Set([
  'config.json',
  'metrics.json',
  'resources.json',
  'console.json',
  'pageload.har',
  'screenshot.png',
]);

// Validate testId format: YYYY_MM_DD_HH_MM_SS_UUID
export function isValidTestId(testId: string): boolean {
  const testIdPattern =
    /^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  return testIdPattern.test(testId);
}

// Check if filename matches expected Telescope output patterns
// Expected: config.json, metrics.json, screenshot.png, pageload.har, resources.json, console.json, *.webm, filmstrip/*.jpg
export function isExpectedTelescopeFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (EXPECTED_TELESCOPE_FILES.has(lower)) {
    return true;
  }
  const dir = path.dirname(lower);
  if (dir === '.' && lower.endsWith('.webm')) {
    return true;
  }
  if (dir === 'filmstrip' && lower.endsWith('.jpg')) {
    return true;
  }
  return false;
}

// Normalize ZIP file paths by stripping prefix, then filter to only valid, secure Telescope output files
export function normalizeAndFilterZipFiles(
  unzipped: Unzipped,
  prefixToStrip: string,
): Unzipped {
  return Object.entries(unzipped)
    .filter(([originalFilePath]) => originalFilePath.startsWith(prefixToStrip))
    .map(
      ([originalFilePath, contents]) =>
        [
          path.normalize(originalFilePath.slice(prefixToStrip.length)),
          contents,
        ] as const,
    )
    .filter(([normalizedFilePath]) =>
      isExpectedTelescopeFile(normalizedFilePath),
    )
    .reduce((acc, [normalizedFilePath, contents]) => {
      acc[normalizedFilePath] = contents;
      return acc;
    }, {} as Unzipped);
}
