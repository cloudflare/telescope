const browsers = require('../lib/browsers.js');
const playwright = require('playwright');
let installedVersions = [];
//super simple check to see the currently installed versions of each browser

(async () => {
  for (const browser in browsers.browsers) {
    const browserInstance = await playwright[
      browsers.browsers[browser].engine
    ].launch(browsers.browsers[browser]);
    const version = await browserInstance.version();
    await browserInstance.close();
    installedVersions.push({ browser: browser, version: version });
  }
  console.info(installedVersions);
})();
