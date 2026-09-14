'use client';

import dynamic from 'next/dynamic';
import { SparklesCore } from './ui/sparkles';

const EpicLandingPage = dynamic(
  () => import('./EpicLandingPage').then(m => ({ default: m.EpicLandingPage })),
  { ssr: false }
);

export function LandingRoot() {
  return (
    <main className="relative bg-black text-[var(--text-primary)] overflow-x-hidden w-full h-screen">
      <div className="w-full absolute inset-0 h-screen">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={100}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>
      <div className="relative z-10 min-h-screen">
        <EpicLandingPage />
      </div>
    </main>
  );
}
