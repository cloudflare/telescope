import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { DEFAULT_OPTIONS } from '../src/defaultOptions.js';
import type {
  BaselineDetectionPassOptions,
  BrowserConfigOptions,
} from '../src/types.js';

const browserLogger = {
  isEnabled: vi.fn().mockReturnValue(true),
  log: vi.fn(),
};
const launchOptions = {
  args: ['--browser-argument'],
  channel: 'chrome',
  env: { BROWSER_ENV: 'value' },
  firefoxUserPrefs: { 'browser.preference': true },
  headless: true,
  ignoreDefaultArgs: ['--default-argument'],
  logger: browserLogger,
} satisfies Partial<BrowserConfigOptions>;
const contextOptions = {
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  javaScriptEnabled: false,
  userAgent: 'detection-pass-agent',
  viewport: { height: 720, width: 1280 },
} satisfies Partial<BrowserConfigOptions>;

const mocks = vi.hoisted(() => {
  const page = { goto: vi.fn() };
  const context = {
    addCookies: vi.fn(),
    close: vi.fn(),
    newPage: vi.fn().mockResolvedValue(page),
    setExtraHTTPHeaders: vi.fn(),
    setOffline: vi.fn(),
  };
  const browser = {
    close: vi.fn(),
    newContext: vi.fn().mockResolvedValue(context),
  };

  return {
    browser,
    context,
    harvestInlineStyles: vi.fn(),
    launch: vi.fn().mockResolvedValue(browser),
    page,
  };
});

vi.mock('playwright', () => ({
  default: {
    chromium: { launch: mocks.launch },
    firefox: { launch: mocks.launch },
    webkit: { launch: mocks.launch },
  },
}));

vi.mock('../src/baselineCssExtract.js', () => ({
  harvestInlineStyles: mocks.harvestInlineStyles,
}));

import { runBaselineDetectionPass } from '../src/baselineDetectionPass.js';

const browserConfig: BrowserConfigOptions = {
  ...contextOptions,
  ...launchOptions,
  engine: 'chromium',
  recordHar: { path: 'unused.har' },
  recordVideo: { dir: 'unused', size: { height: 720, width: 1280 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.launch.mockResolvedValue(mocks.browser);
  mocks.browser.close.mockResolvedValue(undefined);
  mocks.browser.newContext.mockResolvedValue(mocks.context);
  mocks.context.close.mockResolvedValue(undefined);
  mocks.context.newPage.mockResolvedValue(mocks.page);
  mocks.context.setOffline.mockResolvedValue(undefined);
  mocks.page.goto.mockResolvedValue(null);
  mocks.harvestInlineStyles.mockResolvedValue([]);
});

afterEach(() => vi.restoreAllMocks());

function runPass(overrides: Partial<BaselineDetectionPassOptions> = {}) {
  return runBaselineDetectionPass({
    browserConfig,
    preparePage: vi.fn().mockResolvedValue(undefined),
    timeout: 250,
    url: 'https://example.com',
    ...overrides,
  });
}

test.each([
  [
    'error name',
    Object.assign(new Error('signed-url-secret'), { name: 'TimeoutError' }),
  ],
  ['error message', new Error('Timeout at https://example.com/secret')],
])(
  'collects partial results after a navigation timeout identified by %s',
  async (_case, timeoutError) => {
    mocks.page.goto.mockRejectedValue(timeoutError);
    mocks.harvestInlineStyles.mockResolvedValue([
      { css: '.partial {}', file: 'https://example.com (inline style #1)' },
    ]);
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const preparePage = vi.fn().mockResolvedValue(undefined);
    const cookie = { name: 'session', value: 'expected' };

    await expect(
      runPass({
        auth: { password: 'password', username: 'username' },
        cookies: cookie,
        headers: { 'x-baseline-test': 'expected' },
        preparePage,
        url: 'https://example.com/?token=secret',
      }),
    ).resolves.toEqual({
      inlineCSSSources: [
        { css: '.partial {}', file: 'https://example.com (inline style #1)' },
      ],
    });

    expect(mocks.launch).toHaveBeenCalledWith(launchOptions);
    expect(mocks.browser.newContext).toHaveBeenCalledWith({
      ...contextOptions,
      httpCredentials: { password: 'password', username: 'username' },
    });
    expect(mocks.context.setExtraHTTPHeaders).toHaveBeenCalledWith({
      'x-baseline-test': 'expected',
    });
    expect(mocks.context.addCookies).toHaveBeenCalledWith([
      {
        name: 'session',
        url: 'https://example.com/?token=secret',
        value: 'expected',
      },
    ]);
    expect(cookie).toEqual({ name: 'session', value: 'expected' });
    expect(preparePage).toHaveBeenCalledWith(mocks.page);
    expect(mocks.context.setOffline).toHaveBeenCalledWith(true);
    expect(warningSpy).toHaveBeenCalledWith(
      '[baseline] - detection-navigation-timeout: exceeded 250ms',
    );
    expect(mocks.context.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  },
);

test('propagates non-timeout navigation failures and closes resources', async () => {
  const error = new Error('navigation failed');
  mocks.page.goto.mockRejectedValue(error);

  await expect(runPass()).rejects.toBe(error);

  expect(mocks.context.setOffline).not.toHaveBeenCalled();
  expect(mocks.context.close).toHaveBeenCalledOnce();
  expect(mocks.browser.close).toHaveBeenCalledOnce();
});

test('closes the browser when context creation fails', async () => {
  const error = new Error('context creation failed');
  mocks.browser.newContext.mockRejectedValue(error);

  await expect(runPass()).rejects.toBe(error);

  expect(mocks.context.close).not.toHaveBeenCalled();
  expect(mocks.browser.close).toHaveBeenCalledOnce();
});

test.each([0, -1])(
  'uses the default navigation timeout when configured with %i',
  async timeout => {
    await runPass({ timeout });

    expect(mocks.page.goto).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: DEFAULT_OPTIONS.timeout }),
    );
  },
);

