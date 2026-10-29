import type { Address } from 'viem';
import { hardhat, sepolia } from 'wagmi/chains';

export type ContractSet = {
  savingCore: Address;
  vaultManager: Address;
  usdc: Address;
};

// Sepolia: from ignition/deployments/chain-11155111/deployed_addresses.json
// Hardhat local: the addresses Ignition produces on a fresh `npx hardhat node`
// (deployer nonce 0, 1, 2). Override with NEXT_PUBLIC_LOCAL_* if yours differ.
export const CONTRACTS: Record<number, ContractSet> = {
  [sepolia.id]: {
    usdc: '0x55603EB67953fa50851159350FA1A9f55A529f5E',
    vaultManager: '0x99cC3D8AE2F5Cf0061F8e7Fe8d9fBf129291cc80',
    savingCore: '0x35c01ecB096caFa80401Ead21c6F4274d455a9bc',
  },
  [hardhat.id]: {
    usdc: (process.env.NEXT_PUBLIC_LOCAL_USDC ?? '0x5FbDB2315678afecb367f032d93F642f64180aa3') as Address,
    vaultManager: (process.env.NEXT_PUBLIC_LOCAL_VAULT ?? '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as Address,
    savingCore: (process.env.NEXT_PUBLIC_LOCAL_SAVING_CORE ?? '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address,
  },
};

export const CHAIN_NAMES: Record<number, string> = {
  [sepolia.id]: 'Sepolia',
  [hardhat.id]: 'Hardhat Local',
};

export const EXPLORERS: Record<number, string | undefined> = {
  [sepolia.id]: 'https://sepolia.etherscan.io',
};
