"use client";

import { useEffect, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import {
  Bank,
  calcInterest,
  calcPenalty,
  fmtBps,
  fmtDate,
  fmtUsdc,
  parseUsdc,
  Plan,
  planLimitError,
  SECONDS_PER_DAY,
  USDC_DECIMALS,
} from '../lib/bank';
import { formatUnits } from 'viem';
import { Button, Modal, Row } from './ui';

function Step({ n, label, state }: { n: number; label: string; state: 'done' | 'current' | 'todo' }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
          state === 'done'
            ? 'bg-emerald-500 text-slate-950'
            : state === 'current'
            ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
            : 'bg-white/5 text-slate-500'
        }`}
      >
        {state === 'done' ? <Check size={13} /> : n}
      </span>
      <span className={`text-sm ${state === 'todo' ? 'text-slate-500' : 'text-slate-200'}`}>{label}</span>
    </div>
  );
}

export function OpenDepositModal({
  bank,
  plan,
  initialAmount,
  onClose,
}: {
  bank: Bank;
  plan: Plan | null;
  initialAmount: string;
  onClose: () => void;
}) {
  const [amountInput, setAmountInput] = useState(initialAmount);
  useEffect(() => setAmountInput(initialAmount), [initialAmount, plan]);

  if (!plan) return null;

  const amount = parseUsdc(amountInput);
  const limitError = amount !== null ? planLimitError(plan, amount) : null;
  const balanceError = amount !== null && amount > bank.usdcBalance ? 'Not enough MockUSDC — use the Faucet' : null;
  const error = limitError ?? balanceError;
  const valid = amount !== null && amount > 0n && !error;
  const approved = valid && bank.allowance >= amount!;

  const interest = amount ? calcInterest(amount, plan.aprBps, plan.tenorDays) : 0n;
  const penalty = amount ? calcPenalty(amount, plan.earlyWithdrawPenaltyBps) : 0n;
  const maturity = bank.now + plan.tenorDays * SECONDS_PER_DAY;

  const setMax = () => {
    let max = bank.usdcBalance;
    if (plan.maxDeposit > 0n && plan.maxDeposit < max) max = plan.maxDeposit;
    setAmountInput(formatUnits(max, USDC_DECIMALS));
  };

  const submit = async () => {
    if (!valid) return;
    if (!approved) {
      await bank.actions.approve(amount!);
      return;
    }
    if (await bank.actions.openDeposit(plan.id, amount!)) onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Open deposit · Plan #${plan.id}`} subtitle={`${plan.tenorDays} days at ${fmtBps(plan.aprBps)} APR`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">Amount</span>
        <span className="text-xs text-slate-500">
          Balance {fmtUsdc(bank.usdcBalance)}
          <button onClick={setMax} className="ml-2 font-semibold text-emerald-400 hover:text-emerald-300">
            MAX
          </button>
        </span>
      </div>
      <div
        className={`mt-1.5 flex items-center rounded-xl border bg-black/20 px-4 focus-within:ring-2 ${
          error ? 'border-rose-500/50 focus-within:ring-rose-500/20' : 'border-white/10 focus-within:border-emerald-500/60 focus-within:ring-emerald-500/15'
        }`}
      >
        <input
          autoFocus
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className="w-full bg-transparent py-3 text-2xl font-semibold text-white outline-none placeholder:text-slate-700"
        />
        <span className="rounded-lg bg-white/5 px-2.5 py-1 text-sm font-semibold text-slate-300">USDC</span>
      </div>
      <p className={`mt-1.5 min-h-[1rem] text-xs ${error ? 'text-rose-400' : 'text-slate-500'}`}>
        {error ??
          `Limits: ${plan.minDeposit > 0n ? fmtUsdc(plan.minDeposit, 0) : '0'} – ${plan.maxDeposit > 0n ? fmtUsdc(plan.maxDeposit, 0) : 'no max'} USDC`}
      </p>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <Row label="Principal" value={`${fmtUsdc(amount ?? 0n)} USDC`} />
        <Row
          label={
            <span className="flex items-center gap-1">
              <Lock size={12} /> Locked APR
            </span>
          }
          value={fmtBps(plan.aprBps)}
        />
        <Row label="Interest at maturity" value={`+${fmtUsdc(interest)} USDC`} tone="emerald" />
        <Row label="Matures on" value={fmtDate(maturity)} />
        <div className="my-2 border-t border-white/[0.06]" />
        <Row label="You receive at maturity" value={`${fmtUsdc((amount ?? 0n) + interest)} USDC`} />
        <Row label={`If broken early (${fmtBps(plan.earlyWithdrawPenaltyBps)})`} value={`−${fmtUsdc(penalty)} USDC, no interest`} tone="amber" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Step n={1} label="Approve USDC" state={approved ? 'done' : valid ? 'current' : 'todo'} />
        <div className="h-px flex-1 bg-white/10" />
        <Step n={2} label="Open deposit" state={approved ? 'current' : 'todo'} />
      </div>

      <Button className="mt-5 w-full" disabled={!valid} loading={!!bank.pending} onClick={submit}>
        {bank.pending ?? (approved ? 'Open deposit & mint certificate' : 'Approve MockUSDC')}
      </Button>
    </Modal>
  );
}
