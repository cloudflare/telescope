import { z } from 'zod';
import { describe, expect, test } from 'vitest';

import {
  CookiesSchema,
  HeadersSchema,
  AuthSchema,
  FirefoxPrefsSchema,
  OverrideHostSchema,
  DelaySchema,
  StringArraySchema,
  PositiveIntSchema,
  PositiveFloatSchema,
} from '../src/schemas.js';

import {
  parseCLIOption,
  parseUnknown,
  parseWithSchema,
  formatZodError,
} from '../src/validation.js';

import { normalizeCLIConfig } from '../src/config.js';

import type { CLIOptions } from '../src/types.js';

describe('JSON syntax errors', () => {
  test('rejects an empty string', () => {
    expect(() => parseCLIOption('--test', '', CookiesSchema)).toThrow(
      /Invalid JSON for "--test"/,
    );
  });

  test('rejects single quotes', () => {
    expect(() => parseCLIOption('--test', "{'a': 1}", CookiesSchema)).toThrow(
      /Invalid JSON/,
    );
  });

  test('rejects trailing commas', () => {
    expect(() => parseCLIOption('--test', '{"a": 1,}', CookiesSchema)).toThrow(
      /Invalid JSON/,
    );
  });

  test('rejects unquoted keys', () => {
    expect(() => parseCLIOption('--test', '{a: 1}', CookiesSchema)).toThrow(
      /Invalid JSON/,
    );
  });

  test('includes the flag name in the error message', () => {
    expect(() => parseCLIOption('--cookies', '', CookiesSchema)).toThrow(
      /--cookies/,
    );
  });
});

describe('--cookies', () => {
  describe('valid inputs', () => {
    test('accepts a single cookie object', () => {
      const input =
        '{"name":"a","value":"b","domain":"example.com","path":"/"}';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toEqual({
        name: 'a',
        value: 'b',
        domain: 'example.com',
        path: '/',
      });
    });

    test('accepts an array of cookies', () => {
      const input =
        '[{"name":"a","value":"b","domain":"d","path":"/"},{"name":"c","value":"d","domain":"d","path":"/"}]';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toHaveLength(2);
    });

    test('accepts a cookie with optional fields', () => {
      const input = JSON.stringify({
        name: 'a',
        value: 'b',
        domain: 'd',
        path: '/',
        sameSite: 'Lax',
        httpOnly: true,
        secure: true,
        expires: 1234567890,
      });
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toMatchObject({
        sameSite: 'Lax',
        httpOnly: true,
        secure: true,
        expires: 1234567890,
      });
    });

    test('allows unknown fields via passthrough', () => {
      const input =
        '{"name":"a","value":"b","domain":"d","path":"/","extra":"field"}';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toHaveProperty('extra');
    });

    test('accepts an empty array', () => {
      const result = parseCLIOption('--cookies', '[]', CookiesSchema);
      expect(result).toEqual([]);
    });

    test('accepts a cookie with url instead of domain+path', () => {
      const input = '{"name":"a","value":"b","url":"https://example.com"}';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toEqual({
        name: 'a',
        value: 'b',
        url: 'https://example.com',
      });
    });

    test('accepts a cookie with only name and value (testRunner fills in url)', () => {
      const input = '{"name":"a","value":"b"}';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toEqual({ name: 'a', value: 'b' });
    });

    test('accepts a cookie without domain (testRunner fills in url)', () => {
      const input = '{"name":"a","value":"b","path":"/"}';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toEqual({ name: 'a', value: 'b', path: '/' });
    });

    test('accepts a cookie without path (testRunner fills in url)', () => {
      const input = '{"name":"a","value":"b","domain":"d"}';
      const result = parseCLIOption('--cookies', input, CookiesSchema);
      expect(result).toEqual({ name: 'a', value: 'b', domain: 'd' });
    });
  });

  describe('invalid inputs', () => {
    test('rejects a cookie missing name', () => {
      const input = '{"value":"b","domain":"d","path":"/"}';
      expect(() => parseCLIOption('--cookies', input, CookiesSchema)).toThrow(
        /Invalid data for "--cookies"/,
      );
    });

    test('rejects a cookie missing value', () => {
      const input = '{"name":"a","domain":"d","path":"/"}';
      expect(() => parseCLIOption('--cookies', input, CookiesSchema)).toThrow(
        /Invalid data/,
      );
    });

    test('rejects a cookie with bad sameSite value', () => {
      const input =
        '{"name":"a","value":"b","domain":"d","path":"/","sameSite":"invalid"}';
      expect(() => parseCLIOption('--cookies', input, CookiesSchema)).toThrow(
        /Invalid data/,
      );
    });

    test('rejects a non-object/non-array value', () => {
      expect(() =>
        parseCLIOption('--cookies', '"just a string"', CookiesSchema),
      ).toThrow(/Invalid data/);
    });

    test('rejects an array of non-objects', () => {
      expect(() =>
        parseCLIOption('--cookies', '[1, 2, 3]', CookiesSchema),
      ).toThrow(/Invalid data/);
    });
  });
});

