import { log } from './helpers.js';

async function delayUsingFallback(route, request, regexString, delay) {
  return new Promise(resolve => {
    const url = request.url();

    // start fetching right-away, keep the promise
    const responsePromise = route.fetch();

    log(
      `Fetching ${url} (matched /${regexString}/i), but delaying response for ${delay}ms`,
    );

    setTimeout(async () => {
      log(`Fulfilling ${url} after ${delay}ms`);

      // make sure we continue only after request came back
      const response = await responsePromise;

      resolve(route.fulfill({ response }));
    }, delay);
  });
}

async function delayUsingContinue(route, request, regexString, delay) {
  return new Promise((resolve, reject) => {
    const url = request.url();

    log(`Delaying ${url} (matched /${regexString}/i) request for ${delay}ms`);

    setTimeout(() => {
      log(`Continuing ${url} request after ${delay}ms`);

      resolve(route.continue());
    }, delay);
  });
}

// method lookup table
const DELAY_IMPLEMENTATIONS = {
  fallback: delayUsingFallback,
  continue: delayUsingContinue,
};

export { DELAY_IMPLEMENTATIONS };
