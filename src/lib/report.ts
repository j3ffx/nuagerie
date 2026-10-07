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
  return 'système inconnu';
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
  return 'navigateur inconnu';
}

/**
 * Link to a new GitHub issue, filled in with what helps to understand a
 * problem: version, data source, system, browser. Nothing personal (no
 * account, folder or photo name): the issue is public.
 */
export function issueUrl(context: ReportContext): string {
  const body = [
    '**Ce qui s’est passé**',
    '',
    '',
    '**Ce qui était attendu**',
    '',
    '',
    '**Pour reproduire**',
    '1. ',
    '',
    '---',
    `Version : ${context.version}${context.commit ? ` (${context.commit})` : ''}`,
    `Données : ${context.mode === 'demo' ? 'démo' : 'OneDrive'}`,
    `Appareil : ${systemOf(context.userAgent)} · ${browserOf(context.userAgent)} · ${
      context.installed ? 'application installée' : 'onglet du navigateur'
    } · écran de ${context.screenWidth} px`,
  ].join('\n');
  return `${REPOSITORY_URL}/issues/new?${new URLSearchParams({ body }).toString()}`;
}
