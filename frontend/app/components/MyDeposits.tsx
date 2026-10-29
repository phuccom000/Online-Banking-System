"use client";

import { useState } from 'react';
import { CalendarClock, Hourglass, Layers, RefreshCw, Timer } from 'lucide-react';
import {
  Bank,
  Deposit,
  depositInterest,
  DepositStatus,
  fmtBps,
  fmtCountdown,
  fmtDate,
  fmtUsdc,
  SECONDS_PER_DAY,
  STATUS_LABEL,
} from '../lib/bank';
import { Badge, Button, Card, Skeleton, Tone } from './ui';

const STATUS_TONE: Record<DepositStatus, Tone> = {
  [DepositStatus.Active]: 'emerald',
  [DepositStatus.Withdrawn]: 'slate',
  [DepositStatus.ManualRenewed]: 'cyan',
  [DepositStatus.AutoRenewed]: 'violet',
};

function ProgressBar({ value, tone }: { value: number; tone: 'emerald' | 'amber' | 'rose' }) {
  const color = tone === 'emerald' ? 'from-emerald-500 to-cyan-400' : tone === 'amber' ? 'from-amber-500 to-amber-300' : 'from-rose-500 to-rose-400';
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-[width] duration-1000`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function CertificateCard({
  d,
  bank,
  onEarlyWithdraw,
  onRenew,
}: {
  d: Deposit;
  bank: Bank;
  onEarlyWithdraw: () => void;
  onRenew: () => void;
}) {
  const interest = depositInterest(d);
  const active = d.status === DepositStatus.Active;
  const matured = bank.now >= d.maturityAt;
  const graceEnd = d.maturityAt + bank.gracePeriodDays * SECONDS_PER_DAY;
  const inGrace = active && matured && bank.now < graceEnd;
  const graceOver = active && bank.now >= graceEnd;

  const term = Number(d.maturityAt - d.startAt) || 1;
  const termProgress = (Number(bank.now - d.startAt) / term) * 100;
  const graceTotal = Number(bank.gracePeriodDays * SECONDS_PER_DAY) || 1;
  const graceLeftPct = (Number(graceEnd - bank.now) / graceTotal) * 100;

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition hover:border-white/20 ${
        active ? 'border-white/[0.08] bg-white/[0.03]' : 'border-white/[0.05] bg-white/[0.015]'
      }`}
    >
      {/* NFT header */}
      <div className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.12] via-cyan-500/[0.06] to-transparent px-5 py-4">
        <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full border border-emerald-400/10" />
        <div className="pointer-events-none absolute -right-2 -top-6 h-20 w-20 rounded-full border border-cyan-400/10" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-black/30 px-2 py-1 font-mono text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
              ERC-721
            </span>
            <span className="font-mono text-sm font-semibold text-white">SDC #{d.id.toString()}</span>
          </div>
          <Badge tone={STATUS_TONE[d.status as DepositStatus]}>{STATUS_LABEL[d.status as DepositStatus]}</Badge>
        </div>
        <p className="relative mt-3 text-2xl font-semibold tabular-nums text-white">
          {fmtUsdc(d.principal)} <span className="text-sm font-medium text-slate-400">USDC</span>
        </p>
      </div>

      <div className="px-5 py-4">
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-slate-500">APR (snapshot)</dt>
            <dd className="mt-0.5 font-medium text-slate-100">{fmtBps(d.aprBpsAtOpen)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tenor</dt>
            <dd className="mt-0.5 font-medium text-slate-100">{d.tenorDaysAtOpen.toString()} days</dd>
          </div>
          <div>
            <dt className="text-slate-500">Interest</dt>
            <dd className="mt-0.5 font-medium text-emerald-300">+{fmtUsdc(interest)}</dd>
          </div>
        </dl>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarClock size={13} /> Matures {fmtDate(d.maturityAt)}
        </p>

        {active && !matured && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                <Timer size={13} /> Matures in
              </span>
              <span className="font-mono font-medium tabular-nums text-white">{fmtCountdown(d.maturityAt - bank.now)}</span>
            </div>
            <ProgressBar value={termProgress} tone="emerald" />
          </div>
        )}

        {inGrace && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-amber-200">
                <Hourglass size={13} /> Grace period · auto-renew in
              </span>
              <span className="font-mono font-medium tabular-nums text-amber-100">{fmtCountdown(graceEnd - bank.now)}</span>
            </div>
            <ProgressBar value={graceLeftPct} tone={graceLeftPct < 25 ? 'rose' : 'amber'} />
            <p className="mt-2 text-[11px] text-amber-200/70">
              Act within the {bank.gracePeriodDays.toString()}-day grace period, or the bot renews at your original {fmtBps(d.aprBpsAtOpen)} APR.
            </p>
          </div>
        )}

        {graceOver && (
          <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3 text-xs text-violet-200">
            Grace period ended {fmtDate(graceEnd)}. This certificate is eligible for auto-renewal (same tenor, original APR locked).
          </div>
        )}

        {active && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!matured && (
              <Button variant="danger" size="sm" className="flex-1" onClick={onEarlyWithdraw} disabled={!!bank.pending}>
                Early Withdraw
              </Button>
            )}
            {matured && (
              <>
                <Button
                  size="sm"
                  className="flex-1"
                  loading={bank.pending === 'Withdraw at maturity'}
                  disabled={!!bank.pending}
                  onClick={() => bank.actions.withdrawAtMaturity(d.id)}
                >
                  Withdraw {fmtUsdc(d.principal + interest)}
                </Button>
                <Button variant="secondary" size="sm" className="flex-1" onClick={onRenew} disabled={!!bank.pending}>
                  <RefreshCw size={14} /> Renew
                </Button>
              </>
            )}
            {graceOver && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                loading={bank.pending === 'Auto-renew'}
                disabled={!!bank.pending}
                onClick={() => bank.actions.autoRenewDeposit(d.id)}
              >
                Trigger auto-renew (bot action)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MyDeposits({
  bank,
  onEarlyWithdraw,
  onRenew,
}: {
  bank: Bank;
  onEarlyWithdraw: (d: Deposit) => void;
  onRenew: (d: Deposit) => void;
}) {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const mine = bank.deposits
    .filter((d) => bank.account && d.owner.toLowerCase() === bank.account.toLowerCase())
    .sort((a, b) => Number(b.id - a.id));
  const active = mine.filter((d) => d.status === DepositStatus.Active);
  const history = mine.filter((d) => d.status !== DepositStatus.Active);
  const shown = tab === 'active' ? active : history;
  const totalLocked = active.reduce((s, d) => s + d.principal, 0n);
  const totalInterest = active.reduce((s, d) => s + depositInterest(d), 0n);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Layers size={18} className="text-emerald-400" /> My Deposits
          </h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {fmtUsdc(totalLocked)} USDC locked · <span className="text-emerald-300">+{fmtUsdc(totalInterest)}</span> expected interest
          </p>
        </div>
        <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 text-sm">
          {(
            [
              ['active', `Active (${active.length})`],
              ['history', `History (${history.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-1.5 font-medium transition sm:flex-none ${
                tab === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bank.loading && mine.length === 0
          ? Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)
          : shown.map((d) => (
              <CertificateCard
                key={d.id.toString()}
                d={d}
                bank={bank}
                onEarlyWithdraw={() => onEarlyWithdraw(d)}
                onRenew={() => onRenew(d)}
              />
            ))}
        {!bank.loading && shown.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <p className="text-sm text-slate-400">{tab === 'active' ? 'No active certificates yet.' : 'No past certificates.'}</p>
            {tab === 'active' && <p className="mt-1 text-xs text-slate-500">Open a deposit from a plan above to mint one.</p>}
          </div>
        )}
      </div>
    </Card>
  );
}
