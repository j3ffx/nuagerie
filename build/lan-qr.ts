import qrcode from 'qrcode-terminal';
import type { Plugin } from 'vite';

/**
 * Prints a QR code of the LAN URL after Vite's own URL banner, so the app can
 * be opened on the phone in one scan. The QR points to demo mode: real data
 * cannot sign in from a LAN IP (see docs/SETUP.md, "Vraies données sur le téléphone").
 */
export function lanQrCode(): Plugin {
  return {
    name: 'nuagerie:lan-qr',
    apply: 'serve',
    configureServer(server) {
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        printUrls();
        const urls = server.resolvedUrls?.network ?? [];
        const url = pickLanUrl(urls);
        if (!url) {
          console.log(
            '\n  Aucune adresse réseau local trouvée : le PC est-il connecté au Wi-Fi ?\n',
          );
          return;
        }
        const demoUrl = `${url}?demo=1`;
        console.log(`\n  Sur le téléphone (même Wi-Fi), scanne ce QR code : ${demoUrl}`);
        console.log(
          '  Certificat local : accepte l’avertissement une fois (Paramètres avancés → Continuer).\n',
        );
        qrcode.generate(demoUrl, { small: true });
      };
    },
  };
}

/** Prefers typical home-network ranges over virtual adapters (WSL, VPN, VirtualBox...). */
function pickLanUrl(urls: string[]): string | undefined {
  const score = (url: string) => {
    const host = new URL(url).hostname;
    if (host.startsWith('192.168.')) return 3;
    if (host.startsWith('10.')) return 2;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return 1;
    return 0;
  };
  return [...urls].sort((a, b) => score(b) - score(a))[0];
}
