import { localized } from './i18n.ts';

const t = localized({
  fr: {
    unknownSystem: 'système inconnu',
    unknownBrowser: 'navigateur inconnu',
    happened: '**Ce qui s’est passé**',
    expected: '**Ce qui était attendu**',
    steps: '**Pour reproduire**',
    version: 'Version',
    data: 'Données',
    demo: 'démo',
    device: 'Appareil',
    installed: 'application installée',
    tab: 'onglet du navigateur',
    screen: (width: number) => `écran de ${width} px`,
    colon: ' : ',
  },
  en: {
    unknownSystem: 'unknown system',
    unknownBrowser: 'unknown browser',
    happened: '**What happened**',
    expected: '**What was expected**',
    steps: '**To reproduce**',
    version: 'Version',
    data: 'Data',
    demo: 'demo',
    device: 'Device',
    installed: 'installed app',
    tab: 'browser tab',
    screen: (width: number) => `${width} px screen`,
    colon: ': ',
  },
});
/** Public home of the project, where problems are reported. */
export const REPOSITORY_URL = 'https://github.com/j3ffx/nuagerie';

export interface ReportContext {
  version: string;
  commit: string;
  mode: 'demo' | 'onedrive';
  userAgent: string;
  /** Opened as the installed app rather than in a browser tab. */
  installed: boolean;
  screenWidth: number;
}

/** "Android 14", "Windows", "iOS 18"…: the system, without the device model. */
function systemOf(ua: string): string {
  const android = /Android (\d+)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  const ios = /(?:iPhone|iPad).*? OS (\d+)/.exec(ua);
  if (ios) return `iOS ${ios[1]}`;
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return t.unknownSystem;
}

/** "Chrome 141", "Samsung Internet 28", "Firefox 143"…: the browser and its major version. */
function browserOf(ua: string): string {
  const known: [RegExp, string][] = [
    [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
    [/Edg(?:A|iOS)?\/(\d+)/, 'Edge'],
    [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
    [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
    [/Version\/(\d+).*Safari/, 'Safari'],
  ];
  for (const [pattern, name] of known) {
    const match = pattern.exec(ua);
    if (match) return `${name} ${match[1]}`;
  }
  return t.unknownBrowser;
}

/**
 * Link to a new GitHub issue, filled in with what helps to understand a
 * problem: version, data source, system, browser. Nothing personal (no
 * account, folder or photo name): the issue is public.
 */
export function issueUrl(context: ReportContext): string {
  const body = [
    t.happened,
    '',
    '',
    t.expected,
    '',
    '',
    t.steps,
    '1. ',
    '',
    '---',
    `${t.version}${t.colon}${context.version}${context.commit ? ` (${context.commit})` : ''}`,
    `${t.data}${t.colon}${context.mode === 'demo' ? t.demo : 'OneDrive'}`,
    `${t.device}${t.colon}${systemOf(context.userAgent)} · ${browserOf(context.userAgent)} · ${
      context.installed ? t.installed : t.tab
    } · ${t.screen(context.screenWidth)}`,
  ].join('\n');
  return `${REPOSITORY_URL}/issues/new?${new URLSearchParams({ body }).toString()}`;
}
