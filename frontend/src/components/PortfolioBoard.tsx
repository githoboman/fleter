'use client';
import React from 'react';
import { Panel, Eyebrow } from './ObsidianPrimitives';

export const PortfolioBoard = () => {
  return (
    <Panel className="p-8 text-center">
      <Eyebrow accent="gold">Portfolio</Eyebrow>
      <h2 className="mt-4 text-2xl font-bold font-heading text-[var(--text-primary)]">Coming Soon</h2>
      <p className="mt-2 text-[var(--text-secondary)]">Portfolio management for BOT Chain is under construction.</p>
    </Panel>
  );
};