test('preserves complete domain cookies supplied as an array', async () => {
  const cookies = [
    { domain: 'example.com', name: 'session', path: '/', value: 'expected' },
  ];

  await runPass({ cookies });

  expect(mocks.context.addCookies).toHaveBeenCalledWith(cookies);
});

test('closes resources when page preparation fails', async () => {
  const error = new Error('page preparation failed');
  mocks.context.close.mockRejectedValue(
    new Error('context close failed at HTTPS://example.com/context-secret'),
  );
  mocks.browser.close.mockRejectedValue(
    new Error('browser close failed at https://example.com/browser-secret'),
  );
  const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  await expect(
    runPass({ preparePage: vi.fn().mockRejectedValue(error) }),
  ).rejects.toBe(error);

  expect(mocks.page.goto).not.toHaveBeenCalled();
  expect(mocks.context.close).toHaveBeenCalledOnce();
  expect(mocks.browser.close).toHaveBeenCalledOnce();
  expect(warningSpy).toHaveBeenCalledWith(
    '[baseline] - detection-context-cleanup: Error: context close failed at [redacted URL]',
  );
  expect(warningSpy).toHaveBeenCalledWith(
    '[baseline] - detection-browser-cleanup: Error: browser close failed at [redacted URL]',
  );
});

test('preserves collected results when cleanup fails', async () => {
  mocks.harvestInlineStyles.mockResolvedValue([
    { css: '.collected {}', file: 'https://example.com (inline style #1)' },
  ]);
  mocks.context.close.mockRejectedValue(new Error('context close failed'));
  mocks.browser.close.mockRejectedValue(new Error('browser close failed'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  await expect(runPass()).resolves.toEqual({
    inlineCSSSources: [
      {
        css: '.collected {}',
        file: 'https://example.com (inline style #1)',
      },
    ],
  });

  expect(mocks.context.close).toHaveBeenCalledOnce();
  expect(mocks.browser.close).toHaveBeenCalledOnce();
});

test.each([
  [
    'a collector failure',
    new Error('collector failed at https://example.com/collector-secret'),
    '[baseline] - inline-css-collector: Error: collector failed at [redacted URL]',
  ],
  [
    'an unformattable collector failure',
    Object.create(null),
    '[baseline] - inline-css-collector: UnknownError: [unprintable thrown value]',
  ],
])('isolates %s', async (_case, error, expectedWarning) => {
  mocks.harvestInlineStyles.mockRejectedValue(error);
  const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  await expect(runPass()).resolves.toEqual({ inlineCSSSources: [] });
  expect(warningSpy).toHaveBeenCalledWith(expectedWarning);
});
