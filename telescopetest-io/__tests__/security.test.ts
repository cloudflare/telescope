import { describe, expect, test } from 'vitest';
import type { Unzipped } from 'fflate';

import { normalizeAndFilterZipFiles } from '@/lib/utils/security';
import { generateTestId } from '@/lib/utils/test-id';

// Helpers
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('normalizeAndFilterZipFiles', () => {
  describe('unix-style paths', () => {
    test('strips the prefix and keeps expected files', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: enc('{}'),
        [`${testId}/metrics.json`]: enc('{}'),
        [`${testId}/screenshot.png`]: enc('png'),
        [`${testId}/pageload.har`]: enc('har'),
        [`${testId}/resources.json`]: enc('{}'),
        [`${testId}/console.json`]: enc('{}'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}/`);

      expect(Object.keys(result).sort()).toEqual([
        'config.json',
        'console.json',
        'metrics.json',
        'pageload.har',
        'resources.json',
        'screenshot.png',
      ]);
    });

    test('keeps webm video files at root level', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: enc('{}'),
        [`${testId}/recording.webm`]: enc('webm'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}/`);

      expect(Object.keys(result)).toContain('recording.webm');
    });

    test('keeps filmstrip jpg files', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: enc('{}'),
        [`${testId}/filmstrip/frame001.jpg`]: enc('jpg'),
        [`${testId}/filmstrip/frame002.jpg`]: enc('jpg'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}/`);

      expect(Object.keys(result)).toContain('filmstrip/frame001.jpg');
      expect(Object.keys(result)).toContain('filmstrip/frame002.jpg');
    });

    test('silently drops unexpected files', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: enc('{}'),
        [`${testId}/index.html`]: enc('<html>'),
        [`${testId}/secret.txt`]: enc('secret'),
        [`${testId}/malware.exe`]: enc('exe'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}/`);

      expect(Object.keys(result)).toEqual(['config.json']);
      expect(Object.keys(result)).not.toContain('index.html');
      expect(Object.keys(result)).not.toContain('secret.txt');
      expect(Object.keys(result)).not.toContain('malware.exe');
    });

    test('excludes files that do not start with the given prefix', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const otherId = generateTestId('2024-06-01T00:00:00Z');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: enc('{}'),
        [`${otherId}/config.json`]: enc('{}'),
        'config.json': enc('{}'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}/`);

      expect(Object.keys(result)).toEqual(['config.json']);
    });

    test('preserves file contents after normalization', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const content = enc('{"url":"https://example.com"}');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: content,
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}/`);

      expect(result['config.json']).toBe(content);
    });

    test('works with an empty prefix (no directory nesting)', () => {
      const unzipped: Unzipped = {
        'config.json': enc('{}'),
        'metrics.json': enc('{}'),
        'index.html': enc('<html>'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, '');

      expect(Object.keys(result).sort()).toEqual([
        'config.json',
        'metrics.json',
      ]);
    });

    test('files at zip root with filmstrip subfolder and no parent testId folder', () => {
      // Mirrors the real upload.ts logic: when config.json is at the root,
      // path.dirname returns '.', so prefixToStrip is set to ''.
      const unzipped: Unzipped = {
        'config.json': enc('{}'),
        'metrics.json': enc('{}'),
        'screenshot.png': enc('png'),
        'pageload.har': enc('har'),
        'resources.json': enc('{}'),
        'console.json': enc('{}'),
        'recording.webm': enc('webm'),
        'filmstrip/frame001.jpg': enc('jpg'),
        'filmstrip/frame002.jpg': enc('jpg'),
        'index.html': enc('<html>'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, '');

      expect(Object.keys(result).sort()).toEqual([
        'config.json',
        'console.json',
        'filmstrip/frame001.jpg',
        'filmstrip/frame002.jpg',
        'metrics.json',
        'pageload.har',
        'recording.webm',
        'resources.json',
        'screenshot.png',
      ]);
      expect(Object.keys(result)).not.toContain('index.html');
    });
  });

  describe('windows-style paths', () => {
    test('strips the prefix and normalizes backslash separators', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}\\config.json`]: enc('{}'),
        [`${testId}\\metrics.json`]: enc('{}'),
        [`${testId}\\screenshot.png`]: enc('png'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}\\`);

      // path.normalize on the current (posix) platform won't convert backslashes,
      // but on Windows it would — the test asserts the function handles the prefix
      // stripping correctly regardless of separator style in the input object keys.
      const keys = Object.keys(result);
      // At least the prefix-stripped, allowlisted files survive
      expect(keys.length).toBeGreaterThan(0);
      // None of the surviving keys should still carry the testId\ prefix
      keys.forEach(k => expect(k.startsWith(`${testId}\\`)).toBe(false));
    });

    test('drops unexpected files from windows-style paths', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}\\config.json`]: enc('{}'),
        [`${testId}\\index.html`]: enc('<html>'),
        [`${testId}\\malware.exe`]: enc('exe'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}\\`);

      const keys = Object.keys(result);
      const hasIndexHtml = keys.some(k => k.includes('index.html'));
      const hasMalware = keys.some(k => k.includes('malware.exe'));
      expect(hasIndexHtml).toBe(false);
      expect(hasMalware).toBe(false);
    });

    test('filmstrip paths with backslash separators survive filtering', () => {
      // On Windows, ZIP entries may use backslashes for subdirectory separators.
      // path.normalize should convert backslashes to forward slashes so that
      // isExpectedTelescopeFile() can match the 'filmstrip/*.jpg' rule.
      // This test will FAIL on POSIX because path.normalize does not convert
      // backslashes there — exposing a real portability bug in the code.
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}\\config.json`]: enc('{}'),
        [`${testId}\\filmstrip\\frame001.jpg`]: enc('jpg'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, `${testId}\\`);

      const keys = Object.keys(result);
      const hasFilmstrip = keys.some(k => k.includes('frame001.jpg'));
      expect(hasFilmstrip).toBe(true);
    });

    test('files at zip root with filmstrip subfolder using backslash separators and no parent testId folder', () => {
      // Same scenario as the POSIX test above but with Windows-style backslash
      // separators in the ZIP entry keys and an empty prefix.
      // The filmstrip entry uses a backslash separator: 'filmstrip\frame001.jpg'.
      // On POSIX, path.normalize does NOT convert that backslash, so
      // path.dirname returns '.' instead of 'filmstrip' and the entry is dropped
      // by isExpectedTelescopeFile — exposing the same portability bug as the
      // nested-folder filmstrip test above.
      const unzipped: Unzipped = {
        'config.json': enc('{}'),
        'metrics.json': enc('{}'),
        'screenshot.png': enc('png'),
        'pageload.har': enc('har'),
        'resources.json': enc('{}'),
        'console.json': enc('{}'),
        'recording.webm': enc('webm'),
        'filmstrip\\frame001.jpg': enc('jpg'),
        'filmstrip\\frame002.jpg': enc('jpg'),
        'index.html': enc('<html>'),
      };

      const result = normalizeAndFilterZipFiles(unzipped, '');

      expect(Object.keys(result)).toContain('filmstrip/frame001.jpg');
      expect(Object.keys(result)).toContain('filmstrip/frame002.jpg');
      expect(Object.keys(result)).not.toContain('index.html');
    });

    test('excludes files whose prefix uses forward slashes when backslash prefix is given', () => {
      const testId = generateTestId('2024-01-15T10:30:00Z');
      const unzipped: Unzipped = {
        [`${testId}/config.json`]: enc('{}'), // forward-slash key
        [`${testId}\\config.json`]: enc('{}'), // backslash key
      };

      // Only the backslash-prefixed entry should match
      const result = normalizeAndFilterZipFiles(unzipped, `${testId}\\`);

      // Exactly one config.json survives
      const configEntries = Object.keys(result).filter(k =>
        k.endsWith('config.json'),
      );
      expect(configEntries).toHaveLength(1);
    });
  });
});
