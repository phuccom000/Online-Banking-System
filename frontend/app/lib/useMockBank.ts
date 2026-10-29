"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Address } from 'viem';
import {
  Bank,
  BankActions,
  calcInterest,
  calcPenalty,
  Deposit,
  DepositStatus,
  FAUCET_AMOUNT,
  Plan,
  SECONDS_PER_DAY,
  USDC_DECIMALS,
} from './bank';
import { BankEvent, eventToToast, Notify } from './events';

// In-memory simulation of MockUSDC + VaultManager + SavingCore.
// Each action enforces the same requires (and revert messages) as the Solidity code.

export const DEMO_ACCOUNT: Address = '0xA9e5c0f1D2b3C4d5E6f7081920a1B2c3D4e5F612';
const FEE_RECEIVER: Address = '0xFee0000000000000000000000000000000000001';
const GRACE_PERIOD_DAYS = 4n; // matches SavingCore.GRACE_PERIOD_DAYS
const USDC = 10n ** BigInt(USDC_DECIMALS);

type MockState = {
  clockOffset: number;
  usdcBalance: bigint;
  allowanceCore: bigint;
  vaultBalance: bigint;
  coreBalance: bigint;
  feeReceiver: Address;
  vaultPaused: boolean;
  corePaused: boolean;
  plans: Plan[];
  deposits: Deposit[];
};

class Revert extends Error {}
const req = (cond: boolean, msg: string) => {
  if (!cond) throw new Revert(msg);
};

const realNow = () => BigInt(Math.floor(Date.now() / 1000));

function seed(): MockState {
  const now = realNow();
  const day = SECONDS_PER_DAY;
  const plan = (id: number, tenor: number, apr: number, min: number, max: number, enabled = true): Plan => ({
    id: BigInt(id),
    tenorDays: BigInt(tenor),
    aprBps: BigInt(apr),
    minDeposit: BigInt(min) * USDC,
    maxDeposit: BigInt(max) * USDC,
    earlyWithdrawPenaltyBps: 450n,
    enabled,
  });
  const plans = [
    plan(1, 30, 200, 10, 10_000),
    plan(2, 180, 250, 0, 0), // personal-variant default plan
    plan(3, 365, 400, 500, 100_000),
    plan(4, 7, 150, 0, 1_000, false),
  ];
  const dep = (id: number, p: Plan, principal: number, startDaysAgo: number, status = DepositStatus.Active): Deposit => {
    const startAt = now - BigInt(Math.round(startDaysAgo * 86400));
    return {
      id: BigInt(id),
      owner: DEMO_ACCOUNT,
      planId: p.id,
      principal: BigInt(principal) * USDC,
      startAt,
      maturityAt: startAt + p.tenorDays * day,
      tenorDaysAtOpen: p.tenorDays,
      aprBpsAtOpen: p.aprBps,
      penaltyBpsAtOpen: p.earlyWithdrawPenaltyBps,
      status,
    };
  };
  const deposits = [
    dep(1, plans[0], 1_500, 31.5), // matured 1.5 days ago, inside the grace period
    dep(2, plans[1], 4_000, 42), // active, ~138 days left
    dep(3, plans[0], 800, 75, DepositStatus.Withdrawn),
  ];
  const coreBalance = deposits.filter((d) => d.status === DepositStatus.Active).reduce((s, d) => s + d.principal, 0n);
  return {
    clockOffset: 0,
    usdcBalance: 5_000n * USDC,
    allowanceCore: 0n,
    vaultBalance: 100_000n * USDC,
    coreBalance,
    feeReceiver: FEE_RECEIVER,
    vaultPaused: false,
    corePaused: false,
    plans,
    deposits,
  };
}

