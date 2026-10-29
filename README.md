# Online Banking System — On-Chain Term Deposits

A blockchain term-deposit system: users lock MockUSDC for a fixed term, receive an ERC-721 deposit certificate, and earn simple interest paid from a separate bank vault. Built with Hardhat 3, viem, OpenZeppelin, and a Next.js frontend (**Apex Vault Bank**).

## Personal variant

**Student ID:** 21125132 (A = 2, B = 3)

| Parameter | Formula | Value |
| :-- | :-- | :-- |
| Grace period (auto-renew) | (A mod 3) + 2 days | **4 days** |
| Default plan APR | 200 + A × 25 bps | **250 bps (2.50%)** |
| Early withdraw penalty | 300 + B × 50 bps | **450 bps (4.50%)** |
| Default plan tenor | B odd → 180 days | **180 days** |

## Project layout

```
contracts/
  SavingCore.sol           Plans, deposits, withdraw, renew, ERC-721 certificates (holds users' principal)
  VaultManager.sol         Interest pool, fee receiver, pause (holds the bank's money)
  MockUSDC.sol             6-decimal test token, anyone can mint
  interfaces/IVaultManager.sol
  libraries/InterestMath.sol     Interest and penalty formulas
  libraries/InterestMath.t.sol   Solidity unit + fuzz tests for the formulas
test/saving_system.ts      TypeScript integration tests (node:test + viem)
ignition/modules/OnlineBanking.ts   Deployment module
frontend/                  Next.js 14 app (wagmi + viem + Tailwind)
```

## Prerequisites

- Node.js 22 or newer and npm
- MetaMask (or another injected wallet) in your browser — optional, the frontend also runs in demo mode without one

## 1. Install

From the repository root:

```bash
npm install
cd frontend && npm install && cd ..
```

## 2. Compile and test the contracts

```bash
npx hardhat build              # compile
npx hardhat test               # all tests (Solidity + TypeScript)
npx hardhat test solidity      # Solidity tests only
npx hardhat test nodejs        # TypeScript tests only
npx hardhat test --coverage    # with coverage report
```

## 3. Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**.

The app has two modes:

| Mode | When | What it does |
| :-- | :-- | :-- |
| **Demo** | No wallet connected, or wallet on an unsupported network | Simulates the three contracts in the browser with the same rules and revert messages. A banner offers **+1h / +1d / +7d / +30d** buttons to fast-forward time, so you can reach maturity and the grace period. |
| **Live** | Wallet connected to **Sepolia** or **Hardhat Local** | Reads and writes the real contracts. Each transaction is simulated first, so reverts show their reason before the wallet opens. Emitted events appear as toasts. |

Use the **Dashboard / Bank Admin** toggle in the header to switch between the user view and the admin panel.

## 4. Run everything locally (Hardhat node)

Use three terminals.

**Terminal 1 — local chain**

```bash
npx hardhat node
```

This prints 20 funded test accounts with their private keys. Leave it running.

**Terminal 2 — deploy**

```bash
npx hardhat ignition deploy ignition/modules/OnlineBanking.ts --network localhost --reset
```

On a fresh node this deploys to the addresses the frontend already expects:

| Contract | Address |
| :-- | :-- |
| MockUSDC | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| VaultManager | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| SavingCore | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |

`--reset` clears Ignition's saved state from a previous node session. Without it, a redeploy after restarting the node fails. If your addresses differ, set them in `frontend/.env.local`:

```bash
NEXT_PUBLIC_LOCAL_USDC=0x...
NEXT_PUBLIC_LOCAL_VAULT=0x...
NEXT_PUBLIC_LOCAL_SAVING_CORE=0x...
```

**Terminal 3 — frontend**

```bash
cd frontend
npm run dev
```

**Connect MetaMask to the local chain**

1. Add a network: RPC URL `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH`.
2. Import **Account #0** using the private key printed by `npx hardhat node`. It deployed the contracts, so it is the owner and can use the admin panel. These keys are public test keys; never send real funds to them.
3. Open http://localhost:3000, click **Connect Wallet**, and pick **Hardhat Local** from the network menu.

**Set up a working bank (first run)**

A fresh deployment has no plans and an empty vault:

1. Click **Faucet** a few times to mint MockUSDC.
2. **Bank Admin → createPlan**: the form is pre-filled with the personal-variant plan (180 days, 250 bps, 450 bps penalty). Click **Create plan**.
3. **Bank Admin → Vault liquidity**: enter an amount and click **fundVault**, so the vault can pay interest.
4. **Dashboard → Explore Plans → Open Deposit**: approve, then deposit. Your certificate appears under **My Deposits**.

**Fast-forward local chain time** (to test maturity, renewals and auto-renew). From Git Bash, macOS or Linux:

```bash
# 180 days = 15552000 seconds
curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"evm_increaseTime","params":[15552000]}'
curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"evm_mine","params":[]}'
```

If MetaMask later shows nonce errors after restarting the node, clear its activity for that account (Settings → Advanced → Clear activity tab data).

## 5. Deploy to Sepolia

The `sepolia` network reads two config variables. Store them in the Hardhat keystore (or set them as environment variables):

```bash
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat ignition deploy ignition/modules/OnlineBanking.ts --network sepolia
```

The deployer needs Sepolia ETH for gas. After deploying, copy the new addresses from `ignition/deployments/chain-11155111/deployed_addresses.json` into the Sepolia entry of `frontend/config/contracts.ts`. Then create plans and fund the vault from the **Bank Admin** tab while connected with the deployer wallet.

## Updating the frontend ABIs

`frontend/config/abis.ts` is generated from the compiled artifacts. After changing a contract, rebuild and regenerate it from the repository root:

```bash
npx hardhat build
node -e "
const fs=require('fs');let out='// Generated from Hardhat artifacts (artifacts/contracts/*). Recompile and regenerate after changing a contract.\n\n';
for (const [n,c] of [['SavingCore','SAVING_CORE_ABI'],['VaultManager','VAULT_MANAGER_ABI'],['MockUSDC','MOCK_USDC_ABI']]) {
  const a=require('./artifacts/contracts/'+n+'.sol/'+n+'.json').abi; out+='export const '+c+' = '+JSON.stringify(a,null,2)+' as const;\n\n'; }
fs.writeFileSync('frontend/config/abis.ts', out.trimEnd()+'\n');"
```

## Troubleshooting

| Problem | Fix |
| :-- | :-- |
| Frontend shows "Demo mode" while connected | Your wallet is on another network. Switch to Sepolia or Hardhat Local from the wallet menu in the header. |
| "amount below minimum" / "above maximum" | Enter an amount inside the plan's deposit range shown on its card. |
| "ERC20: insufficient allowance" | Complete step 1 (Approve) in the Open Deposit dialog before depositing. |
| "VaultManager: insufficient funds for interest" | The vault cannot cover the interest. An admin must **fundVault**. |
| Admin actions revert with `OwnableUnauthorizedAccount` | Connect the wallet that deployed the contracts. |
| `Cannot find module` errors from `next` | Delete `frontend/node_modules` and `frontend/.next`, then run `npm install` in `frontend/` again. |
