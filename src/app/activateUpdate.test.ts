import { describe, expect, it } from 'vitest';
import { activateUpdate, RELOAD_FALLBACK_MS, type ActivateDeps } from './activateUpdate.ts';

function setup(waiting: boolean) {
  const sent: unknown[] = [];
  const listeners: (() => void)[] = [];
  const timers: { callback: () => void; ms: number }[] = [];
  let reloads = 0;
  const deps: ActivateDeps = {
    waiting: waiting ? { postMessage: (message: unknown) => void sent.push(message) } : null,
    onControllerChange: (listener) => void listeners.push(listener),
    reload: () => void reloads++,
    setTimeout: (callback, ms) => void timers.push({ callback, ms }),
  };
  return { deps, sent, listeners, timers, reloads: () => reloads };
}

describe('activateUpdate', () => {
  it('asks the waiting version to take over, and reloads once it has', () => {
    const t = setup(true);
    activateUpdate(t.deps);
    expect(t.sent).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(t.reloads()).toBe(0);
    t.listeners.forEach((listener) => listener());
    expect(t.reloads()).toBe(1);
  });

  it('reloads anyway when the browser never says so, and only once', () => {
    const t = setup(true);
    activateUpdate(t.deps);
    expect(t.timers.map((timer) => timer.ms)).toEqual([RELOAD_FALLBACK_MS]);
    t.timers.forEach((timer) => timer.callback());
    t.listeners.forEach((listener) => listener());
    expect(t.reloads()).toBe(1);
  });

  it('reloads at once when nothing is waiting any more', () => {
    const t = setup(false);
    activateUpdate(t.deps);
    expect(t.reloads()).toBe(1);
    expect(t.sent).toEqual([]);
  });
});
