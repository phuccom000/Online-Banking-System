"use client";

import { AlertTriangle, FastForward, FlaskConical } from 'lucide-react';
import { useAccount } from 'wagmi';
import { Bank, fmtDate } from '../lib/bank';

const JUMPS = [
  { label: '+1h', seconds: 3600 },
  { label: '+1d', seconds: 86400 },
  { label: '+7d', seconds: 7 * 86400 },
  { label: '+30d', seconds: 30 * 86400 },
];

export function DemoBanner({ bank, supportedChain }: { bank: Bank; supportedChain: boolean }) {
  const { isConnected } = useAccount();

  if (bank.mode === 'live') return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5 text-violet-200">
        {isConnected && !supportedChain ? (
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
        ) : (
          <FlaskConical size={16} className="mt-0.5 shrink-0" />
        )}
        <span>
          <span className="font-medium text-white">Demo mode</span> — simulated contracts with the same rules as SavingCore.{' '}
          {isConnected && !supportedChain
            ? 'Switch your wallet to Sepolia or Hardhat Local to use the real contracts.'
            : 'Connect a wallet on Sepolia or Hardhat Local to go live.'}
        </span>
      </div>
      {bank.timeTravel && (
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-1 text-xs text-slate-400 lg:flex">
            <FastForward size={13} /> {fmtDate(bank.now)}
          </span>
          {JUMPS.map((j) => (
            <button
              key={j.label}
              onClick={() => bank.timeTravel!(j.seconds)}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-violet-400/40 hover:bg-violet-400/10"
            >
              {j.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
