/**
 * Type declarations for @sitespeed.io/throttle
 * This package has no official TypeScript types
 */

declare module '@sitespeed.io/throttle' {
  export interface ThrottleOptions {
    up: number;
    down: number;
    rtt: number;
  }

  export function start(options: ThrottleOptions): Promise<void>;
  export function stop(): Promise<void>;
}
