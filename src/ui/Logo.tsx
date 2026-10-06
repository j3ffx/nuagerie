import { useId } from 'react';

/** Provisional logo: a small cloud on a sky tile (same drawing as public/logo.svg). */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd3ff" />
          <stop offset="1" stopColor="#4f9be8" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${gradientId})`} />
      <g fill="#ffffff">
        <circle cx="180" cy="290" r="76" />
        <circle cx="272" cy="252" r="100" />
        <circle cx="350" cy="306" r="62" />
        <rect x="104" y="290" width="306" height="96" rx="48" />
      </g>
    </svg>
  );
}
