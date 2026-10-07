import { describe, expect, it } from 'vitest';
import { issueUrl, REPOSITORY_URL } from './report.ts';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0';

const bodyOf = (url: string) => new URL(url).searchParams.get('body') ?? '';

describe('issueUrl', () => {
  const context = {
    version: '0.1.0',
    commit: 'abc1234',
    mode: 'onedrive' as const,
    userAgent: ANDROID_CHROME,
    installed: true,
    screenWidth: 360,
  };

  it('opens a new issue on the project, with the version and the device', () => {
    const url = issueUrl(context);
    expect(url.startsWith(`${REPOSITORY_URL}/issues/new?`)).toBe(true);
    const body = bodyOf(url);
    expect(body).toContain('Version : 0.1.0 (abc1234)');
    expect(body).toContain('Données : OneDrive');
    expect(body).toContain(
      'Appareil : Android 10 · Chrome 141 · application installée · écran de 360 px',
    );
  });

  it('names the browser, not the device model', () => {
    const body = bodyOf(issueUrl({ ...context, userAgent: SAMSUNG, mode: 'demo' }));
    expect(body).toContain('Android 14 · Samsung Internet 28');
    expect(body).not.toContain('SM-S921B');
    expect(body).toContain('Données : démo');
    expect(bodyOf(issueUrl({ ...context, userAgent: WINDOWS_EDGE, installed: false }))).toContain(
      'Windows · Edge 141 · onglet du navigateur',
    );
  });
});
