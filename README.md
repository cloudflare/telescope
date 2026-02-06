# Telescope

A diagnostic, cross-browser performance testing CLI.

## Quick Start

```bash
# Install
npm install @cloudflare/telescope

# Run a test
npx telescope -u https://example.com

# Run with HTML report
npx telescope -u https://example.com --html --openHtml
```

## Installation

### Prerequisites

- Node.js 20+
- ffmpeg

### Install ffmpeg

**macOS:**

```bash
brew install ffmpeg
```

**Linux (Debian/Ubuntu):**

```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

### Install Browsers

Telescope uses Playwright to control browsers. Core browsers are installed automatically:

```bash
# Installed automatically via postinstall
npx playwright install  # Chrome, Firefox, Safari (WebKit)
```

For additional browsers (requires elevated privileges):

```bash
# Microsoft Edge and Chrome Beta
npx playwright install msedge chrome-beta

# Chrome Canary - must be installed manually
# Download from: https://www.google.com/chrome/canary/
```

## Usage

Run a performance test against any URL:

```bash
npx telescope -u https://example.com -b chrome
```

### What It Collects

Each test creates a timestamped folder in `./results/` containing:

| File             | Description                                         |
| ---------------- | --------------------------------------------------- |
| `metrics.json`   | Navigation timing, paint timing, LCP, layout shifts |
| `pageload.har`   | HAR file of all network requests                    |
| `resources.json` | Resource Timing API data                            |
| `console.json`   | Console output (warnings, errors, logs)             |
| `screenshot.png` | Final page screenshot                               |
| `filmstrip/`     | Frame-by-frame screenshots of page load             |
| `*.webm`         | Video recording of page load                        |

### CLI Options

```
Options:
  -u, --url <url>               URL to test (required)
  -b, --browser <name>          Browser to use (default: "chrome")
                                Choices: chrome, chrome-beta, canary, edge, safari, firefox
  -h, --headers <json>          Custom headers as JSON object
  -c, --cookies <json>          Custom cookies as JSON object or array
  -f, --flags <string>          Comma-separated Chromium flags
  --blockDomains <domains...>   Domains to block
  --block <substrings...>       URL substrings to block
  --overrideHost <json>         Host overrides: {"from": "to"}
  --firefoxPrefs <json>         Firefox user preferences (Firefox only)
  --cpuThrottle <factor>        CPU throttling multiplier
  --connectionType <type>       Network throttling preset
                                Choices: cable, dsl, 4g, 3g, 3gfast, 3gslow, 2g, fios
  --width <pixels>              Viewport width (default: 1366)
  --height <pixels>             Viewport height (default: 768)
  --frameRate <fps>             Filmstrip capture rate (default: 1)
  --timeout <ms>                Test timeout in milliseconds (default: 30000)
  --disableJS                   Disable JavaScript execution
  --debug                       Enable debug output
  --auth <json>                 HTTP Basic Auth: {"username": "", "password": ""}
  --html                        Generate HTML report
  --openHtml                    Open HTML report in browser (requires --html)
  --list                        Generate HTML list of all results
  --zip                         Zip the test results
  --dry                         Dry run (save config only, no test)
  --help                        Show help
```

### Examples

#### Basic test with Chrome

```bash
npx telescope -u https://example.com
```

#### Test with a different browser

```bash
npx telescope -u https://example.com -b firefox
npx telescope -u https://example.com -b safari
```

#### Custom viewport and timeout

```bash
npx telescope -u https://example.com --width 1920 --height 1080 --timeout 60000
```

#### Network throttling (simulate 3G)

```bash
npx telescope -u https://example.com --connectionType 3g
```

#### Block third-party domains

```bash
npx telescope -u https://example.com --blockDomains analytics.com ads.example.com
```

#### Custom headers

```bash
npx telescope -u https://example.com -h '{"Authorization": "Bearer token123"}'
```

#### Custom cookies

```bash
# Single cookie
npx telescope -u https://example.com -c '{"name": "session", "value": "abc123"}'

# Multiple cookies
npx telescope -u https://example.com -c '[{"name": "a", "value": "1"}, {"name": "b", "value": "2"}]'
```

#### HTTP Basic Authentication

```bash
npx telescope -u https://protected.example.com --auth '{"username": "user", "password": "pass"}'
```

#### Generate HTML report

```bash
npx telescope -u https://example.com --html --openHtml
```

#### Test with JavaScript disabled

```bash
npx telescope -u https://example.com --disableJS
```

### Browser Support Matrix

| Feature        | Chrome | Chrome Beta | Canary | Edge | Firefox | Safari |
| -------------- | ------ | ----------- | ------ | ---- | ------- | ------ |
| Basic tests    | Yes    | Yes         | Yes    | Yes  | Yes     | Yes    |
| HTML reports   | Yes    | Yes         | Yes    | Yes  | Yes     | Yes    |
| Custom cookies | Yes    | Yes         | Yes    | Yes  | Yes     | No     |
| Chromium flags | Yes    | Yes         | Yes    | Yes  | No      | No     |
| Firefox prefs  | No     | No          | No     | No   | Yes     | No     |

## Programmatic Usage

Use Telescope from Node.js:

```typescript
import { launchTest } from '@cloudflare/telescope';

const result = await launchTest({
  url: 'https://example.com',
  browser: 'chrome',
  width: 1920,
  height: 1080,
  timeout: 60000,
  html: true,
});

if (result.success) {
  console.log(`Test completed: ${result.testId}`);
  console.log(`Results saved to: ${result.resultsPath}`);
} else {
  console.error(`Test failed: ${result.error}`);
}
```

All CLI options are available as object properties.

## License

Apache-2.0
