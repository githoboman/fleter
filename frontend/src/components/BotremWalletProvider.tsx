'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { connectBotremWallet, type BotremWallet } from '../utils/botrem';
import { attachWallet, detachWallet, signerAddress } from '../lib/dreamdex/client';

type BotremWalletContextValue = {
  wallet: BotremWallet | null;
  address: string | null;
  username: string | null;
  authenticated: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  openProfile: () => Promise<void>;
};

const BotremWalletContext = createContext<BotremWalletContextValue | null>(null);

export function BotremWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<BotremWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the Botrem signer in step with the wallet state, including after a
  // hot reload re-creates the exchange singleton underneath a connected wallet.
  useEffect(() => {
    if (!wallet) return;
    if (signerAddress()?.toLowerCase() !== wallet.address.toLowerCase()) {
      attachWallet(wallet.walletClient, wallet.address);
    }
  }, [wallet]);

  const connect = async () => {
    if (connecting) {
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const nextWallet = await connectBotremWallet();
      // Same viem walletClient signs Botrem orders, redeems, and faucet calls.
      attachWallet(nextWallet.walletClient, nextWallet.address);
      setWallet(nextWallet);
    } catch (caughtError: any) {
      const raw: string = caughtError?.message || 'Failed to connect wallet';
      setError(
        raw.includes('KeyRing is locked')
          ? 'Your wallet extension is locked (Keplr). Unlock it — or use MetaMask — and connect again.'
          : raw,
      );
      throw caughtError;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!wallet) {
      return;
    }

    try {
      await wallet.disconnect();
    } finally {
      detachWallet();
      setWallet(null);
    }
  };

  const openProfile = async () => {
    if (!wallet) {
      return;
    }

    await wallet.openProfile();
  };

  return (
    <BotremWalletContext.Provider
      value={{
        wallet,
        address: wallet?.address ?? null,
        username: wallet?.label ?? null,
        authenticated: Boolean(wallet),
        connecting,
        error,
        connect,
        disconnect,
        openProfile,
      }}
    >
      {children}
    </BotremWalletContext.Provider>
  );
}

export function useBotremWallet() {
  const context = useContext(BotremWalletContext);

  if (!context) {
    throw new Error('useBotremWallet must be used within BotremWalletProvider');
  }

  return context;
}