describe('--headers', () => {
  describe('valid inputs', () => {
    test('accepts a headers object', () => {
      const input = '{"Accept":"text/html","X-Custom":"value"}';
      const result = parseCLIOption('--headers', input, HeadersSchema);
      expect(result).toEqual({ Accept: 'text/html', 'X-Custom': 'value' });
    });

    test('accepts an empty object', () => {
      const result = parseCLIOption('--headers', '{}', HeadersSchema);
      expect(result).toEqual({});
    });
  });

  describe('invalid inputs', () => {
    test('rejects a non-string value', () => {
      const input = '{"Accept": 123}';
      expect(() => parseCLIOption('--headers', input, HeadersSchema)).toThrow(
        /Invalid data for "--headers"/,
      );
    });

    test('rejects an array', () => {
      expect(() => parseCLIOption('--headers', '[]', HeadersSchema)).toThrow(
        /Invalid data/,
      );
    });
  });
});

describe('--auth', () => {
  describe('valid inputs', () => {
    test('accepts username and password', () => {
      const input = '{"username":"u","password":"p"}';
      const result = parseCLIOption('--auth', input, AuthSchema);
      expect(result).toEqual({ username: 'u', password: 'p' });
    });

    test('accepts with origin', () => {
      const input =
        '{"username":"u","password":"p","origin":"https://example.com"}';
      const result = parseCLIOption('--auth', input, AuthSchema);
      expect(result).toHaveProperty('origin', 'https://example.com');
    });

    test('accepts with send "always"', () => {
      const input = '{"username":"u","password":"p","send":"always"}';
      const result = parseCLIOption('--auth', input, AuthSchema);
      expect(result).toHaveProperty('send', 'always');
    });

    test('accepts with send "unauthorized"', () => {
      const input = '{"username":"u","password":"p","send":"unauthorized"}';
      const result = parseCLIOption('--auth', input, AuthSchema);
      expect(result).toHaveProperty('send', 'unauthorized');
    });
  });

  describe('invalid inputs', () => {
    test('rejects missing username', () => {
      const input = '{"password":"p"}';
      expect(() => parseCLIOption('--auth', input, AuthSchema)).toThrow(
        /Invalid data for "--auth"/,
      );
    });

    test('rejects missing password', () => {
      const input = '{"username":"u"}';
      expect(() => parseCLIOption('--auth', input, AuthSchema)).toThrow(
        /Invalid data/,
      );
    });

    test('rejects bad send value', () => {
      const input = '{"username":"u","password":"p","send":"never"}';
      expect(() => parseCLIOption('--auth', input, AuthSchema)).toThrow(
        /Invalid data/,
      );
    });
  });
});

describe('--firefoxPrefs', () => {
  describe('valid inputs', () => {
    test('accepts mixed types (string, number, boolean)', () => {
      const input = '{"pref.string":"value","pref.number":42,"pref.bool":true}';
      const result = parseCLIOption(
        '--firefoxPrefs',
        input,
        FirefoxPrefsSchema,
      );
      expect(result).toEqual({
        'pref.string': 'value',
        'pref.number': 42,
        'pref.bool': true,
      });
    });

    test('accepts all string values', () => {
      const input = '{"a":"b"}';
      const result = parseCLIOption(
        '--firefoxPrefs',
        input,
        FirefoxPrefsSchema,
      );
      expect(result).toEqual({ a: 'b' });
    });
  });

  describe('invalid inputs', () => {
    test('rejects null value', () => {
      const input = '{"pref": null}';
      expect(() =>
        parseCLIOption('--firefoxPrefs', input, FirefoxPrefsSchema),
      ).toThrow(/Invalid data for "--firefoxPrefs"/);
    });

    test('rejects nested object value', () => {
      const input = '{"pref": {"nested": true}}';
      expect(() =>
        parseCLIOption('--firefoxPrefs', input, FirefoxPrefsSchema),
      ).toThrow(/Invalid data/);
    });

    test('rejects array value', () => {
      const input = '{"pref": [1,2]}';
      expect(() =>
        parseCLIOption('--firefoxPrefs', input, FirefoxPrefsSchema),
      ).toThrow(/Invalid data/);
    });
  });
});

