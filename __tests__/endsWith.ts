import {expect} from '@jest/globals';
import type {MatcherFunction} from 'expect';

const endsWith: MatcherFunction<[ending: unknown]> =
  function (theString, ending) {
    if (typeof theString !== 'string' || typeof ending !== 'string') {
      throw new TypeError('Parameters must be strings!');
    }

    const rx = new RegExp(ending.concat('$'));

    if ((rx).test(theString)) {
      return {
        message: () => `Expected ${this.utils.printReceived(theString)}
          to not end with ${this.utils.printExpected(ending)}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${this.utils.printReceived(theString)}
          to end with ${this.utils.printExpected(ending)}`,
        pass: false
      };
    }
  };

expect.extend({ endsWith });

declare module 'expect' {
  interface Matchers<R> {
    endsWith(ending: string): R;
  }
}
