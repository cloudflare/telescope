# Browser Agent

A diagnostic, cross-browser performance testing agent.

## What it collects

When you run the agent, it will load the page in the browser you chose and apply any special parameters you have provided. By default, it will store results for the test in a `/results` directory. Each test gets it's own folder with the date prefixed, followed by a unique ID.

In side the test folder, the following files are added:

- `console.json` - Console output from the page to look for warnings, JS errors, etc
- a video file showing the page load progression
- `metrics.json` - A collection of timing metrics collected from the browser during page load
- `pageload.har` - A har file of the page load
- `resources.json` - The resource timing API data for the pagea
- `screenshot.png` - A screenshot of the final page load
- `/filmstrip` - A collection of screenshots during the page load that could be used for a filmstrip

## Parameters

A full list of parameters can be outputted to the terminal by running `npx . --help`. Here's what's currently supported:

```
Options:
  -u, --url <url>               URL to run tests against
  -b, --browser <browser_name>  Browser to tests against (choices: "chrome", "chrome-beta", "canary", "edge", "safari", "firefox", default: "chrome")
  -h, --headers <object>        Any custom headers to apply to requests
  -c, --cookies <object>        Any custom cookies to apply
  -f, --flags <string>          A comma separated list of Chromium flags to launch Chrome with. See: https://peter.sh/experiments/chromium-command-line-switches/
  --blockDomains <domains...>   A comma separated list of domains to block (default: [])
  --block <substrings...>       A comma-delimited list of urls to block (based on a substring match) (default: [])
  --firefoxPrefs <object>       Any Firefox User Preferences to apply (Firefox only)
  --cpuThrottle <int>           CPU throttling factor (Note: mobile emulation will provide its own default)
  --connectionType <string>     Network connection type. (choices: "cable", "dls", "4g", "3g", "3gfast", "3gslow", "2g", "fios", default: "4g")
  --width <int>                 Viewport width, in pixels (default: "1366")
  --height <int>                Viewport height, in pixels (default: "768")
  --disableJS                   Disable JavaScript (default: false)
  --debug                       Output debug lines (default: false)
  --auth <object>               Basic HTTP authentication (Expects: {"username": "", "password":""})  (default: false)
  --timeout <int>               Maximum time (in milliseconds) to wait for test to complete. (default: 30000)
  --html                        Generate HTML report
  --list                        Generate a list of test results as HTML page
  --help                        display help for command
```

### Custom Timeout

You can set a custom timeout by passing the desired timeout in milliseconds using the `--timeout` parameter. Defaults to 30000, or 30 seconds.

```
npx . -u https://timkadlec.com -b chrome --timeout 50000
```

### Setting Custom Cookies

**Browser support**
✅ Edge
✅ Chrome
🚫 Safari
✅ Firefox

You can define custom cookies to be passed along to request when running your test using the `--c` or `--cookies` parameter.

Cookies must have a name and value passed. Optionally, you can also pass in either a URL or a domain and path. If none are passed, the script will default to using the test page url.

#### Set a custom cookie for all requests

```
npx . -u https://timkadlec.com -b chrome -c '{"name": "foo", "value": "bar"}'
```

#### Set multiple cookies for all requests

```
npx . -u https://timkadlec.com -b chrome -c '[{"name": "foo", "value": "bar"}, {"name": "foo2", "value": "bar2"}]'
```

#### Set a custom cookie for only a particular path

```
npx . -u https://timkadlec.com -b chrome -c '{"name": "foo", "value": "bar", "domain":"timkadlec.com", "path":"/optim"}'
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
npx . -u https://newsletter.timkadlec.com/admin -b safari --auth '{"username": "username", "password": "password"}'
```