describe('--overrideHost', () => {
  describe('valid inputs', () => {
    test('accepts a host mapping', () => {
      const input = '{"old.example.com":"new.example.com"}';
      const result = parseCLIOption(
        '--overrideHost',
        input,
        OverrideHostSchema,
      );
      expect(result).toEqual({ 'old.example.com': 'new.example.com' });
    });

    test('accepts an empty object', () => {
      const result = parseCLIOption('--overrideHost', '{}', OverrideHostSchema);
      expect(result).toEqual({});
    });
  });

  describe('invalid inputs', () => {
    test('rejects a non-string value', () => {
      const input = '{"host": 123}';
      expect(() =>
        parseCLIOption('--overrideHost', input, OverrideHostSchema),
      ).toThrow(/Invalid data for "--overrideHost"/);
    });
  });
});

describe('--delay', () => {
  describe('valid inputs', () => {
    test('accepts a delay mapping', () => {
      const input = '{".css$": 2000, ".js$": 5000}';
      const result = parseCLIOption('--delay', input, DelaySchema);
      expect(result).toEqual({ '.css$': 2000, '.js$': 5000 });
    });

    test('accepts an empty object', () => {
      const result = parseCLIOption('--delay', '{}', DelaySchema);
      expect(result).toEqual({});
    });
  });

  describe('invalid inputs', () => {
    test('rejects a non-number value', () => {
      const input = '{".css$": "slow"}';
      expect(() => parseCLIOption('--delay', input, DelaySchema)).toThrow(
        /Invalid data for "--delay"/,
      );
    });
  });
});

describe('parseUnknown with StringArraySchema', () => {
  describe('valid inputs', () => {
    test('accepts a string array', () => {
      const result = parseUnknown(
        '--block',
        ['a', 'b', 'c'],
        StringArraySchema,
      );
      expect(result).toEqual(['a', 'b', 'c']);
    });

    test('accepts an empty array', () => {
      const result = parseUnknown('--block', [], StringArraySchema);
      expect(result).toEqual([]);
    });
  });

  describe('invalid inputs', () => {
    test('rejects an array of numbers', () => {
      expect(() =>
        parseUnknown('--block', [1, 2, 3], StringArraySchema),
      ).toThrow(/Invalid data for "--block"/);
    });

    test('rejects a plain string', () => {
      expect(() =>
        parseUnknown('--block', 'string', StringArraySchema),
      ).toThrow(/Invalid data/);
    });
  });
});

describe('formatZodError', () => {
  test('formats a root-level error with (root)', () => {
    const result = z.string().safeParse(123);
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain('(root)');
    }
  });

  test('formats an object error with the field path', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 123 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted).toContain('name:');
    }
  });

  test('formats multiple issues with line prefixes', () => {
    const result = z
      .object({ a: z.string(), b: z.number() })
      .safeParse({ a: 1, b: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      const lines = formatted.split('\n').filter(l => l.includes('  - '));
      expect(lines).toHaveLength(2);
    }
  });
});

