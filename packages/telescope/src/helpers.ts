import crypto from 'crypto';

/**
 * Simple debug logger that only logs when DEBUG_MODE is set
 */
export function log(msg: unknown): void {
  if (process.env.DEBUG_MODE) {
    console.log(msg);
  }
}

/**
 * Log timing information when in debug mode
 */
export function logTimer(msg: string, end: number, start: number): void {
  log(`TIMING::${msg} ${(end - start).toFixed(2)} ms`);
}

/**
 * Generate a unique test ID with timestamp and UUID
 */
export function generateTestID(): string {
  const date_ob = new Date();
  // adjust 0 before single digit value
  const date = ('0' + date_ob.getDate()).slice(-2);
  const month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
  const year = date_ob.getFullYear();
  const hour = ('0' + date_ob.getHours()).slice(-2);
  const minute = ('0' + date_ob.getMinutes()).slice(-2);
  const second = ('0' + date_ob.getSeconds()).slice(-2);

  return (
    year +
    '_' +
    month +
    '_' +
    date +
    '_' +
    hour +
    '_' +
    minute +
    '_' +
    second +
    '_' +
    crypto.randomUUID()
  );
}
