import { exec } from 'child_process';
import playwright from 'playwright-webkit';

// Launch Safari with a random devtools port
const devtoolsPort = 0;
exec(`open -a Safari --args --remote-debugging-port=${devtoolsPort}`);

// Wait for Safari to start up
await new Promise(resolve => setTimeout(resolve, 2000));

// Get the actual devtools port that Safari is using
const actualDevtoolsPort = await new Promise(resolve => {
  const checkPort = () => {
    exec(`lsof -iTCP:${devtoolsPort} -sTCP:LISTEN -Fn`).stdout.on(
      'data',
      data => {
        if (data.toString().indexOf('WebKit') !== -1) {
          const port = parseInt(data.toString().replace('nlocalhost:', ''));
          resolve(port);
        } else {
          setTimeout(checkPort, 100);
        }
      },
    );
  };
  checkPort();
});

// Connect to the DevTools Protocol endpoint and launch a persistent context
const browser = await playwright.webkit.connect({
  wsEndpoint: `ws://localhost:${actualDevtoolsPort}/devtools/browser/<WebKitInstanceID>`,
});
const context = await browser.newContext({});

// Create a new page in the context
const page = await context.newPage();

// Listen to all DevTools protocol messages and log them out
page.on('response', response => {
  console.log(`Received DevTools protocol message:`, response);
});

// Navigate to a URL and wait for the page to load
await page.goto('https://www.example.com');
await page.waitForLoadState();

// ...

// Close the context and the browser
await context.close();
await browser.close();

// Kill the Safari process
exec(`killall Safari`);
