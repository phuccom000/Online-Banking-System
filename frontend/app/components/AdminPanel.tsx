"use client";

import { useState } from 'react';
import { isAddress } from 'viem';
import { AlertTriangle, Landmark, OctagonPause, PiggyBank, Plus, Settings2, ShieldCheck, Vault } from 'lucide-react';
import { Bank, depositInterest, DepositStatus, fmtBps, fmtUsdc, parseUsdc, Plan, shortAddr } from '../lib/bank';
import { Badge, Button, Card, Field, Skeleton, Toggle } from './ui';

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'emerald' | 'amber' | 'rose' }) {
  const color = tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : tone === 'rose' ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

const toInt = (v: string): bigint | null => (/^\d+$/.test(v) ? BigInt(v) : null);

function PlanRow({ plan, bank }: { plan: Plan; bank: Bank }) {
  const [apr, setApr] = useState(plan.aprBps.toString());
  const newApr = toInt(apr);
  const changed = newApr !== null && newApr !== plan.aprBps;

  return (
    <tr className="border-t border-white/[0.06] text-sm">
      <td className="py-3 pr-3 font-mono text-xs text-slate-400">#{plan.id.toString()}</td>
      <td className="py-3 pr-3 text-slate-200">{plan.tenorDays.toString()}d</td>
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <input
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            className="w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm tabular-nums text-white outline-none focus:border-emerald-500/60"
            aria-label={`APR bps for plan ${plan.id}`}
          />
          <span className="w-12 text-xs text-slate-500">{newApr !== null ? fmtBps(newApr) : '—'}</span>
          {changed && (
            <Button size="sm" className="px-2.5 py-1 text-xs" disabled={!!bank.pending} onClick={() => bank.actions.updatePlan(plan.id, newApr!)}>
              Update
            </Button>
          )}
        </div>
      </td>
      <td className="hidden py-3 pr-3 tabular-nums text-slate-400 md:table-cell">
        {plan.minDeposit > 0n ? fmtUsdc(plan.minDeposit, 0) : '0'} – {plan.maxDeposit > 0n ? fmtUsdc(plan.maxDeposit, 0) : '∞'}
      </td>
      <td className="hidden py-3 pr-3 text-amber-300 sm:table-cell">{fmtBps(plan.earlyWithdrawPenaltyBps)}</td>
      <td className="py-3 text-right">
        <Toggle checked={plan.enabled} disabled={!!bank.pending} onChange={(v) => bank.actions.setPlanEnabled(plan.id, v)} />
      </td>
    </tr>
  );
}

export function AdminPanel({ bank }: { bank: Bank }) {
  const [vaultAmount, setVaultAmount] = useState('');
  const [feeInput, setFeeInput] = useState('');
  // Defaults: personal variant (180 days, 250 bps, 450 bps penalty)
  const [form, setForm] = useState({ tenorDays: '180', aprBps: '250', min: '0', max: '0', penaltyBps: '450' });

  const v = bank.vault;
  const isOwner = !!v && !!bank.account && v.owner.toLowerCase() === bank.account.toLowerCase();
  const active = bank.deposits.filter((d) => d.status === DepositStatus.Active);
  const principalOwed = active.reduce((s, d) => s + d.principal, 0n);
  const interestOwed = active.reduce((s, d) => s + depositInterest(d), 0n);
  const coverage = interestOwed > 0n && v ? Number((v.balance * 10000n) / interestOwed) / 100 : null;

  const vaultAmt = parseUsdc(vaultAmount);
  const tenor = toInt(form.tenorDays);
  const apr = toInt(form.aprBps);
  const penalty = toInt(form.penaltyBps);
  const min = parseUsdc(form.min || '0');
  const max = parseUsdc(form.max || '0');
  const formError =
    tenor === null || tenor === 0n
      ? 'Tenor must be a whole number of days > 0'
      : apr === null || apr === 0n
      ? 'APR must be > 0 bps'
      : penalty === null || penalty > 10000n
      ? 'Penalty must be 0–10000 bps'
      : min === null || max === null
      ? 'Invalid min / max'
      : max > 0n && min > max
      ? 'Min must not exceed max'
      : null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!v) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isOwner && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
          <span>
            The connected wallet is not the contract owner ({shortAddr(v.owner)}). Admin transactions will revert with{' '}
            <code className="rounded bg-black/30 px-1 text-xs">OwnableUnauthorizedAccount</code>.
          </span>
        </div>
      )}

      {(v.corePaused || v.vaultPaused) && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-100">
          <OctagonPause size={16} className="mt-0.5 shrink-0 text-rose-300" />
          <span>
            <span className="font-medium text-white">Emergency stop active.</span>{' '}
            {v.corePaused && 'SavingCore is paused — deposits, withdrawals and renewals are blocked. '}
            {v.vaultPaused && 'VaultManager is paused — interest payouts and vault transfers are blocked.'}
          </span>
        </div>
      )}

      {/* Vault status */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Vault size={18} className="text-emerald-400" /> Vault Status
          </h2>
          <Badge tone={coverage === null || coverage >= 100 ? 'emerald' : 'rose'}>
            <ShieldCheck size={12} /> {coverage === null ? 'No interest owed' : coverage >= 100 ? 'Solvent' : 'Under-funded'}
          </Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Interest pool (VaultManager)" value={`${fmtUsdc(v.balance)}`} sub="USDC available for interest" tone="emerald" />
          <Stat label="Principal held (SavingCore)" value={fmtUsdc(v.principalHeld)} sub="Users' deposits, never used for interest" />
          <Stat label="Active principal owed" value={fmtUsdc(principalOwed)} sub={`${active.length} active certificates`} />
          <Stat
            label="Interest owed at maturity"
            value={fmtUsdc(interestOwed)}
            sub={coverage === null ? '—' : `Vault covers ${coverage.toFixed(0)}%`}
            tone={coverage !== null && coverage < 100 ? 'rose' : undefined}
          />
        </div>
        {coverage !== null && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-slate-500">
              <span>Interest coverage</span>
              <span>{coverage.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${coverage >= 100 ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, coverage)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Liquidity */}
        <Card className="p-5 sm:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <PiggyBank size={17} className="text-cyan-300" /> Vault liquidity
          </h3>
          <p className="mt-1 text-sm text-slate-400">Fund the interest pool or take liquidity out. Your balance: {fmtUsdc(bank.usdcBalance)} USDC.</p>
          <div className="mt-4">
            <Field label="Amount" suffix="USDC" placeholder="0.00" inputMode="decimal" value={vaultAmount} onChange={(e) => setVaultAmount(e.target.value)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              disabled={!vaultAmt || !!bank.pending}
              loading={bank.pending === 'Fund vault'}
              onClick={async () => (await bank.actions.fundVault(vaultAmt!)) && setVaultAmount('')}
            >
              fundVault
            </Button>
            <Button
              variant="secondary"
              disabled={!vaultAmt || !!bank.pending}
              loading={bank.pending === 'Withdraw from vault'}
              onClick={async () => (await bank.actions.withdrawVault(vaultAmt!)) && setVaultAmount('')}
            >
              withdrawVault
            </Button>
          </div>
        </Card>

        {/* Emergency + fee receiver */}
        <Card className="p-5 sm:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Settings2 size={17} className="text-cyan-300" /> Controls
          </h3>
          <div className="mt-4 space-y-3">
            {(
              [
                ['core', 'SavingCore', 'Blocks deposits, withdrawals and renewals', v.corePaused],
                ['vault', 'VaultManager', 'Blocks interest payouts and vault funding', v.vaultPaused],
              ] as const
            ).map(([target, name, desc, paused]) => (
              <div key={target} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    Pause {name} {paused && <Badge tone="rose">Paused</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <Toggle checked={paused} disabled={!!bank.pending} onChange={(p) => bank.actions.setPaused(target, p)} />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Field
              label={`Fee receiver · current ${shortAddr(v.feeReceiver)}`}
              placeholder="0x…"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value.trim())}
              error={feeInput && !isAddress(feeInput) ? 'Not a valid address' : null}
            />
            <Button
              className="mt-3 w-full"
              variant="secondary"
              disabled={!isAddress(feeInput) || !!bank.pending}
              loading={bank.pending === 'Set fee receiver'}
              onClick={async () => (await bank.actions.setFeeReceiver(feeInput as `0x${string}`)) && setFeeInput('')}
            >
              setFeeReceiver
            </Button>
          </div>
        </Card>
      </div>

      {/* Plans */}
      <Card className="p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Landmark size={17} className="text-cyan-300" /> Saving plans
        </h3>
        <p className="mt-1 text-sm text-slate-400">APR updates only affect new deposits — existing certificates keep their snapshot.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-2 font-medium">ID</th>
                <th className="pb-2 font-medium">Tenor</th>
                <th className="pb-2 font-medium">APR (bps)</th>
                <th className="hidden pb-2 font-medium md:table-cell">Limits (USDC)</th>
                <th className="hidden pb-2 font-medium sm:table-cell">Penalty</th>
                <th className="pb-2 text-right font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {bank.plans.map((p) => (
                <PlanRow key={`${p.id}-${p.aprBps}`} plan={p} bank={bank} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <Plus size={15} /> createPlan
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Field label="Tenor" suffix="days" value={form.tenorDays} onChange={set('tenorDays')} inputMode="numeric" />
            <Field label="APR" suffix="bps" value={form.aprBps} onChange={set('aprBps')} inputMode="numeric" hint={apr ? fmtBps(apr) : undefined} />
            <Field label="Min deposit" suffix="USDC" value={form.min} onChange={set('min')} inputMode="decimal" hint="0 = no limit" />
            <Field label="Max deposit" suffix="USDC" value={form.max} onChange={set('max')} inputMode="decimal" hint="0 = no limit" />
            <Field
              label="Penalty"
              suffix="bps"
              value={form.penaltyBps}
              onChange={set('penaltyBps')}
              inputMode="numeric"
              hint={penalty !== null ? fmtBps(penalty) : undefined}
            />
          </div>
          {formError && <p className="mt-2 text-xs text-rose-400">{formError}</p>}
          <Button
            className="mt-4"
            disabled={!!formError || !!bank.pending}
            loading={bank.pending === 'Create plan'}
            onClick={() =>
              bank.actions.createPlan({ tenorDays: tenor!, aprBps: apr!, minDeposit: min!, maxDeposit: max!, penaltyBps: penalty! })
            }
          >
            Create plan
          </Button>
        </div>
      </Card>
    </div>
  );
}