export function useMockBank(notify: Notify, now: bigint): Bank {
  const [state, setState] = useState<MockState>(seed);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [pending, setPending] = useState<string | null>(null);

  const chainNow = now + BigInt(state.clockOffset);

  // Runs a simulated transaction: short delay, then apply or revert atomically
  const sim = useCallback(
    async (label: string, fn: (s: MockState, t: bigint) => BankEvent[]): Promise<boolean> => {
      setPending(label);
      await new Promise((r) => setTimeout(r, 700));
      const draft = structuredClone(stateRef.current);
      const t = realNow() + BigInt(draft.clockOffset);
      try {
        const events = fn(draft, t);
        setState(draft);
        if (events.length === 0) notify({ kind: 'success', title: `${label} confirmed` });
        events.forEach((e) => {
          const toast = eventToToast(e);
          if (toast) notify(toast);
        });
        return true;
      } catch (e) {
        notify({
          kind: 'error',
          title: `${label} reverted`,
          body: e instanceof Revert ? e.message : String(e),
        });
        return false;
      } finally {
        setPending(null);
      }
    },
    [notify]
  );

  const actions: BankActions = useMemo(() => {
    const findPlan = (s: MockState, id: bigint) => s.plans.find((p) => p.id === id);
    const ownDeposit = (s: MockState, id: bigint) => {
      const d = s.deposits.find((x) => x.id === id);
      req(!!d && d.owner === DEMO_ACCOUNT, 'SavingCore: not deposit owner');
      return d!;
    };
    const payInterest = (s: MockState, amount: bigint) => {
      if (amount === 0n) return;
      req(!s.vaultPaused, 'Pausable: paused');
      req(s.vaultBalance >= amount, 'VaultManager: insufficient funds for interest');
      s.vaultBalance -= amount;
    };
    const mintCertificate = (s: MockState, d: Omit<Deposit, 'id'>) => {
      const id = BigInt(s.deposits.length + 1);
      s.deposits.push({ ...d, id });
      return id;
    };

    return {
      mint: () =>
        sim('Mint test USDC', (s) => {
          s.usdcBalance += FAUCET_AMOUNT;
          return [];
        }),

      approve: (amount) =>
        sim('Approve USDC', (s) => {
          s.allowanceCore = amount;
          return [];
        }),

      openDeposit: (planId, amount) =>
        sim('Open deposit', (s, t) => {
          req(!s.corePaused, 'Pausable: paused');
          const p = findPlan(s, planId);
          req(!!p && p.tenorDays > 0n, 'SavingCore: plan does not exist');
          req(p!.enabled, 'SavingCore: plan is disabled');
          if (p!.minDeposit > 0n) req(amount >= p!.minDeposit, 'SavingCore: amount below minimum');
          if (p!.maxDeposit > 0n) req(amount <= p!.maxDeposit, 'SavingCore: amount above maximum');
          req(amount > 0n, 'SavingCore: amount must be > 0');
          req(s.allowanceCore >= amount, 'ERC20: insufficient allowance');
          req(s.usdcBalance >= amount, 'ERC20: transfer amount exceeds balance');
          s.allowanceCore -= amount;
          s.usdcBalance -= amount;
          s.coreBalance += amount;
          const maturityAt = t + p!.tenorDays * SECONDS_PER_DAY;
          const depositId = mintCertificate(s, {
            owner: DEMO_ACCOUNT,
            planId,
            principal: amount,
            startAt: t,
            maturityAt,
            tenorDaysAtOpen: p!.tenorDays,
            aprBpsAtOpen: p!.aprBps,
            penaltyBpsAtOpen: p!.earlyWithdrawPenaltyBps,
            status: DepositStatus.Active,
          });
          return [
            {
              eventName: 'DepositOpened',
              args: { depositId, owner: DEMO_ACCOUNT, planId, principal: amount, maturityAt, aprBpsAtOpen: p!.aprBps },
            },
          ];
        }),

      withdrawAtMaturity: (id) =>
        sim('Withdraw at maturity', (s, t) => {
          req(!s.corePaused, 'Pausable: paused');
          const d = ownDeposit(s, id);
          req(d.status === DepositStatus.Active, 'SavingCore: deposit not active');
          req(t >= d.maturityAt, 'SavingCore: not matured yet');
          const interest = calcInterest(d.principal, d.aprBpsAtOpen, d.tenorDaysAtOpen);
          d.status = DepositStatus.Withdrawn;
          s.coreBalance -= d.principal;
          payInterest(s, interest);
          s.usdcBalance += d.principal + interest;
          return [{ eventName: 'Withdrawn', args: { depositId: id, principal: d.principal, interest, isEarly: false } }];
        }),

      earlyWithdraw: (id) =>
        sim('Early withdraw', (s, t) => {
          req(!s.corePaused, 'Pausable: paused');
          const d = ownDeposit(s, id);
          req(d.status === DepositStatus.Active, 'SavingCore: deposit not active');
          req(t < d.maturityAt, 'SavingCore: already matured, use withdrawAtMaturity');
          const penalty = calcPenalty(d.principal, d.penaltyBpsAtOpen);
          d.status = DepositStatus.Withdrawn;
          s.coreBalance -= d.principal;
          s.usdcBalance += d.principal - penalty;
          return [{ eventName: 'Withdrawn', args: { depositId: id, principal: d.principal, interest: 0n, isEarly: true } }];
        }),

      renewDeposit: (id, newPlanId) =>
        sim('Renew deposit', (s, t) => {
          req(!s.corePaused, 'Pausable: paused');
          const d = ownDeposit(s, id);
          req(d.status === DepositStatus.Active, 'SavingCore: deposit not active');
          req(t >= d.maturityAt, 'SavingCore: not matured yet');
          const p = findPlan(s, newPlanId);
          req(!!p && p.tenorDays > 0n, 'SavingCore: new plan does not exist');
          req(p!.enabled, 'SavingCore: new plan is disabled');
          const interest = calcInterest(d.principal, d.aprBpsAtOpen, d.tenorDaysAtOpen);
          const newPrincipal = d.principal + interest;
          d.status = DepositStatus.ManualRenewed;
          payInterest(s, interest);
          s.coreBalance += interest;
          const newDepositId = mintCertificate(s, {
            owner: d.owner,
            planId: newPlanId,
            principal: newPrincipal,
            startAt: t,
            maturityAt: t + p!.tenorDays * SECONDS_PER_DAY,
            tenorDaysAtOpen: p!.tenorDays,
            aprBpsAtOpen: p!.aprBps,
            penaltyBpsAtOpen: p!.earlyWithdrawPenaltyBps,
            status: DepositStatus.Active,
          });
          return [{ eventName: 'Renewed', args: { oldDepositId: id, newDepositId, newPrincipal, newPlanId } }];
        }),

      autoRenewDeposit: (id) =>
        sim('Auto-renew', (s, t) => {
          req(!s.corePaused, 'Pausable: paused');
          const d = s.deposits.find((x) => x.id === id);
          req(!!d, 'SavingCore: not authorized');
          req(d!.status === DepositStatus.Active, 'SavingCore: deposit not active');
          req(t >= d!.maturityAt + GRACE_PERIOD_DAYS * SECONDS_PER_DAY, 'SavingCore: grace period not ended');
          const interest = calcInterest(d!.principal, d!.aprBpsAtOpen, d!.tenorDaysAtOpen);
          const newPrincipal = d!.principal + interest;
          d!.status = DepositStatus.AutoRenewed;
          payInterest(s, interest);
          s.coreBalance += interest;
          const newDepositId = mintCertificate(s, {
            owner: d!.owner,
            planId: d!.planId,
            principal: newPrincipal,
            startAt: t,
            maturityAt: t + d!.tenorDaysAtOpen * SECONDS_PER_DAY,
            tenorDaysAtOpen: d!.tenorDaysAtOpen,
            aprBpsAtOpen: d!.aprBpsAtOpen, // original APR locked
            penaltyBpsAtOpen: d!.penaltyBpsAtOpen,
            status: DepositStatus.Active,
          });
          return [{ eventName: 'Renewed', args: { oldDepositId: id, newDepositId, newPrincipal, newPlanId: d!.planId } }];
        }),

      fundVault: (amount) =>
        sim('Fund vault', (s) => {
          req(!s.vaultPaused, 'Pausable: paused');
          req(amount > 0n, 'VaultManager: amount must be > 0');
          req(s.usdcBalance >= amount, 'ERC20: transfer amount exceeds balance');
          s.usdcBalance -= amount;
          s.vaultBalance += amount;
          return [{ eventName: 'VaultFunded', args: { amount } }];
        }),

      withdrawVault: (amount) =>
        sim('Withdraw from vault', (s) => {
          req(!s.vaultPaused, 'Pausable: paused');
          req(amount > 0n, 'VaultManager: amount must be > 0');
          req(s.vaultBalance >= amount, 'VaultManager: insufficient balance');
          s.vaultBalance -= amount;
          s.usdcBalance += amount;
          return [{ eventName: 'VaultWithdrawn', args: { amount } }];
        }),

      createPlan: (p) =>
        sim('Create plan', (s) => {
          req(p.aprBps > 0n, 'SavingCore: APR must be > 0');
          const planId = BigInt(s.plans.length + 1);
          s.plans.push({
            id: planId,
            tenorDays: p.tenorDays,
            aprBps: p.aprBps,
            minDeposit: p.minDeposit,
            maxDeposit: p.maxDeposit,
            earlyWithdrawPenaltyBps: p.penaltyBps,
            enabled: true,
          });
          return [{ eventName: 'PlanCreated', args: { planId, tenorDays: p.tenorDays, aprBps: p.aprBps } }];
        }),

      updatePlan: (id, aprBps) =>
        sim('Update plan', (s) => {
          const p = findPlan(s, id);
          req(!!p && p.tenorDays > 0n, 'SavingCore: plan does not exist');
          req(aprBps > 0n, 'SavingCore: APR must be > 0');
          p!.aprBps = aprBps;
          return [{ eventName: 'PlanUpdated', args: { planId: id, newAprBps: aprBps } }];
        }),

      setPlanEnabled: (id, enabled) =>
        sim(enabled ? 'Enable plan' : 'Disable plan', (s) => {
          const p = findPlan(s, id);
          req(!!p && p.tenorDays > 0n, 'SavingCore: plan does not exist');
          p!.enabled = enabled;
          return [];
        }),

      setPaused: (target, paused) =>
        sim(`${paused ? 'Pause' : 'Unpause'} ${target === 'core' ? 'SavingCore' : 'VaultManager'}`, (s) => {
          const current = target === 'core' ? s.corePaused : s.vaultPaused;
          req(current !== paused, paused ? 'Pausable: paused' : 'Pausable: not paused');
          if (target === 'core') s.corePaused = paused;
          else s.vaultPaused = paused;
          return [{ eventName: paused ? 'Paused' : 'Unpaused', args: {} }];
        }),

      setFeeReceiver: (addr) =>
        sim('Set fee receiver', (s) => {
          req(addr !== '0x0000000000000000000000000000000000000000', 'VaultManager: zero address');
          s.feeReceiver = addr;
          return [{ eventName: 'FeeReceiverSet', args: { feeReceiver: addr } }];
        }),
    };
  }, [sim]);

  return {
    mode: 'demo',
    loading: false,
    account: DEMO_ACCOUNT,
    now: chainNow,
    gracePeriodDays: GRACE_PERIOD_DAYS,
    usdcBalance: state.usdcBalance,
    allowance: state.allowanceCore,
    plans: state.plans,
    deposits: state.deposits,
    vault: {
      balance: state.vaultBalance,
      principalHeld: state.coreBalance,
      feeReceiver: state.feeReceiver,
      vaultPaused: state.vaultPaused,
      corePaused: state.corePaused,
      owner: DEMO_ACCOUNT,
    },
    pending,
    actions,
    timeTravel: (seconds) => setState((s) => ({ ...s, clockOffset: s.clockOffset + seconds })),
  };
}
