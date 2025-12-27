import crypto from 'crypto';

//simple debug logger
function log(msg) {
  if (process.env.DEBUG_MODE) {
    console.log(msg);
  }
}
function logTimer(msg, end, start) {
  log(`TIMING::${msg} ${(end - start).toFixed(2)} ms`);
}

// generate a unique test ID
function generateTestID() {
  let date_ob = new Date();
  // adjust 0 before single digit date
  let date = ('0' + date_ob.getDate()).slice(-2);
  let month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
  // current year
  let year = date_ob.getFullYear();

  return year + '_' + month + '_' + date + '_' + crypto.randomUUID();
}

export { log, logTimer, generateTestID };
