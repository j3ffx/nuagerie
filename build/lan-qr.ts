import { networkInterfaces } from 'node:os';
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
        const urls = rankLanUrls(server.resolvedUrls?.network ?? []);
        const [best, ...others] = urls;
        if (!best) {
          console.log(
            '\n  Aucune adresse réseau local trouvée : le PC est-il connecté au Wi-Fi ?\n',
          );
          return;
        }
        const demoUrl = `${best}?demo=1`;
        console.log(`\n  Sur le téléphone (même Wi-Fi), scanne ce QR code : ${demoUrl}`);
        console.log(
          '  Certificat local : accepte l’avertissement une fois (Paramètres avancés → Continuer).\n',
        );
        qrcode.generate(demoUrl, { small: true });
        if (others.length > 0) {
          console.log(
            `  Si la page ne s’ouvre pas, essaie : ${others.map((url) => `${url}?demo=1`).join('  ou  ')}\n`,
          );
        }
      };
    },
  };
}

const PREFERRED = /^(wi-?fi|wlan|wireless|ethernet|eth|en)\b/i;
const VIRTUAL =
  /local area connection\*|vethernet|virtual|vmware|vbox|virtualbox|wsl|hyper-v|docker|tailscale|zerotier|bluetooth|loopback|vpn/i;

/** Real Wi-Fi/Ethernet adapters first, virtual ones (hotspot, WSL, VPN…) last. */
function rankLanUrls(urls: string[]): string[] {
  const interfaceOf = new Map<string, string>();
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) interfaceOf.set(address.address, name);
  }
  const score = (url: string) => {
    const name = interfaceOf.get(new URL(url).hostname) ?? '';
    if (VIRTUAL.test(name)) return 0;
    if (PREFERRED.test(name)) return 2;
    return 1;
  };
  return [...urls].sort((a, b) => score(b) - score(a));
}
