'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, fallback } from 'wagmi';
import { defineChain } from 'viem';

// Define Bot Chain Mainnet
export const botChainMainnet = defineChain({
  id: 677,
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.botchain.ai'] },
  },
  blockExplorers: {
    default: { name: 'BotScan', url: 'https://scan.botchain.ai' },
  },
});

export const wagmiConfig = createConfig({
  chains: [botChainMainnet],
  pollingInterval: 15_000, // 15s — reduce background eth_getBlockByNumber spam
  transports: {
    [botChainMainnet.id]: http('https://rpc.botchain.ai', {
      retryCount: 5,
      retryDelay: 2000,
    }),
  },
});


const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
