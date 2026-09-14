'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const BotremWalletProvider = dynamic(
  () => import('./BotremWalletProvider').then(m => m.BotremWalletProvider),
  { ssr: false }
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BotremWalletProvider>{children}</BotremWalletProvider>
    </QueryClientProvider>
  );
}
