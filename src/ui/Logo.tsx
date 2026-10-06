import { useId } from 'react';

/**
 * Logo: a cloud-shaped window onto a small landscape (sun, hills) on a sky
 * tile — a cloud that holds photos. Same drawing as public/logo.svg, which the
 * build turns into the app icons.
 */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const clipId = useId();
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
        <clipPath id={clipId}>
          <circle cx="180" cy="290" r="76" />
          <circle cx="272" cy="252" r="100" />
          <circle cx="350" cy="306" r="62" />
          <rect x="104" y="290" width="306" height="96" rx="48" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="112" fill="#5aa7ee" />
      <g clipPath={`url(#${clipId})`}>
        <rect x="80" y="140" width="360" height="260" fill="#e6f4ff" />
        <circle cx="318" cy="232" r="34" fill="#ffd166" />
        <path d="M80 340 Q170 270 250 320 T440 300 V400 H80 Z" fill="#7cc0f5" />
        <path d="M80 370 Q220 320 330 360 T440 350 V400 H80 Z" fill="#2f7fd8" />
      </g>
    </svg>
  );
}
