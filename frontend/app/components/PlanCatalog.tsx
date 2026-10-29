"use client";

import { useState } from 'react';
import { ArrowRight, Calculator, Clock, ShieldAlert } from 'lucide-react';
import { Bank, calcInterest, fmtBps, fmtUsdc, parseUsdc, Plan, planLimitError } from '../lib/bank';
import { Badge, Button, Card, Skeleton } from './ui';

function PlanCard({ plan, amount, onOpen }: { plan: Plan; amount: bigint | null; onOpen: () => void }) {
  const interest = amount ? calcInterest(amount, plan.aprBps, plan.tenorDays) : null;
  const limitError = amount ? planLimitError(plan, amount) : null;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border p-5 transition duration-200 ${
        plan.enabled
          ? 'border-white/[0.08] bg-white/[0.03] hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-emerald-500/5'
          : 'border-white/[0.05] bg-white/[0.015] opacity-60'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-slate-500">PLAN #{plan.id.toString()}</span>
        {plan.enabled ? <Badge tone="emerald">Open</Badge> : <Badge tone="slate">Disabled</Badge>}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-white">{fmtBps(plan.aprBps)}</p>
          <p className="text-xs text-slate-500">APR, locked at deposit</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-lg font-semibold text-slate-100">
            <Clock size={15} className="text-slate-500" /> {plan.tenorDays.toString()}d
          </p>
          <p className="text-xs text-slate-500">tenor</p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4 text-xs">
        <div className="flex justify-between">
          <dt className="text-slate-500">Deposit range</dt>
          <dd className="tabular-nums text-slate-300">
            {plan.minDeposit > 0n ? fmtUsdc(plan.minDeposit, 0) : '0'} – {plan.maxDeposit > 0n ? fmtUsdc(plan.maxDeposit, 0) : 'No limit'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="flex items-center gap-1 text-slate-500">
            <ShieldAlert size={12} /> Early-exit penalty
          </dt>
          <dd className="text-amber-300">{fmtBps(plan.earlyWithdrawPenaltyBps)}</dd>
        </div>
      </dl>

      {/* Live payout calculator */}
      <div className="mt-4 rounded-xl bg-black/20 px-3.5 py-3 transition group-hover:bg-emerald-500/[0.07]">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Payout at maturity</p>
        {amount && interest !== null ? (
          limitError ? (
            <p className="mt-1 text-xs text-amber-300">{limitError}</p>
          ) : (
            <p className="mt-1 tabular-nums">
              <span className="text-lg font-semibold text-white">{fmtUsdc(amount + interest)}</span>
              <span className="ml-1.5 text-xs text-emerald-300">+{fmtUsdc(interest)} interest</span>
            </p>
          )
        ) : (
          <p className="mt-1 text-xs text-slate-500">Enter an amount above to calculate</p>
        )}
      </div>

      <Button className="mt-4 w-full" variant={plan.enabled ? 'primary' : 'secondary'} disabled={!plan.enabled} onClick={onOpen}>
        {plan.enabled ? (
          <>
            Open Deposit <ArrowRight size={16} />
          </>
        ) : (
          'Not accepting deposits'
        )}
      </Button>
    </div>
  );
}

export function PlanCatalog({ bank, onOpenDeposit }: { bank: Bank; onOpenDeposit: (plan: Plan, amount: string) => void }) {
  const [amountInput, setAmountInput] = useState('1000');
  const amount = parseUsdc(amountInput);
  const sorted = [...bank.plans].sort((a, b) => Number(b.enabled) - Number(a.enabled) || Number(a.tenorDays - b.tenorDays));

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Explore Plans</h2>
          <p className="mt-0.5 text-sm text-slate-400">Fixed-term savings products. Interest is paid from the bank&apos;s vault.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus-within:border-emerald-500/60 sm:w-64">
          <Calculator size={16} className="shrink-0 text-slate-500" />
          <input
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            inputMode="decimal"
            placeholder="Amount"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
            aria-label="Amount to calculate payout for"
          />
          <span className="text-xs font-medium text-slate-500">USDC</span>
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {bank.loading && bank.plans.length === 0
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[340px] rounded-2xl" />)
          : sorted.map((p) => (
              <PlanCard key={p.id.toString()} plan={p} amount={amount} onOpen={() => onOpenDeposit(p, amountInput)} />
            ))}
        {!bank.loading && bank.plans.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-slate-500">No plans yet. An admin can create one in the Bank Admin tab.</p>
        )}
      </div>
    </Card>
  );
}
