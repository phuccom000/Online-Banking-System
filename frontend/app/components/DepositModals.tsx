"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Bank, calcPenalty, Deposit, depositInterest, fmtBps, fmtDate, fmtUsdc, SECONDS_PER_DAY } from '../lib/bank';
import { Button, Modal, Row } from './ui';

export function EarlyWithdrawModal({ bank, deposit, onClose }: { bank: Bank; deposit: Deposit | null; onClose: () => void }) {
  if (!deposit) return null;
  const penalty = calcPenalty(deposit.principal, deposit.penaltyBpsAtOpen);
  const forfeited = depositInterest(deposit);

  return (
    <Modal open onClose={onClose} title={`Break certificate #${deposit.id}?`} subtitle="Early withdrawal before maturity">
      <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-sm text-amber-100">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
        <p>
          Withdrawing before <span className="font-medium text-white">{fmtDate(deposit.maturityAt)}</span> pays{' '}
          <span className="font-medium text-white">no interest</span> and deducts a{' '}
          <span className="font-medium text-white">{fmtBps(deposit.penaltyBpsAtOpen)}</span> penalty from your principal. The penalty goes to the
          bank&apos;s fee receiver.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <Row label="Principal" value={`${fmtUsdc(deposit.principal)} USDC`} />
        <Row label={`Penalty (${fmtBps(deposit.penaltyBpsAtOpen)})`} value={`−${fmtUsdc(penalty)} USDC`} tone="rose" />
        <Row label="Interest" value="0.00 USDC" />
        <div className="my-2 border-t border-white/[0.06]" />
        <Row label="You receive now" value={<span className="text-base">{fmtUsdc(deposit.principal - penalty)} USDC</span>} />
        <p className="mt-2 text-xs text-slate-500">
          Waiting until maturity would return {fmtUsdc(deposit.principal + forfeited)} USDC.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>
          Keep saving
        </Button>
        <Button
          variant="danger"
          loading={!!bank.pending}
          onClick={async () => {
            if (await bank.actions.earlyWithdraw(deposit.id)) onClose();
          }}
        >
          Withdraw early
        </Button>
      </div>
    </Modal>
  );
}

export function RenewModal({ bank, deposit, onClose }: { bank: Bank; deposit: Deposit | null; onClose: () => void }) {
  const openPlans = bank.plans.filter((p) => p.enabled);
  const [planId, setPlanId] = useState<bigint | null>(null);

  useEffect(() => {
    if (!deposit) return;
    // Default to the deposit's own plan if it is still open
    const same = openPlans.find((p) => p.id === deposit.planId);
    setPlanId((same ?? openPlans[0])?.id ?? null);
  }, [deposit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!deposit) return null;
  const interest = depositInterest(deposit);
  const newPrincipal = deposit.principal + interest;
  const plan = openPlans.find((p) => p.id === planId) ?? null;

  return (
    <Modal open onClose={onClose} title={`Renew certificate #${deposit.id}`} subtitle="Compound principal + interest into a new certificate">
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <Row label="Current principal" value={`${fmtUsdc(deposit.principal)} USDC`} />
        <Row label={`Interest earned (${fmtBps(deposit.aprBpsAtOpen)})`} value={`+${fmtUsdc(interest)} USDC`} tone="emerald" />
        <div className="my-2 border-t border-white/[0.06]" />
        <Row label="New principal" value={<span className="text-base">{fmtUsdc(newPrincipal)} USDC</span>} />
      </div>

      <p className="mb-2 mt-5 text-xs font-medium text-slate-400">Choose a plan for the new certificate</p>
      <div className="space-y-2">
        {openPlans.map((p) => (
          <button
            key={p.id.toString()}
            onClick={() => setPlanId(p.id)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
              p.id === planId ? 'border-emerald-500/50 bg-emerald-500/[0.08]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
            }`}
          >
            <span>
              <span className="font-medium text-white">{p.tenorDays.toString()} days</span>
              <span className="ml-2 font-mono text-xs text-slate-500">#{p.id.toString()}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-emerald-300">{fmtBps(p.aprBps)}</span>
              {p.id === planId && <Check size={15} className="text-emerald-400" />}
            </span>
          </button>
        ))}
        {openPlans.length === 0 && <p className="text-sm text-slate-500">No open plans to renew into.</p>}
      </div>

      {plan && (
        <p className="mt-3 text-xs text-slate-500">
          New maturity: {fmtDate(bank.now + plan.tenorDays * SECONDS_PER_DAY)} · rate locked at {fmtBps(plan.aprBps)}
        </p>
      )}

      <Button
        className="mt-5 w-full"
        disabled={!plan}
        loading={!!bank.pending}
        onClick={async () => {
          if (plan && (await bank.actions.renewDeposit(deposit.id, plan.id))) onClose();
        }}
      >
        Renew into new certificate
      </Button>
    </Modal>
  );
}
