import type { ComponentType, SVGProps } from 'react';
import { Link, useLocation } from 'wouter';
import { AlbumsIcon, GridIcon, MapIcon, SettingsIcon } from '../ui/icons.tsx';
import styles from './NavBar.module.css';

interface NavEntry {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isActive: (path: string) => boolean;
}

const ENTRIES: NavEntry[] = [
  {
    href: '/',
    label: 'Albums',
    icon: AlbumsIcon,
    isActive: (path) => path === '/' || path.startsWith('/album'),
  },
  { href: '/tout', label: 'Tout', icon: GridIcon, isActive: (path) => path.startsWith('/tout') },
  { href: '/carte', label: 'Carte', icon: MapIcon, isActive: (path) => path.startsWith('/carte') },
  {
    href: '/reglages',
    label: 'Réglages',
    icon: SettingsIcon,
    isActive: (path) => path.startsWith('/reglages'),
  },
];

export function NavBar() {
  const [path] = useLocation();
  return (
    <nav className={styles.nav} aria-label="Navigation principale" data-bottom-bar>
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
