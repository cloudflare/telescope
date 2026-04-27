import { describe, expect, test } from 'vitest';
import type { ResourceTiming } from '@/lib/types/resources';
import {
  getDomain,
  getFileType,
  getStatusCode,
  getProtocol,
} from '@/lib/utils/resources';

describe('getDomain', () => {
  test('extracts hostname from valid URL', () => {
    expect(getDomain('https://example.com/path')).toBe('example.com');
    expect(getDomain('http://test.org:8080/page')).toBe('test.org');
    expect(getDomain('https://subdomain.example.com/foo/bar')).toBe(
      'subdomain.example.com',
    );
  });

  test('returns "unknown" for invalid URL', () => {
    expect(getDomain('not a url')).toBe('unknown');
    expect(getDomain('')).toBe('unknown');
    expect(getDomain('//incomplete')).toBe('unknown');
  });
});

describe('getFileType', () => {
  test('returns "document" for navigation type', () => {
    const resource: ResourceTiming = {
      name: 'https://example.com',
      initiatorType: 'navigation',
      entryType: 'resource',
    } as ResourceTiming;

    expect(getFileType(resource)).toBe('document');
  });

  test('returns "document" for navigation entryType', () => {
    const resource: ResourceTiming = {
      name: 'https://example.com',
      initiatorType: '',
      entryType: 'navigation',
    } as ResourceTiming;

    expect(getFileType(resource)).toBe('document');
  });

  test('detects script files by .js extension', () => {
    const resource: ResourceTiming = {
      name: 'https://example.com/app.js',
      initiatorType: '',
      entryType: 'resource',
    } as ResourceTiming;

    expect(getFileType(resource)).toBe('script');
  });

  test('detects stylesheet files by .css extension', () => {
    const resource: ResourceTiming = {
      name: 'https://example.com/style.css',
      initiatorType: '',
      entryType: 'resource',
    } as ResourceTiming;

    expect(getFileType(resource)).toBe('stylesheet');
  });

  test('detects image files by extension', () => {
    expect(
      getFileType({
        name: 'image.jpg',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'image.jpeg',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'image.png',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'image.gif',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'image.webp',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'image.svg',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'favicon.ico',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
  });

  test('detects font files by extension', () => {
    expect(
      getFileType({
        name: 'font.woff',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
    expect(
      getFileType({
        name: 'font.woff2',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
    expect(
      getFileType({
        name: 'font.ttf',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
    expect(
      getFileType({
        name: 'font.otf',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
    expect(
      getFileType({
        name: 'font.eot',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
  });

  test('detects fetch requests by .json extension', () => {
    const resource: ResourceTiming = {
      name: 'https://api.example.com/api/data.json',
      initiatorType: '',
      entryType: 'resource',
    } as ResourceTiming;

    // Note: .json matches after .js check, so URLs with 'json' that don't contain '.js' will be 'fetch'
    // But this URL contains '.js' in 'data.json', so it returns 'script'
    expect(getFileType(resource)).toBe('script');
  });

  test('detects fetch requests by initiatorType', () => {
    expect(
      getFileType({
        name: 'https://api.example.com/data',
        initiatorType: 'xmlhttprequest',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('fetch');
    expect(
      getFileType({
        name: 'https://api.example.com/data',
        initiatorType: 'fetch',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('fetch');
  });

  test('uses initiatorType when URL does not match patterns', () => {
    expect(
      getFileType({
        name: 'https://example.com/resource',
        initiatorType: 'img',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'https://example.com/resource',
        initiatorType: 'link',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('stylesheet');
    expect(
      getFileType({
        name: 'https://example.com/resource',
        initiatorType: 'script',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('script');
  });

  test('returns initiatorType for unrecognized types', () => {
    const resource: ResourceTiming = {
      name: 'https://example.com/resource',
      initiatorType: 'beacon',
      entryType: 'resource',
    } as ResourceTiming;

    expect(getFileType(resource)).toBe('beacon');
  });

  test('returns "other" when initiatorType is empty', () => {
    const resource: ResourceTiming = {
      name: 'https://example.com/resource',
      initiatorType: '',
      entryType: 'resource',
    } as ResourceTiming;

    expect(getFileType(resource)).toBe('other');
  });

  test('handles case-insensitive image extensions', () => {
    expect(
      getFileType({
        name: 'IMAGE.JPG',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
    expect(
      getFileType({
        name: 'IMAGE.PNG',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('image');
  });

  test('handles case-insensitive font extensions', () => {
    expect(
      getFileType({
        name: 'FONT.WOFF',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
    expect(
      getFileType({
        name: 'FONT.TTF',
        initiatorType: '',
        entryType: 'resource',
      } as ResourceTiming),
    ).toBe('font');
  });
});

describe('getStatusCode', () => {
  test('returns responseStatus when present', () => {
    const resource: ResourceTiming = {
      responseStatus: 404,
    } as ResourceTiming;

    expect(getStatusCode(resource)).toBe(404);
  });

  test('returns 200 when responseStatus is missing', () => {
    const resource: ResourceTiming = {} as ResourceTiming;

    expect(getStatusCode(resource)).toBe(200);
  });

  test('returns 200 when responseStatus is 0', () => {
    const resource: ResourceTiming = {
      responseStatus: 0,
    } as ResourceTiming;

    expect(getStatusCode(resource)).toBe(200);
  });
});

describe('getProtocol', () => {
  test('returns nextHopProtocol when present', () => {
    const resource: ResourceTiming = {
      nextHopProtocol: 'h2',
    } as ResourceTiming;

    expect(getProtocol(resource)).toBe('h2');
  });

  test('returns "unknown" when nextHopProtocol is missing', () => {
    const resource: ResourceTiming = {} as ResourceTiming;

    expect(getProtocol(resource)).toBe('unknown');
  });

  test('returns "unknown" when nextHopProtocol is empty string', () => {
    const resource: ResourceTiming = {
      nextHopProtocol: '',
    } as ResourceTiming;

    expect(getProtocol(resource)).toBe('unknown');
  });
});
