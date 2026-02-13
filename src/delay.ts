import { log } from './helpers.js';
import type { Route, Request } from 'playwright';

export type DelayMethod = 'fulfill' | 'continue';

export async function delayUsingFulfill(route: Route, request: Request, regexString: string, delay: number) {
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

export async function delayUsingContinue(route: Route, request: Request, regexString: string, delay: number) {
  return new Promise((resolve) => {
    const url = request.url();

    log(`Delaying ${url} (matched /${regexString}/i) request for ${delay}ms`);

    setTimeout(() => {
      log(`Continuing ${url} request after ${delay}ms`);

      resolve(route.continue());
    }, delay);
  });
}
