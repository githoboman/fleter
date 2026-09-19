'use client';

import React, { useState } from 'react';
import { PriceChart } from './PriceChart';
import { TradePanel } from './TradePanel';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Panel, Eyebrow } from './ObsidianPrimitives';
import { useBotremMarkets } from '../hooks/useBotremMarkets';

export const TradingDashboard = () => {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isWalletPending } = useConnect();
  const [cadence, setCadence] = useState<60 | 300>(300);
  const [isConnecting, setIsConnecting] = React.useState(false);

  const handleConnect = async () => {
    if (isConnecting || isWalletPending) return;
    setIsConnecting(true);
    try { await connect({ connector: injected() }); } 
    catch (e) { console.warn('Connect error:', e); }
    finally { setIsConnecting(false); }
  };
  
  // Use our new native hooks for BOT Chain
  const { markets, positions } = useBotremMarkets();

  return (
    <div id="live-markets" className="relative space-y-6">
      
      {/* Top Header / Account Info */}
      <div className="flex justify-end mb-4">
        {!isConnected ? (
          <button 
            onClick={handleConnect} 
            disabled={isConnecting || isWalletPending}
            className="rounded-full bg-[var(--accent-gold)] px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
          >
            {isConnecting || isWalletPending ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="rounded-full border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-[var(--text-secondary)]">
            Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Chart */}
        <div className="flex flex-col gap-6 min-w-0">
          <PriceChart 
            asset="BTC"
            recentExecutions={[]} 
            tradeMarkers={[]} 
          />
          
          {/* Active Markets / Positions Summary */}
          <Panel className="p-5">
            <Eyebrow accent="neutral">Live Markets on BOT Chain</Eyebrow>
            <div className="mt-4 space-y-3">
              {markets.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No active markets found.</p>
              ) : (
                markets.map(m => (
                  <div key={m.id.toString()} className="flex justify-between rounded-xl bg-[rgba(255,255,255,0.02)] p-4 border border-[var(--border-subtle)]">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-[var(--accent-gold)]">Market #{m.id.toString()}</span>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">Duration: {Number(m.duration) / 60}m</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest">State</span>
                      <p className={`text-sm font-bold ${m.state === 0 ? 'text-[var(--state-up)]' : m.state === 1 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                        {m.state === 0 ? 'OPEN' : m.state === 1 ? 'LOCKED' : 'SETTLED'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        {/* Right Column: Trading Panel */}
        <div className="flex flex-col gap-6">
          <TradePanel 
            cadence={cadence}
            onCadenceChange={setCadence}
            onTradeSubmitted={(r) => console.log('Trade submitted', r)}
          />
        </div>
      </div>
    </div>
  );
};
