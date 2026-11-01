import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

async function main() {
  const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/alch_FPmyzbWH1zlGkNtZlFQbL";
  const privateKey = "bf6b35a65c77c36a2bfbebea854e01189998f3088ddf13931a357d6bc2c21444";

  if (!rpcUrl || !privateKey) {
    console.error("Missing environment variables: SEPOLIA_RPC_URL or SEPOLIA_PRIVATE_KEY");
    process.exit(1);
  }

  const formattedPk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedPk as `0x${string}`);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log("Adding plans with account:", account.address);

  const savingCoreAddress = "0x98b98B92B95A4EdC6e29268A3460a9989431306e";
  const abi = [
    {
      "inputs": [
        { "internalType": "uint256", "name": "tenorDays", "type": "uint256" },
        { "internalType": "uint256", "name": "aprBps", "type": "uint256" },
        { "internalType": "uint256", "name": "minDeposit", "type": "uint256" },
        { "internalType": "uint256", "name": "maxDeposit", "type": "uint256" },
        { "internalType": "uint256", "name": "earlyWithdrawPenaltyBps", "type": "uint256" }
      ],
      "name": "createPlan",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ] as const;

  // Default catalog. Plan 1 is the personal-variant default (180 days, 250 bps APR, 450 bps penalty).
  // min/max are in whole USDC (0 = no limit).
  const plans = [
    { tenor: 180, apr: 250, min: 0, max: 0, penalty: 450 },
    { tenor: 30, apr: 200, min: 10, max: 10000, penalty: 450 },
    { tenor: 365, apr: 400, min: 500, max: 100000, penalty: 450 },
  ];

  for (const p of plans) {
    console.log(`Creating plan: ${p.tenor} days...`);
    try {
      const hash = await walletClient.writeContract({
        address: savingCoreAddress,
        abi,
        functionName: 'createPlan',
        args: [BigInt(p.tenor), BigInt(p.apr), BigInt(p.min * 1e6), BigInt(p.max * 1e6), BigInt(p.penalty)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Success: ${hash}`);
    } catch (e) {
      console.error(`Failed to create plan ${p.tenor}:`, e);
    }
  }

  console.log("\nAll plans have been added!");
}

main().catch(console.error);
