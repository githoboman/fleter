'use client';

import dynamic from 'next/dynamic';

// Canvas and motion components need browser APIs — client-only
const EpicLandingPage = dynamic(
  () => import('./EpicLandingPage').then(m => ({ default: m.EpicLandingPage })),
  { ssr: false }
);
const ParticleField = dynamic(
  () => import('./ParticleField').then(m => ({ default: m.ParticleField })),
  { ssr: false }
);
const LiveCandleBackground = dynamic(
  () => import('./LiveCandleBackground').then(m => ({ default: m.LiveCandleBackground })),
  { ssr: false }
);

export function LandingRoot() {
  return (
    <main className="relative bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden">
      <LiveCandleBackground />
      <ParticleField />
      <div className="relative z-10">
        <EpicLandingPage />
      </div>
    </main>
  );
}
