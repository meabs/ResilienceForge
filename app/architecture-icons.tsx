import type { NodeKind } from './data';

type ArchitectureIconProps = {
  kind: NodeKind;
  className?: string;
};

/* Original neutral glyphs keep the topology legible without borrowing provider artwork. */
export function ArchitectureIcon({ kind, className }: ArchitectureIconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {kind === 'client' && (
        <>
          <rect x="5" y="2.75" width="14" height="18.5" rx="2" />
          <path d="M8.5 5.75h7M10 18.25h4" />
        </>
      )}
      {kind === 'edge' && (
        <>
          <circle cx="12" cy="12" r="2.25" />
          <path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2M4.2 4.2a11 11 0 0 0 0 15.6M19.8 4.2a11 11 0 0 1 0 15.6" />
        </>
      )}
      {kind === 'gateway' && (
        <>
          <path d="M4 20.5h16M6.5 20V6.5L12 3.5l5.5 3V20" />
          <path d="M9.25 20v-6h5.5v6M8.5 9.25h.01M12 9.25h.01M15.5 9.25h.01" />
        </>
      )}
      {kind === 'service' && (
        <>
          <rect x="4" y="4" width="16" height="5" rx="1" />
          <rect x="4" y="15" width="16" height="5" rx="1" />
          <path d="M8 9v6M16 9v6M7.5 6.5h.01M7.5 17.5h.01" />
        </>
      )}
      {kind === 'queue' && (
        <>
          <path d="M5 6h10M5 12h10M5 18h10" />
          <path d="m15 4 4 2.5-4 2.5M15 10l4 2.5-4 2.5M15 16l4 2.5-4 2.5" />
        </>
      )}
      {kind === 'db' && (
        <>
          <ellipse cx="12" cy="5.5" rx="7" ry="3" />
          <path d="M5 5.5v8c0 1.65 3.13 3 7 3s7-1.35 7-3v-8M5 13.5v5c0 1.65 3.13 3 7 3s7-1.35 7-3v-5" />
        </>
      )}
      {kind === 'cache' && (
        <>
          <path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z" />
          <path d="m5.5 7 6.5 4 6.5-4M12 11v10" />
        </>
      )}
      {kind === 'gpu' && (
        <>
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
          <rect x="9.5" y="9.5" width="5" height="5" rx=".75" />
          <path d="M9 2v4M12 2v4M15 2v4M9 18v4M12 18v4M15 18v4M2 9h4M2 12h4M2 15h4M18 9h4M18 12h4M18 15h4" />
        </>
      )}
    </svg>
  );
}
