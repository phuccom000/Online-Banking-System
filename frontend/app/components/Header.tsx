"use client";

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { AlertTriangle, Check, ChevronDown, Droplets, Landmark, LayoutDashboard, LogOut, Wallet } from 'lucide-react';
import { CHAIN_NAMES, CONTRACTS } from '../../config/contracts';
import { Bank, fmtUsdc, shortAddr } from '../lib/bank';
import type { Notify } from '../lib/events';
import type { SupportedChainId } from '../providers';
import { Button } from './ui';

export type View = 'user' | 'admin';

function Emblem() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <defs>
        <linearGradient id="apex-g" x1="0" y1="0" x2="34" y2="34">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="32" height="32" rx="10" fill="url(#apex-g)" fillOpacity="0.14" stroke="url(#apex-g)" strokeOpacity="0.6" />
      <path d="M9 23.5 17 9l8 14.5" stroke="url(#apex-g)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 18.5h9" stroke="url(#apex-g)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Header({
  bank,
  supportedChain,
  view,
  onViewChange,
  notify,
}: {
  bank: Bank;
  supportedChain: boolean;
  view: View;
  onViewChange: (v: View) => void;
  notify: Notify;
}) {
  const { isConnected, address, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onConnect = () => {
    const connector = connectors[0];
    if (!connector) return notify({ kind: 'error', title: 'No wallet found', body: 'Install MetaMask, or keep exploring in demo mode.' });
    connect(
      { connector },
      { onError: (e) => notify({ kind: 'error', title: 'Could not connect', body: e.message.split('\n')[0] }) }
    );
  };

  const tabs: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'user', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin', label: 'Bank Admin', icon: Landmark },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Emblem />
          <div className="leading-tight">
            <p className="font-semibold tracking-tight text-white">Apex Vault Bank</p>
            <p className="text-[11px] text-slate-500">On-chain term deposits</p>
          </div>
        </div>

        {/* View toggle */}
        <nav className="order-last flex w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 md:order-none md:ml-6 md:w-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition md:flex-none ${
                view === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => bank.actions.mint()}
            disabled={!!bank.pending || (isConnected && !supportedChain)}
            title="Mint 1,000 MockUSDC"
          >
            <Droplets size={15} className="text-cyan-300" />
            <span className="hidden sm:inline">Faucet</span>
          </Button>

          {isConnected && address ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 text-sm transition hover:bg-white/10"
              >
                <span
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${
                    supportedChain ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {supportedChain ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> : <AlertTriangle size={12} />}
                  {supportedChain ? CHAIN_NAMES[chainId!] : 'Wrong network'}
                </span>
                <span className="hidden tabular-nums text-slate-300 sm:inline">{fmtUsdc(bank.usdcBalance)} USDC</span>
                <span className="font-mono text-slate-100">{shortAddr(address)}</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-panel py-1 shadow-2xl">
                  <p className="px-3.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Network</p>
                  {Object.keys(CONTRACTS).map(Number).map((id) => (
                    <button
                      key={id}
                      onClick={() => {
                        setMenuOpen(false);
                        switchChain({ chainId: id as SupportedChainId }, { onError: (e) => notify({ kind: 'error', title: 'Network switch failed', body: e.message.split('\n')[0] }) });
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                    >
                      {CHAIN_NAMES[id]}
                      {id === chainId && <Check size={14} className="text-emerald-400" />}
                    </button>
                  ))}
                  <div className="my-1 border-t border-white/10" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      disconnect();
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-rose-300 hover:bg-white/5"
                  >
                    <LogOut size={14} /> Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <span className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums text-slate-300 lg:inline">
                {fmtUsdc(bank.usdcBalance)} USDC
              </span>
              <Button size="sm" onClick={onConnect} loading={connecting}>
                {!connecting && <Wallet size={15} />} Connect Wallet
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
