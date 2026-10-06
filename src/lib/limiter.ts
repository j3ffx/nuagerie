/**
 * Runs at most `max` tasks at a time; the others wait in order. A waiting
 * task whose signal aborts leaves the queue without ever starting.
 */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  function acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const start = () => {
        signal?.removeEventListener('abort', cancel);
        resolve();
      };
      const cancel = () => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal?.reason);
      };
      waiting.push(start);
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }

  function release() {
    // The slot goes straight to the next waiting task, if any.
    const next = waiting.shift();
    if (next) next();
    else active--;
  }

  return async function run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await acquire(signal);
    try {
      return await task();
    } finally {
      release();
    }
  };
}
