import { beforeAll, afterAll, describe, expect, test } from 'vitest';

import { fixturesDir, withHAR, createStaticServer, listenServer, shutdownServer } from './testServer.ts';

import type {
  BrowserName,
  HarEntry,
} from '../src/types.js';

const browsers: BrowserName[] = ['chromium'];

describe('Request HAR entries', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Start web server with a little delay on responses to be more realistic
    server = createStaticServer({
      fixturesDirPath: fixturesDir('priority'),
      delay: 260,
      compress: 9
    });
    baseUrl = await listenServer(server);
  });

  afterAll(async () => {
    await shutdownServer(server);
  });

  describe.each(browsers)('Using %s', (browser: BrowserName) => {
    test('Check priorities', async () => {
      await withHAR({ url: `${baseUrl}/index.html`, browser }, har => {
        expect(har).not.toBeNull();

        const isFirstImages = new RegExp('first(\\d+)$');
        const isSecondImage = new RegExp('second$');
        const isThirdImage = new RegExp('third$');
        const isFourthImage = new RegExp('fourth$');
        const isStyleFile = new RegExp('style.css$');
        const isScriptFile = new RegExp('script.js$');

        har.log.entries.forEach((entry: HarEntry) => {
          const uri = entry.request.url;
          let parts = [];

          if (isStyleFile.test(uri)) {
            expect(entry._priority,
              'Style file in HEAD has a very high priority')
              .toEqual('VeryHigh');
          } else if (isScriptFile.test(uri)) {
            expect(entry._priority,
              'Deferred JavaScript file has a low priority')
              .toEqual('Low');
          } else if (parts = isFirstImages.exec(uri)) { // eslint-disable-line no-cond-assign
            if (parts[1] !== '1' && parts[1].startsWith('1')) {
              expect(entry._initialPriority,
                'Large above-the-fold image starts at Medium')
                .toEqual('Medium');
              expect(entry._priority,
                `Large above-the-fold image ${uri} boosted to High`)
                .toEqual('High');
            } else {
              expect(entry._initialPriority,
                'Images start at low priority')
                .toEqual('Low');
              expect(entry._priority,
                'Above-the-fold image boosted to High')
                .toEqual('High');
            }
          } else if (isSecondImage.test(uri)) {
            expect(entry._initialPriority,
              'Images start at low priority')
              .toEqual('Low');
            expect(entry._priority,
              'Below-the-fold images stay at low priority')
              .toEqual('Low');
          } else if (isThirdImage.test(uri)) {
            expect(entry._priority,
              'Fetchpriority high boosts below-the-fold image')
              .toEqual('High');
          } else if(isFourthImage.test(uri)) {
            expect(entry._initialPriority,
              'Images start at low priority')
              .toEqual('Low');
            expect(entry._priority,
              'Below-the-fold images stay at low, even after a boosted')
              .toEqual('Low');
          }
        });
      });
    }, 60000);
  });
});
