import { describe, expect, it } from 'vitest';
import { movedTo } from './home.ts';

const HOME = 'https://nuagerie.app';

describe('movedTo', () => {
  it('sends the first address to the new one, page and query kept', () => {
    expect(movedTo('https://nuagerie.pages.dev/?demo=1', HOME)).toBe(
      'https://nuagerie.app/?demo=1',
    );
    expect(movedTo('https://nuagerie.pages.dev/confidentialite', `${HOME}/`)).toBe(
      'https://nuagerie.app/confidentialite',
    );
  });

  it('moves nothing without a new address', () => {
    expect(movedTo('https://nuagerie.pages.dev/', undefined)).toBeNull();
    expect(movedTo('https://nuagerie.pages.dev/', '')).toBeNull();
    expect(movedTo('https://nuagerie.pages.dev/', 'not a url')).toBeNull();
  });

  it('never moves the new address itself, previews of branches, nor development', () => {
    expect(movedTo('https://nuagerie.app/reglages', HOME)).toBeNull();
    expect(movedTo('https://m13.nuagerie.pages.dev/', HOME)).toBeNull();
    expect(movedTo('http://localhost:5173/', HOME)).toBeNull();
    expect(movedTo('https://192.168.1.20:5173/', HOME)).toBeNull();
  });
});
