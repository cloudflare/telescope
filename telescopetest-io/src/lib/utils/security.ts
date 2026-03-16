import path from 'node:path';

// Allowed file extensions for Telescope test results. Could be expanded later for a manifest? 
export const ALLOWED_EXTENSIONS = new Set([
  'json',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'webm',
  'gif',
  'har',
  'txt',
]);

// Validate filename doesn't attempt path traversal (allows single-level folders like "filmstrip/frame.jpg")
export function isPathSafe(filename: string): boolean {
  if (!filename || filename.trim() === '') return false;
  if (filename.startsWith('/')) return false;
  if (filename.includes('\\')) return false;
  if (/%2e|%2f|%5c/i.test(filename)) return false;
  const normalized = path.normalize(filename);
  if (normalized.startsWith('..')) return false;
  if (normalized.includes('..')) return false;
  return true;
}

// Validate testId format: YYYY_MM_DD_HH_MM_SS_UUID
export function isValidTestId(testId: string): boolean {
  const testIdPattern =
    /^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  return testIdPattern.test(testId);
}


// Check if filename has an allowed extension
export function hasAllowedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext !== undefined && ALLOWED_EXTENSIONS.has(ext);
}

// Check if filename matches expected Telescope output patterns
// Expected: config.json, metrics.json, screenshot.png, pageload.har, resources.json, console.json, filmstrip/*.{png,jpg,jpeg,webp}, *.txt
export function isExpectedTelescopeFile(filename: string): boolean {
  const normalized = filename.toLowerCase();
  if (
    normalized === 'config.json' ||
    normalized === 'metrics.json' ||
    normalized === 'resources.json' ||
    normalized === 'console.json'
  ) {
    return true;
  }
  if (normalized === 'pageload.har') {
    return true;
  }
  if (normalized === 'screenshot.png') {
    return true;
  }
  if (normalized.startsWith('filmstrip/')) {
    const parts = normalized.split('/');
    if (parts.length === 2) {
      const ext = parts[1].split('.').pop();
      return ext !== undefined && ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    }
  }
  if (!normalized.includes('/') && normalized.endsWith('.txt')) {
    return true;
  }
  return false;
}

// Filter files to only include valid Telescope output files
export function filterValidFiles(filenames: string[]): {
  validFiles: string[];
  droppedByExtension: number;
  droppedByPath: number;
  droppedByPattern: number;
} {
  const validFiles: string[] = [];
  let droppedByExtension = 0;
  let droppedByPath = 0;
  let droppedByPattern = 0;
  for (const filename of filenames) {
    if (!hasAllowedExtension(filename)) {
      droppedByExtension++;
      continue;
    }
    if (!isPathSafe(filename)) {
      droppedByPath++;
      continue;
    }
    if (!isExpectedTelescopeFile(filename)) {
      droppedByPattern++;
      continue;
    }
    validFiles.push(filename);
  }
  return {
    validFiles,
    droppedByExtension,
    droppedByPath,
    droppedByPattern,
  };
}
