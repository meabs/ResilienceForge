import type { NodeKind } from './data';

type ArchitectureIconProps = {
  kind: NodeKind;
  className?: string;
};

/* Original neutral glyphs keep the topology legible without borrowing provider artwork. */
export function ArchitectureIcon({ kind, className }: ArchitectureIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {kind === 'client' && (
        <>
          <rect x="5" y="2.5" width="14" height="19" rx="2" />
          <path d="M8.5 5.5h7M9.75 18.35h4.5" />
        </>
      )}
      {kind === 'edge' && (
        <>
          <circle cx="12" cy="12" r="2.4" />
          <path d="M7.2 7.2a6.8 6.8 0 0 0 0 9.6M16.8 7.2a6.8 6.8 0 0 1 0 9.6M3.9 3.9a11.4 11.4 0 0 0 0 16.2M20.1 3.9a11.4 11.4 0 0 1 0 16.2" />
        </>
      )}
      {kind === 'gateway' && (
        <>
          <path d="M3.75 20.5h16.5M6.25 20V6.4L12 3.25l5.75 3.15V20" />
          <path d="M9.2 20v-6.1h5.6V20M8.4 9.1h.02M12 9.1h.02M15.6 9.1h.02" />
        </>
      )}
      {kind === 'service' && (
        <>
          <rect x="3.75" y="3.75" width="16.5" height="5.25" rx="1" />
          <rect x="3.75" y="15" width="16.5" height="5.25" rx="1" />
          <path d="M8 9v6M16 9v6M7.25 6.4h.02M7.25 17.6h.02" />
        </>
      )}
      {kind === 'queue' && (
        <>
          <path d="M4.5 6h10.25M4.5 12h10.25M4.5 18h10.25" />
          <path d="m15 3.85 4.75 2.15-4.75 2.15M15 9.85 19.75 12 15 14.15M15 15.85l4.75 2.15-4.75 2.15" />
        </>
      )}
      {kind === 'db' && (
        <>
          <ellipse cx="12" cy="5.4" rx="7.25" ry="3.05" />
          <path d="M4.75 5.4v8.1c0 1.7 3.25 3.1 7.25 3.1s7.25-1.4 7.25-3.1V5.4M4.75 13.5v5.1c0 1.7 3.25 3.1 7.25 3.1s7.25-1.4 7.25-3.1v-5.1" />
        </>
      )}
      {kind === 'cache' && (
        <>
          <path d="m12 2.75 7.25 4.15v10.2L12 21.25l-7.25-4.15V6.9L12 2.75Z" />
          <path d="m5.2 7.15 6.8 3.9 6.8-3.9M12 11.05v10.2" />
        </>
      )}
      {kind === 'gpu' && (
        <>
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
          <rect x="9.25" y="9.25" width="5.5" height="5.5" rx=".8" />
          <path d="M9 2.25v3.75M15 2.25v3.75M9 18v3.75M15 18v3.75M2.25 9h3.75M2.25 15h3.75M18 9h3.75M18 15h3.75" />
        </>
      )}
    </svg>
  );
}
