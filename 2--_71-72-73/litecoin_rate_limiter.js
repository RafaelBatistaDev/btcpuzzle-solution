/**
 * Rate limiter compartilhado entre litecoin_p2pkh e litecoin_p2sh.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class GlobalRateLimiter {
  constructor(delayMs = 1200) {
    this._delayMs = delayMs;
    this._queue = Promise.resolve();
  }

  schedule(fn) {
    const result = this._queue.then(() => fn());
    this._queue = result
      .catch(() => {})
      .then(() => sleep(this._delayMs));
    return result;
  }

  setDelay(ms) {
    this._delayMs = ms;
  }
}

export const globalLimiter = new GlobalRateLimiter(800);

export function initLimiterDelay(ms) {
  globalLimiter.setDelay(ms);
}
