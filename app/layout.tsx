import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Resilience Forge — Architecture operations bench',
  description:
    'Choose a reference architecture, stress the live bench, and watch human decisions and WebMCP remediation meet in one state.',
};

const directionContract = `<!-- THESIS: One live operations bench makes human constraints and WebMCP remediation legible together; it refuses the dashboard wall and the pretend assistant. OWN-WORLD: Graphite track surfaces, acid telemetry marks, safety orange intervention flags, Plex typography, and state marks that survive reduced motion. STORY: Choose a reference, stress it, change a normal control, then read the stale-state recovery in the graph and FDR. FIRST VIEWPORT: Three equal reference cards on the Catalogue; the Bench puts the topology and packet motion in a 70% canvas with a 30% scenario rail, with the primary action above the fold. FORM: racing league telemetry fused with a film cutting bench's state-as-mark discipline; seed 6a23d1d3. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable}`}>
        <div
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
        {children}
      </body>
    </html>
  );
}
