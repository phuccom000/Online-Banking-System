import type { Toast } from '../components/Toasts';
import { fmtBps, fmtUsdc } from './bank';

export type Notify = (t: Omit<Toast, 'id'>) => void;

export type BankEvent = { eventName: string; args: Record<string, unknown> };

const big = (v: unknown) => (typeof v === 'bigint' ? v : 0n);

/** Turns an emitted contract event into a toast. Returns null for events we don't surface. */
export function eventToToast(e: BankEvent, href?: string): Omit<Toast, 'id'> | null {
  const a = e.args;
  switch (e.eventName) {
    case 'DepositOpened':
      return {
        kind: 'success',
        title: `DepositOpened · Certificate #${a.depositId}`,
        body: `${fmtUsdc(big(a.principal))} USDC locked at ${fmtBps(big(a.aprBpsAtOpen))} APR`,
        href,
      };
    case 'Withdrawn':
      return a.isEarly
        ? {
            kind: 'success',
            title: `Withdrawn (early) · #${a.depositId}`,
            body: `Principal ${fmtUsdc(big(a.principal))} USDC, penalty deducted, no interest`,
            href,
          }
        : {
            kind: 'success',
            title: `Withdrawn · #${a.depositId}`,
            body: `${fmtUsdc(big(a.principal))} USDC + ${fmtUsdc(big(a.interest))} USDC interest`,
            href,
          };
    case 'Renewed':
      return {
        kind: 'success',
        title: `Renewed · #${a.oldDepositId} → #${a.newDepositId}`,
        body: `New principal ${fmtUsdc(big(a.newPrincipal))} USDC on plan #${a.newPlanId}`,
        href,
      };
    case 'PlanCreated':
      return { kind: 'success', title: `PlanCreated · #${a.planId}`, body: `${a.tenorDays} days at ${fmtBps(big(a.aprBps))}`, href };
    case 'PlanUpdated':
      return { kind: 'success', title: `PlanUpdated · #${a.planId}`, body: `New APR ${fmtBps(big(a.newAprBps))}`, href };
    case 'VaultFunded':
      return { kind: 'success', title: 'VaultFunded', body: `${fmtUsdc(big(a.amount))} USDC added to the interest pool`, href };
    case 'VaultWithdrawn':
      return { kind: 'success', title: 'VaultWithdrawn', body: `${fmtUsdc(big(a.amount))} USDC removed from the pool`, href };
    case 'FeeReceiverSet':
      return { kind: 'success', title: 'FeeReceiverSet', body: String(a.feeReceiver), href };
    case 'Paused':
      return { kind: 'info', title: 'Contract paused', body: 'Withdrawals and renewals are blocked', href };
    case 'Unpaused':
      return { kind: 'success', title: 'Contract unpaused', href };
    default:
      return null;
  }
}
