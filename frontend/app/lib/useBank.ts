"use client";

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { CONTRACTS } from '../../config/contracts';
import type { Bank } from './bank';
import type { Notify } from './events';
import { useLiveBank } from './useLiveBank';
import { useMockBank } from './useMockBank';

/** Live contracts when a wallet is connected to a supported chain, otherwise the in-memory demo. */
export function useBank(notify: Notify): Bank & { supportedChain: boolean } {
  const { address, chainId, isConnected } = useAccount();
  const [wallNow, setWallNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const t = setInterval(() => setWallNow(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(t);
  }, []);

  const supportedChain = !!chainId && !!CONTRACTS[chainId];
  const live = isConnected && supportedChain;

  const liveBank = useLiveBank(notify, live, chainId ?? 0, address ?? null, wallNow);
  const mockBank = useMockBank(notify, wallNow);

  return { ...(live ? liveBank : mockBank), supportedChain };
}
