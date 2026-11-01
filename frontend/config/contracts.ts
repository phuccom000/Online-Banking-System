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
    usdc: '0xA0b4A6c713385CB31c96Ea60115dA988153985B2',
    vaultManager: '0x0bC43428e64c8CA5a7C6082DD89CEAdE0aB9e585',
    savingCore: '0x98b98B92B95A4EdC6e29268A3460a9989431306e',
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
