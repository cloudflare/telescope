import { BrowserConfig } from '../lib/browsers.js';
import fs from 'fs';

const browsers = BrowserConfig.getBrowsers();

describe('Specific browser tests', () => {
  test('Initializing with an invalid browser throws an error', () => {
    let options = {
      browser: 'hotdog',
      url: '../tests/sandbox/index.html',
    };
    expect(() =>
      new BrowserConfig().getBrowserConfig('hotdog', options).toThrow(Error),
    );
  });

  test('Passing Firefox preferences creates a user data dir and file', () => {
    let options = {
      browser: 'firefox',
      firefoxPrefs: '{"image.avif.enabled": "false"}',
      url: '../tests/sandbox/index.html',
    };
    let config = new BrowserConfig().getBrowserConfig('firefox', options);
    expect(config && typeof config === 'object').toBe(true);
    expect(fs.existsSync('./tmp')).toBe(true);
    expect(fs.existsSync('./tmp/user.js')).toBe(true);

    //clean up after ourselves
    fs.rmSync('./tmp', { recursive: true, force: true });
  });

  //test for default chrome flag add and remove
});

describe.each(browsers)('Basic configuration tests: %s', browser => {
  test('Initializing with a valid browser results in a config', () => {
    let options = {
      browser,
      url: '../tests/sandbox/index.html',
    };
    let config = new BrowserConfig().getBrowserConfig(browser, options);
    expect(config && typeof config === 'object').toBe(true);
  });
  test('Setting a viewport updates the config', () => {
    let options = {
      browser,
      width: 500,
      height: 700,
      url: '../tests/sandbox/index.html',
    };
    let config = new BrowserConfig().getBrowserConfig(browser, options);
    expect(config && typeof config === 'object').toBe(true);
    expect(config.viewport.width === 500).toBe(true);
    expect(config.viewport.height === 700).toBe(true);
  });
  test('Setting a viewport updates the video size', () => {
    let options = {
      browser,
      width: 500,
      height: 700,
      url: '../tests/sandbox/index.html',
    };
    let config = new BrowserConfig().getBrowserConfig(browser, options);
    expect(config && typeof config === 'object').toBe(true);
    expect(config.recordVideo.size.width === 500).toBe(true);
    expect(config.recordVideo.size.height === 700).toBe(true);
  });
  test('Setting a viewport with a string throws an error', () => {
    let options = {
      browser,
      width: 'asdf',
      height: 'asdf',
      url: '../tests/sandbox/index.html',
    };
    expect(() =>
      new BrowserConfig().getBrowserConfig(browser, options).toThrow(Error),
    );
  });

  //test for other options
});
