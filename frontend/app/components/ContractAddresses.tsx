"use client";

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { Check, Copy, ExternalLink, FileCode2 } from 'lucide-react';
import { CHAIN_NAMES, CONTRACTS, EXPLORERS } from '../../config/contracts';
import type { Bank } from '../lib/bank';
import { Badge, Card } from './ui';

function AddressRow({ name, role, address, explorer }: { name: string; role: string; address: string; explorer?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address is still selectable */
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-xs text-slate-500">{role}</p>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <code className="min-w-0 truncate rounded-md bg-black/30 px-2 py-1 font-mono text-xs text-slate-300 select-all">{address}</code>
        <button
          onClick={copy}
          title="Copy address"
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
        {explorer && (
          <a
            href={`${explorer}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            title="View on block explorer"
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

/** Shows which deployed contracts the app talks to, so anyone can verify them on-chain. */
export function ContractAddresses({ bank }: { bank: Bank }) {
  const { chainId } = useAccount();
  // Live mode: the connected chain. Demo mode: show the public Sepolia deployment for reference.
  const shownChain = bank.mode === 'live' && chainId && CONTRACTS[chainId] ? chainId : sepolia.id;
  const c = CONTRACTS[shownChain];
  const explorer = EXPLORERS[shownChain];
  if (!c) return null;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <FileCode2 size={18} className="text-emerald-400" /> Contract addresses
        </h2>
        <Badge tone={bank.mode === 'live' ? 'emerald' : 'slate'}>
          {CHAIN_NAMES[shownChain]}
          {bank.mode === 'demo' && ' · reference (demo is simulated)'}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2">
        <AddressRow name="SavingCore" role="Plans, deposits, ERC-721 certificates · holds users' principal" address={c.savingCore} explorer={explorer} />
        <AddressRow name="VaultManager" role="Interest pool, fee receiver, pause · holds the bank's money" address={c.vaultManager} explorer={explorer} />
        <AddressRow name="MockUSDC" role="6-decimal test token" address={c.usdc} explorer={explorer} />
      </div>
    </Card>
  );
}
