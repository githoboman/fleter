'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BitdrumWalletProvider } from './BitdrumWalletProvider';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BitdrumWalletProvider>{children}</BitdrumWalletProvider>
    </QueryClientProvider>
  );
}
