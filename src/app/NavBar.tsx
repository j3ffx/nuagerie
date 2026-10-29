import type { ComponentType, SVGProps } from 'react';
import { Link, useLocation } from 'wouter';
import { AlbumsIcon, GridIcon, MapIcon, SearchIcon, SettingsIcon } from '../ui/icons.tsx';
import styles from './NavBar.module.css';
import { localized } from '../lib/i18n.ts';

const t = localized({
  fr: {
    albums: 'Albums',
    all: 'Tout',
    map: 'Carte',
    search: 'Recherche',
    settings: 'Réglages',
    nav: 'Navigation principale',
  },
  en: {
    albums: 'Albums',
    all: 'All',
    map: 'Map',
    search: 'Search',
    settings: 'Settings',
    nav: 'Main navigation',
  },
});

interface NavEntry {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isActive: (path: string) => boolean;
}

const ENTRIES: NavEntry[] = [
  {
    href: '/',
    label: t.albums,
    icon: AlbumsIcon,
    isActive: (path) => path === '/' || path.startsWith('/album') || path === '/souvenirs',
  },
  { href: '/tout', label: t.all, icon: GridIcon, isActive: (path) => path.startsWith('/tout') },
  { href: '/carte', label: t.map, icon: MapIcon, isActive: (path) => path.startsWith('/carte') },
  {
    href: '/recherche',
    label: t.search,
    icon: SearchIcon,
    isActive: (path) => path.startsWith('/recherche'),
  },
  {
    href: '/reglages',
    label: t.settings,
    icon: SettingsIcon,
    isActive: (path) => path.startsWith('/reglages'),
  },
];

export function NavBar() {
  const [path] = useLocation();
  return (
    <nav className={styles.nav} aria-label={t.nav} data-bottom-bar>
      <ul className={styles.list}>
        {ENTRIES.map(({ href, label, icon: IconComponent, isActive }) => {
          const active = isActive(path);
          return (
            <li key={href}>
              <Link
                href={href}
                className={styles.link}
                aria-current={active ? 'page' : undefined}
                data-active={active || undefined}
              >
                <span className={styles.pill}>
                  <IconComponent />
                </span>
                <span className={styles.label}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
