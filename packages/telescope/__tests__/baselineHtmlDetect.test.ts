import playwright from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Browser, Page } from 'playwright';

import { collectHTMLFeatures } from '../src/baselineHtmlDetect.js';
import { BrowserConfig } from '../src/browsers.js';

const engines = [
  ...new Set(
    BrowserConfig.getBrowsers().map(
      name => BrowserConfig.browserConfigs[name].engine,
    ),
  ),
];

describe.each(engines)('live DOM HTML collection — %s', engine => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await playwright[engine].launch({ headless: true });
    page = await browser.newPage();
    await page.setContent(`
      <style>.live { color: green; }</style>
      <dialog closedby="any" id="first"></dialog>
      <dialog></dialog>
      <details open></details>
      <img alt="" loading="lazy" sizes="auto">
      <img sizes="auto, 100vw">
      <img loading="not-a-loading-mode">
      <input type="date">
      <input form="missing-form" type="datetime-local">
      <fencedframe></fencedframe>
      <iframe
        cross-origin-top-navigation-by-user-activation
        privateToken
      ></iframe>
      <div
        click="not-an-event-handler"
        children="not-a-content-attribute"
        data-="not-a-custom-data-attribute"
        data-first="one"
        data-second="two"
        madeup="value"
        role="button"
      ></div>
      <not-an-html-element
        data-third="three"
        inert
        strange="value"
      ></not-an-html-element>
      <canvas></canvas>
      <script>
        document.body.append(document.createElement('dialog'));
        const mixedCaseAttributes = document.createElement('div');
        mixedCaseAttributes.setAttributeNS(null, 'ARIA-LABEL', 'ignored');
        mixedCaseAttributes.setAttributeNS(null, 'DATA-MIXED', 'included');
        mixedCaseAttributes.setAttributeNS(null, 'ONCLICK', 'ignored');
        document.body.append(mixedCaseAttributes);
        document.querySelector('canvas').remove();
      </script>
    `);
  }, 120000);

  afterAll(async () => {
    await browser.close();
  });

  test('emits sorted BCD keys with occurrence counts from the live DOM', async () => {
    const htmlFeatures = await collectHTMLFeatures(page);

    expect(htmlFeatures).toEqual([
      { bcdKey: 'html.elements.body', count: 1 },
      { bcdKey: 'html.elements.details', count: 1 },
      { bcdKey: 'html.elements.details.open', count: 1 },
      { bcdKey: 'html.elements.dialog', count: 3 },
      { bcdKey: 'html.elements.dialog.closedby', count: 1 },
      { bcdKey: 'html.elements.div', count: 2 },
      { bcdKey: 'html.elements.fencedframe', count: 1 },
      { bcdKey: 'html.elements.head', count: 1 },
      { bcdKey: 'html.elements.html', count: 1 },
      { bcdKey: 'html.elements.iframe', count: 1 },
      { bcdKey: 'html.elements.iframe.privateToken', count: 1 },
      { bcdKey: 'html.elements.img', count: 3 },
      { bcdKey: 'html.elements.img.alt', count: 1 },
      { bcdKey: 'html.elements.img.loading', count: 1 },
      { bcdKey: 'html.elements.img.sizes', count: 2 },
      { bcdKey: 'html.elements.input', count: 2 },
      { bcdKey: 'html.elements.input.form', count: 1 },
      { bcdKey: 'html.elements.input.type_date', count: 1 },
      { bcdKey: 'html.elements.input.type_datetime-local', count: 1 },
      { bcdKey: 'html.elements.script', count: 1 },
      { bcdKey: 'html.elements.style', count: 1 },
      { bcdKey: 'html.global_attributes.data_attributes', count: 4 },
      { bcdKey: 'html.global_attributes.id', count: 1 },
      { bcdKey: 'html.global_attributes.inert', count: 1 },
    ]);
  });

  test('does not modify the document', async () => {
    const before = await page.content();

    await collectHTMLFeatures(page);

    expect(await page.content()).toBe(before);
  });
});
