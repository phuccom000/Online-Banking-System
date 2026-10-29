"use client";

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBlock, useConfig, useReadContracts } from 'wagmi';
import { simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  decodeEventLog,
  type Abi,
  type Address,
} from 'viem';
import { MOCK_USDC_ABI, SAVING_CORE_ABI, VAULT_MANAGER_ABI } from '../../config/abis';
import { CONTRACTS, EXPLORERS } from '../../config/contracts';
import type { SupportedChainId } from '../providers';
import { Bank, BankActions, Deposit, FAUCET_AMOUNT, Plan } from './bank';
import { BankEvent, eventToToast, Notify } from './events';

type Call = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] };

const EVENT_ABIS: Abi[] = [SAVING_CORE_ABI, VAULT_MANAGER_ABI];

function errorMessage(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((err) => err instanceof UserRejectedRequestError)) return 'Rejected in wallet';
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return revert.reason ?? revert.shortMessage;
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}

export function useLiveBank(
  notify: Notify,
  enabled: boolean,
  chainIdInput: number,
  account: Address | null,
  wallNow: bigint
): Bank {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const fallbackChain = Number(Object.keys(CONTRACTS)[0]);
  const chainId = (CONTRACTS[chainIdInput] ? chainIdInput : fallbackChain) as SupportedChainId;
  const c = CONTRACTS[chainId];
  const on = enabled && !!account;

  // ---- Reads ----
  const core = { address: c.savingCore, abi: SAVING_CORE_ABI, chainId } as const;
  const vault = { address: c.vaultManager, abi: VAULT_MANAGER_ABI, chainId } as const;
  const usdc = { address: c.usdc, abi: MOCK_USDC_ABI, chainId } as const;
  const me = account ?? '0x0000000000000000000000000000000000000000';

  const base = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...core, functionName: 'nextPlanId' },
      { ...core, functionName: 'nextDepositId' },
      { ...core, functionName: 'GRACE_PERIOD_DAYS' },
      { ...core, functionName: 'owner' },
      { ...core, functionName: 'paused' },
      { ...vault, functionName: 'getBalance' },
      { ...vault, functionName: 'feeReceiver' },
      { ...vault, functionName: 'paused' },
      { ...usdc, functionName: 'balanceOf', args: [me] },
      { ...usdc, functionName: 'allowance', args: [me, c.savingCore] },
      { ...usdc, functionName: 'balanceOf', args: [c.savingCore] },
    ],
    query: { enabled: on },
  });

  const [nextPlanId, nextDepositId, grace, owner, corePaused, vaultBal, feeReceiver, vaultPaused, myBal, allowance, coreBal] =
    base.data ?? [];

  const planIds = useMemo(
    () => (nextPlanId ? Array.from({ length: Number(nextPlanId) - 1 }, (_, i) => BigInt(i + 1)) : []),
    [nextPlanId]
  );
  const depositIds = useMemo(
    () => (nextDepositId ? Array.from({ length: Number(nextDepositId) - 1 }, (_, i) => BigInt(i + 1)) : []),
    [nextDepositId]
  );

  const planReads = useReadContracts({
    allowFailure: false,
    contracts: planIds.map((id) => ({ ...core, functionName: 'getPlan' as const, args: [id] as const })),
    query: { enabled: on && planIds.length > 0 },
  });

  // The certificate NFT is not enumerable, so scan every deposit id (fine for a demo-sized contract)
  const depositReads = useReadContracts({
    contracts: depositIds.flatMap((id) => [
      { ...core, functionName: 'getDeposit' as const, args: [id] as const },
      { ...core, functionName: 'ownerOf' as const, args: [id] as const },
    ]),
    query: { enabled: on && depositIds.length > 0 },
  });

  const { data: block } = useBlock({ chainId, watch: on, query: { enabled: on } });

  const plans: Plan[] = useMemo(
    () => (planReads.data ?? []).map((p, i) => ({ ...p, id: planIds[i] })),
    [planReads.data, planIds]
  );

  const deposits: Deposit[] = useMemo(() => {
    const r = depositReads.data ?? [];
    return depositIds.flatMap((id, i) => {
      const d = r[i * 2]?.result as Omit<Deposit, 'id' | 'owner'> | undefined;
      const o = r[i * 2 + 1]?.result as Address | undefined;
      return d && o ? [{ ...d, id, owner: o, status: Number(d.status) }] : [];
    });
  }, [depositReads.data, depositIds]);

  // ---- Writes ----
  const send = useCallback(
    async (label: string, calls: Call[]): Promise<boolean> => {
      if (!account) return false;
      setPending(label);
      try {
        for (const call of calls) {
          // Simulate first so reverts surface with their reason before the wallet opens
          const { request } = await simulateContract(config, { ...call, account, chainId } as never);
          const hash = await writeContract(config, request);
          const receipt = await waitForTransactionReceipt(config, { hash, chainId });
          if (receipt.status !== 'success') throw new Error(`${label} failed on-chain`);
          const href = EXPLORERS[chainId] ? `${EXPLORERS[chainId]}/tx/${hash}` : undefined;
          let shown = 0;
          for (const log of receipt.logs) {
            for (const abi of EVENT_ABIS) {
              try {
                const ev = decodeEventLog({ abi, data: log.data, topics: log.topics }) as unknown as BankEvent;
                const toast = eventToToast(ev, href);
                if (toast) {
                  notify(toast);
                  shown++;
                }
                break;
              } catch {
                /* not from this ABI */
              }
            }
          }
          if (shown === 0 && call === calls[calls.length - 1]) notify({ kind: 'success', title: `${label} confirmed`, href });
        }
        return true;
      } catch (e) {
        notify({ kind: 'error', title: `${label} failed`, body: errorMessage(e) });
        return false;
      } finally {
        setPending(null);
        await queryClient.invalidateQueries();
      }
    },
    [account, chainId, config, notify, queryClient]
  );

  const actions: BankActions = useMemo(() => {
    const coreCall = (functionName: string, args: readonly unknown[] = []): Call => ({
      address: c.savingCore,
      abi: SAVING_CORE_ABI,
      functionName,
      args,
    });
    const vaultCall = (functionName: string, args: readonly unknown[] = []): Call => ({
      address: c.vaultManager,
      abi: VAULT_MANAGER_ABI,
      functionName,
      args,
    });
    const usdcCall = (functionName: string, args: readonly unknown[] = []): Call => ({
      address: c.usdc,
      abi: MOCK_USDC_ABI,
      functionName,
      args,
    });
    return {
      mint: () => send('Mint test USDC', [usdcCall('mint', [account, FAUCET_AMOUNT])]),
      approve: (amount) => send('Approve USDC', [usdcCall('approve', [c.savingCore, amount])]),
      openDeposit: (planId, amount) => send('Open deposit', [coreCall('openDeposit', [planId, amount])]),
      withdrawAtMaturity: (id) => send('Withdraw at maturity', [coreCall('withdrawAtMaturity', [id])]),
      earlyWithdraw: (id) => send('Early withdraw', [coreCall('earlyWithdraw', [id])]),
      renewDeposit: (id, newPlanId) => send('Renew deposit', [coreCall('renewDeposit', [id, newPlanId])]),
      autoRenewDeposit: (id) => send('Auto-renew', [coreCall('autoRenewDeposit', [id])]),
      // fundVault pulls with transferFrom, so approve the VaultManager first
      fundVault: (amount) =>
        send('Fund vault', [usdcCall('approve', [c.vaultManager, amount]), vaultCall('fundVault', [amount])]),
      withdrawVault: (amount) => send('Withdraw from vault', [vaultCall('withdrawVault', [amount])]),
      createPlan: (p) =>
        send('Create plan', [coreCall('createPlan', [p.tenorDays, p.aprBps, p.minDeposit, p.maxDeposit, p.penaltyBps])]),
      updatePlan: (id, aprBps) => send('Update plan', [coreCall('updatePlan', [id, aprBps])]),
      setPlanEnabled: (id, en) => send(en ? 'Enable plan' : 'Disable plan', [coreCall(en ? 'enablePlan' : 'disablePlan', [id])]),
      setPaused: (target, paused) =>
        send(`${paused ? 'Pause' : 'Unpause'} ${target === 'core' ? 'SavingCore' : 'VaultManager'}`, [
          target === 'core' ? coreCall(paused ? 'pause' : 'unpause') : vaultCall(paused ? 'pause' : 'unpause'),
        ]),
      setFeeReceiver: (addr) => send('Set fee receiver', [vaultCall('setFeeReceiver', [addr])]),
    };
  }, [account, c, send]);

  // Chain time only moves per block; follow the wall clock between blocks so countdowns tick
  const now = block && block.timestamp > wallNow ? block.timestamp : wallNow;

  return {
    mode: 'live',
    loading: base.isLoading || planReads.isLoading || depositReads.isLoading,
    account,
    now,
    gracePeriodDays: grace ?? 4n,
    usdcBalance: myBal ?? 0n,
    allowance: allowance ?? 0n,
    plans,
    deposits,
    vault:
      base.data
        ? {
            balance: vaultBal!,
            principalHeld: coreBal!,
            feeReceiver: feeReceiver!,
            vaultPaused: vaultPaused!,
            corePaused: corePaused!,
            owner: owner!,
          }
        : null,
    pending,
    actions,
  };
}
