'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const BitdrumWalletProvider = dynamic(
  () => import('./BitdrumWalletProvider').then(m => m.BitdrumWalletProvider),
  { ssr: false }
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BitdrumWalletProvider>{children}</BitdrumWalletProvider>
    </QueryClientProvider>
  );
}
