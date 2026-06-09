"use client";

import { ParticleNetworkCanvas } from "./ParticleNetworkCanvas";

/** Subtle particle layer for explorer page */
export function ExplorerParticles() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden opacity-50">
      <ParticleNetworkCanvas density={0.45} interactive={false} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
