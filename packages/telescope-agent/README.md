# Browser Agent

A diagnostic, cross-browser performance testing agent.

## What it collects

When you run the agent, it will load the page in the browser you chose and apply any special parameters you have provided. By default, it will store results for the test in a `/results` directory. Each test gets its own folder with the date prefixed, followed by a unique ID.

Inside the test folder, the following files are added:

- `console.json` - Console output from the page to look for warnings, JS errors, etc
- a video file showing the page load progression
- `metrics.json` - A collection of timing metrics collected from the browser during page load
- `pageload.har` - A har file of the page load
- `resources.json` - The resource timing API data for the page
- `screenshot.png` - A screenshot of the final page load
- `/filmstrip` - A collection of screenshots during the page load that could be used for a filmstrip

## Parameters

A full list of parameters can be printed to the terminal by running `npx . --help`. Here's what's currently supported:

```
Options:
  -u, --url <url>               URL to run tests against
  -b, --browser <browser_name>  Browser to run tests with (choices: "chrome", "chrome-beta", "canary", "edge", "safari", "firefox", default: "chrome")
  -h, --headers <object>        Any custom headers to apply to requests
  -c, --cookies <object>        Any custom cookies to apply
  -f, --flags <string>          A comma separated list of Chromium flags to launch Chrome with. See: https://peter.sh/experiments/chromium-command-line-switches/
  --blockDomains <domains...>   A comma separated list of domains to block (default: [])
  --block <substrings...>       A comma-delimited list of urls to block (based on a substring match) (default: [])
  --firefoxPrefs <object>       Any Firefox User Preferences to apply (Firefox only). Example: '{"network.trr.mode": 2}'
  --cpuThrottle <int>           CPU throttling factor
  --connectionType <string>     Network connection type. By default, no throttling is applied. (choices: "cable", "dsl", "4g", "3g", "3gfast", "3gslow", "2g", "fios", default: false)
  --width <int>                 Viewport width, in pixels (default: "1366")
  --height <int>                Viewport height, in pixels (default: "768")
  --frameRate <int>             Filmstrip frame rate, in frames per second (default: 1)
  --disableJS                   Disable JavaScript (default: false)
  --debug                       Output debug lines (default: false)
  --auth <object>               Basic HTTP authentication (Expects: {"username": "", "password": ""})  (default: false)
  --timeout <int>               Maximum time (in milliseconds) to wait for test to complete (default: 30000)
  --html                        Generate HTML report (default: false)
  --openHtml                    Open HTML report in browser (requires --html) (default: false)
  --list                        Generate a list of test results as HTML (default: false)
  --zip                         Zip the results of the test into the results directory. (default: false)
  --help                        display help for command
```

### Custom Timeout

You can set a custom timeout by passing the desired timeout in milliseconds using the `--timeout` parameter. Defaults to 30000, or 30 seconds.

```
npx . -u https://www.example.com -b chrome --timeout 50000
```

### HTML Report Generation

**Browser Support**
✅ Edge
✅ Chrome
✅ Safari
✅ Firefox

You can generate an HTML report of your test results by passing the `--html` parameter. To automatically open the report in your default browser after generation, add the `--openHtml` flag.

#### Generate HTML report

```
npx . -u https://example.com -b chrome --html
```

#### Generate and automatically open HTML report

```
npx . -u https://example.com -b chrome --html --openHtml
```

### Setting Custom Cookies

**Browser support**
✅ Edge
✅ Chrome
🚫 Safari
✅ Firefox

You can define custom cookies to be passed along to request when running your test using the `-c` or `--cookies` parameter.

Cookies must have a name and value passed. Optionally, you can also pass in either a URL or a domain and path. If none are passed, the script will default to using the test page url.

#### Set a custom cookie for all requests

```
npx . -u https://www.example.com -b chrome -c '{"name": "foo", "value": "bar"}'
```

#### Set multiple cookies for all requests

```
npx . -u https://www.example.com -b chrome -c '[{"name": "foo", "value": "bar"}, {"name": "foo2", "value": "bar2"}]'
```

#### Set a custom cookie for only a particular path

```
npx . -u https://www.example.com -b chrome -c '{"name": "foo", "value": "bar", "domain":"www.example.com", "path":"/optim"}'
```

### Disabling JavaScript

**Browser Support**
✅ Edge
✅ Chrome
✅ Safari
✅ Firefox

You can run tests with JavaScript disabled to see the impact on performance by passing the `--disableJS` parameter like so:

```
npx . -u https://playwright.dev/ -b firefox --disableJS
```

### Basic HTTP Authentication

**Browser Support**
✅ Edge
✅ Chrome
✅ Safari
✅ Firefox

To test sites [protected with HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication), you can pass the `--auth` parameter. It expects an object with a `username` and `password` like so:

```
npx . -u https://newsletter.www.example.com/admin -b safari --auth '{"username": "username", "password": "password"}'
```

## Installation

### NPM dependencies

After checking out the code, you need to install all the dependencies:

```
npm install
```

### Browsers

### Chrome, Firefox, Safari and Chrome Canary

Telescope uses Playwright to control and manage individual browser engines. Telescope will automatically run `npx playwright install` to install Chrome, Firefox, Chrome Canary and Safari (webkit).

Note: Safari for MacOS Tahoe is now available in `playwright@next` version so we use that until it is available on the `@latest` channel.

### Microsoft Edge and Chrome-beta

To install Microsoft Edge or Chrome Beta playwright requires root privileges and will not automatically install them, all you have to do that is to run `npx playwright install msedge chrome-beta` from the command line (and provide root password).

### ffmpeg

Telescope uses `ffmpeg` to process the video and generate filmstrip images. You will need to have it installed on your machine.

For MacOS you can use `homebrew` to install it:

```
brew install ffmpeg
```

## Programmatic Usage

You can run telescope from within a Node.js script:

```javascript
import { launchTest } from '@cloudflare/telescope';

const result = await launchTest({
  url: 'https://example.com',
  browser: 'chrome',
  width: 1920,
  height: 1080,
  timeout: 60000,
});

if (result.success) {
  console.log(`Test completed: ${result.testId}`);
  console.log(`Results saved to: ${result.resultsPath}`);
} else {
  console.error(`Test failed: ${result.error}`);
}
```

All CLI options are supported as object properties. See Parameters section for available options.
