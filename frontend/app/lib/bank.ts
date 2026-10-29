import { formatUnits, parseUnits, type Address } from 'viem';

// ---- Domain types (mirror SavingCore structs) ----

export type Plan = {
  id: bigint;
  tenorDays: bigint;
  aprBps: bigint;
  minDeposit: bigint;
  maxDeposit: bigint;
  earlyWithdrawPenaltyBps: bigint;
  enabled: boolean;
};

export enum DepositStatus {
  Active = 0,
  Withdrawn = 1,
  ManualRenewed = 2,
  AutoRenewed = 3,
}

export const STATUS_LABEL: Record<DepositStatus, string> = {
  [DepositStatus.Active]: 'Active',
  [DepositStatus.Withdrawn]: 'Withdrawn',
  [DepositStatus.ManualRenewed]: 'ManualRenewed',
  [DepositStatus.AutoRenewed]: 'AutoRenewed',
};

export type Deposit = {
  id: bigint;
  owner: Address;
  planId: bigint;
  principal: bigint;
  startAt: bigint;
  maturityAt: bigint;
  tenorDaysAtOpen: bigint;
  aprBpsAtOpen: bigint;
  penaltyBpsAtOpen: bigint;
  status: DepositStatus;
};

export type VaultInfo = {
  balance: bigint; // VaultManager interest pool
  principalHeld: bigint; // USDC held by SavingCore (users' principal)
  feeReceiver: Address;
  vaultPaused: boolean;
  corePaused: boolean;
  owner: Address;
};

export type PlanInput = {
  tenorDays: bigint;
  aprBps: bigint;
  minDeposit: bigint;
  maxDeposit: bigint;
  penaltyBps: bigint;
};

export type PauseTarget = 'core' | 'vault';

export type BankActions = {
  mint: () => Promise<boolean>;
  approve: (amount: bigint) => Promise<boolean>;
  openDeposit: (planId: bigint, amount: bigint) => Promise<boolean>;
  withdrawAtMaturity: (id: bigint) => Promise<boolean>;
  earlyWithdraw: (id: bigint) => Promise<boolean>;
  renewDeposit: (id: bigint, newPlanId: bigint) => Promise<boolean>;
  autoRenewDeposit: (id: bigint) => Promise<boolean>;
  fundVault: (amount: bigint) => Promise<boolean>;
  withdrawVault: (amount: bigint) => Promise<boolean>;
  createPlan: (p: PlanInput) => Promise<boolean>;
  updatePlan: (id: bigint, aprBps: bigint) => Promise<boolean>;
  setPlanEnabled: (id: bigint, enabled: boolean) => Promise<boolean>;
  setPaused: (target: PauseTarget, paused: boolean) => Promise<boolean>;
  setFeeReceiver: (addr: Address) => Promise<boolean>;
};

export type Bank = {
  mode: 'live' | 'demo';
  loading: boolean;
  account: Address | null;
  /** Current chain time in seconds */
  now: bigint;
  gracePeriodDays: bigint;
  usdcBalance: bigint;
  allowance: bigint;
  plans: Plan[];
  /** Every certificate on the contract (admin totals); filter by owner for "My Deposits" */
  deposits: Deposit[];
  vault: VaultInfo | null;
  /** Label of the transaction in flight, if any */
  pending: string | null;
  actions: BankActions;
  /** Demo only: move the simulated clock forward */
  timeTravel?: (seconds: number) => void;
};

// ---- Math (same formulas as contracts/libraries/InterestMath.sol) ----

export const USDC_DECIMALS = 6;
export const SECONDS_PER_DAY = 86400n;
export const SECONDS_PER_YEAR = 365n * SECONDS_PER_DAY;
export const BASIS_POINTS = 10000n;
export const FAUCET_AMOUNT = parseUnits('1000', USDC_DECIMALS);

export const calcInterest = (principal: bigint, aprBps: bigint, tenorDays: bigint) =>
  (principal * aprBps * tenorDays * SECONDS_PER_DAY) / (SECONDS_PER_YEAR * BASIS_POINTS);

export const calcPenalty = (principal: bigint, penaltyBps: bigint) => (principal * penaltyBps) / BASIS_POINTS;

export const depositInterest = (d: Deposit) => calcInterest(d.principal, d.aprBpsAtOpen, d.tenorDaysAtOpen);

// ---- Formatting ----

export const fmtUsdc = (v: bigint, digits = 2) =>
  Number(formatUnits(v, USDC_DECIMALS)).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const fmtBps = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`;

export const parseUsdc = (value: string): bigint | null => {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null;
  try {
    return parseUnits(value, USDC_DECIMALS);
  } catch {
    return null;
  }
};

export const fmtDate = (ts: bigint) =>
  new Date(Number(ts) * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function fmtCountdown(seconds: bigint) {
  let s = Number(seconds < 0n ? 0n : seconds);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

/** Validates an amount against a plan's limits (0 = no limit), mirroring openDeposit's requires */
export function planLimitError(plan: Plan, amount: bigint): string | null {
  if (amount <= 0n) return 'Amount must be greater than 0';
  if (plan.minDeposit > 0n && amount < plan.minDeposit) return `Minimum deposit is ${fmtUsdc(plan.minDeposit)} USDC`;
  if (plan.maxDeposit > 0n && amount > plan.maxDeposit) return `Maximum deposit is ${fmtUsdc(plan.maxDeposit)} USDC`;
  return null;
}
