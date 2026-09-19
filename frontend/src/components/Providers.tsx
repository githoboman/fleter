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
  transports: {
    // Fallback cycles through RPCs automatically if one rate-limits
    [botChainMainnet.id]: fallback([
      http('https://rpc.botchain.ai'),
      http('https://rpc-1.botchain.ai'),
      http('https://rpc2.botchain.ai'),
    ], { rank: false }),
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