describe('backward compat', () => {
  test('works with no JSON options', () => {
    const result = normalizeCLIConfig({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
  });

  test('passes through already-parsed cookies', () => {
    const options: CLIOptions = {
      url: 'https://example.com',
      cookies: [{ name: 'a', value: 'b', domain: 'd', path: '/' }],
    };
    const result = normalizeCLIConfig(options);
    expect(Array.isArray(result.cookies)).toBe(true);
    expect(result.cookies).toEqual([
      { name: 'a', value: 'b', domain: 'd', path: '/' },
    ]);
  });

  test('throws on bad JSON in block array items', () => {
    const options: CLIOptions = {
      url: 'https://example.com',
      block: ["[ 'one', 'two' ]"],
    };
    expect(() => normalizeCLIConfig(options)).toThrow(/Problem parsing/);
  });

  test('uses numeric width directly (no string parsing needed)', () => {
    const options: CLIOptions = {
      url: 'https://example.com',
      width: 1920,
    };
    const result = normalizeCLIConfig(options);
    expect(result.width).toBe(1920);
  });

  test('falls back to default when width is undefined', () => {
    const result = normalizeCLIConfig({ url: 'https://example.com' });
    expect(result.width).toBe(1366);
  });

  test('uses cpuThrottle as a number directly', () => {
    const options: CLIOptions = {
      url: 'https://example.com',
      cpuThrottle: 4,
    };
    const result = normalizeCLIConfig(options);
    expect(result.cpuThrottle).toBe(4);
  });

  test('passes flags array directly to args', () => {
    const options: CLIOptions = {
      url: 'https://example.com',
      flags: ['--disable-gpu', '--headless'],
    };
    const result = normalizeCLIConfig(options);
    expect(result.args).toEqual(['--disable-gpu', '--headless']);
  });

  test('empty flags array produces empty args', () => {
    const options: CLIOptions = {
      url: 'https://example.com',
      flags: [],
    };
    const result = normalizeCLIConfig(options);
    expect(result.args).toEqual([]);
  });
});

describe('PositiveIntSchema', () => {
  test('parses a valid integer string', () => {
    expect(PositiveIntSchema.parse('42')).toBe(42);
  });

  test('parses a number directly', () => {
    expect(PositiveIntSchema.parse(10)).toBe(10);
  });

  test('rejects zero', () => {
    expect(() => PositiveIntSchema.parse('0')).toThrow();
  });

  test('rejects negative numbers', () => {
    expect(() => PositiveIntSchema.parse('-5')).toThrow();
  });

  test('rejects floats', () => {
    expect(() => PositiveIntSchema.parse('3.5')).toThrow();
  });

  test('rejects non-numeric strings', () => {
    expect(() => PositiveIntSchema.parse('abc')).toThrow();
  });

  test('rejects empty string', () => {
    expect(() => PositiveIntSchema.parse('')).toThrow();
  });
});

describe('PositiveFloatSchema', () => {
  test('parses a valid float string', () => {
    expect(PositiveFloatSchema.parse('4.5')).toBe(4.5);
  });

  test('parses an integer string', () => {
    expect(PositiveFloatSchema.parse('2')).toBe(2);
  });

  test('parses a number directly', () => {
    expect(PositiveFloatSchema.parse(3.14)).toBe(3.14);
  });

  test('rejects zero', () => {
    expect(() => PositiveFloatSchema.parse('0')).toThrow();
  });

  test('rejects negative numbers', () => {
    expect(() => PositiveFloatSchema.parse('-1.5')).toThrow();
  });

  test('rejects non-numeric strings', () => {
    expect(() => PositiveFloatSchema.parse('fast')).toThrow();
  });
});

describe('parseWithSchema', () => {
  test('returns a parsed integer for valid input', () => {
    expect(parseWithSchema(PositiveIntSchema, '42', '--width')).toBe(42);
  });

  test('returns a parsed float for valid input', () => {
    expect(parseWithSchema(PositiveFloatSchema, '4.5', '--cpuThrottle')).toBe(
      4.5,
    );
  });

  test('throws for non-numeric --width', () => {
    expect(() =>
      parseWithSchema(PositiveIntSchema, 'eight', '--width'),
    ).toThrow();
  });

  test('throws for non-numeric --height', () => {
    expect(() =>
      parseWithSchema(PositiveIntSchema, 'tall', '--height'),
    ).toThrow();
  });

  test('throws for non-numeric --frameRate', () => {
    expect(() =>
      parseWithSchema(PositiveIntSchema, 'fast', '--frameRate'),
    ).toThrow();
  });

  test('throws for non-numeric --timeout', () => {
    expect(() =>
      parseWithSchema(PositiveIntSchema, 'never', '--timeout'),
    ).toThrow();
  });

  test('throws for non-numeric --cpuThrottle', () => {
    expect(() =>
      parseWithSchema(PositiveFloatSchema, 'turbo', '--cpuThrottle'),
    ).toThrow();
  });

  test('includes the bad value and flag name in the error message', () => {
    expect(() => parseWithSchema(PositiveIntSchema, 'abc', '--width')).toThrow(
      /abc.*--width/,
    );
  });

  test('throws for zero (not positive)', () => {
    expect(() => parseWithSchema(PositiveIntSchema, '0', '--width')).toThrow();
  });

  test('throws for negative number', () => {
    expect(() =>
      parseWithSchema(PositiveIntSchema, '-5', '--height'),
    ).toThrow();
  });

  test('throws for float where int expected', () => {
    expect(() =>
      parseWithSchema(PositiveIntSchema, '3.5', '--frameRate'),
    ).toThrow();
  });
});
