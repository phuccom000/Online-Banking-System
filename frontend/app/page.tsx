"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Coins, Layers, Percent } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { DemoBanner } from './components/DemoBanner';
import { EarlyWithdrawModal, RenewModal } from './components/DepositModals';
import { Header, View } from './components/Header';
import { MyDeposits } from './components/MyDeposits';
import { OpenDepositModal } from './components/OpenDepositModal';
import { PlanCatalog } from './components/PlanCatalog';
import { Toast, Toasts } from './components/Toasts';
import { Deposit, depositInterest, DepositStatus, fmtBps, fmtUsdc, Plan } from './lib/bank';
import type { Notify } from './lib/events';
import { useBank } from './lib/useBank';

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify: Notify = useCallback(
    (t) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === 'error' ? 8000 : 5000);
    },
    [dismiss]
  );
  return { toasts, notify, dismiss };
}

function SummaryTile({ icon: Icon, label, value, accent }: { icon: typeof Coins; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-md">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon size={13} /> {label}
      </p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl ${accent ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>('user');
  const [openPlan, setOpenPlan] = useState<{ plan: Plan; amount: string } | null>(null);
  const [earlyDeposit, setEarlyDeposit] = useState<Deposit | null>(null);
  const [renewDeposit, setRenewDeposit] = useState<Deposit | null>(null);
  const { toasts, notify, dismiss } = useToasts();
  const bank = useBank(notify);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const mine = bank.deposits.filter(
    (d) => bank.account && d.owner.toLowerCase() === bank.account.toLowerCase() && d.status === DepositStatus.Active
  );
  const locked = mine.reduce((s, d) => s + d.principal, 0n);
  const expected = mine.reduce((s, d) => s + depositInterest(d), 0n);
  const bestApr = bank.plans.filter((p) => p.enabled).reduce((m, p) => (p.aprBps > m ? p.aprBps : m), 0n);

  return (
    <div className="min-h-screen">
      <Header bank={bank} supportedChain={bank.supportedChain} view={view} onViewChange={setView} notify={notify} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <DemoBanner bank={bank} supportedChain={bank.supportedChain} />

        {view === 'user' ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryTile icon={Coins} label="Wallet balance" value={fmtUsdc(bank.usdcBalance)} />
              <SummaryTile icon={Layers} label="Locked in certificates" value={fmtUsdc(locked)} />
              <SummaryTile icon={ArrowDownToLine} label="Expected interest" value={`+${fmtUsdc(expected)}`} accent />
              <SummaryTile icon={Percent} label="Best APR available" value={bestApr ? fmtBps(bestApr) : '—'} />
            </div>

            <PlanCatalog bank={bank} onOpenDeposit={(plan, amount) => setOpenPlan({ plan, amount })} />
            <MyDeposits bank={bank} onEarlyWithdraw={setEarlyDeposit} onRenew={setRenewDeposit} />
          </>
        ) : (
          <AdminPanel bank={bank} />
        )}

        <footer className="pb-4 pt-2 text-center text-xs text-slate-600">
          SavingCore · VaultManager · MockUSDC (6 decimals) · Built on OpenZeppelin ERC721, Ownable &amp; Pausable
        </footer>
      </main>

      <OpenDepositModal bank={bank} plan={openPlan?.plan ?? null} initialAmount={openPlan?.amount ?? ''} onClose={() => setOpenPlan(null)} />
      <EarlyWithdrawModal bank={bank} deposit={earlyDeposit} onClose={() => setEarlyDeposit(null)} />
      <RenewModal bank={bank} deposit={renewDeposit} onClose={() => setRenewDeposit(null)} />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
