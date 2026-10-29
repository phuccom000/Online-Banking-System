"use client";

import React from 'react';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { sepolia, hardhat } from 'wagmi/chains';
// From @wagmi/core: `wagmi/connectors` pulls in every connector (Coinbase, Base, ...) and their missing deps
import { injected } from '@wagmi/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export const config = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
    [hardhat.id]: http(),
  },
});

export type SupportedChainId = (typeof config)['chains'][number]['id'];

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
