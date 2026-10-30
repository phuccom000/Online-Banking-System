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

## Design Answers

Answers to the open questions in Section 8.2. Line numbers refer to [contracts/SavingCore.sol](contracts/SavingCore.sol) unless stated otherwise.

### 1. Transferable certificate

Bob can withdraw, and Alice cannot. Every user action checks the current NFT holder, not the original depositor: `require(ownerOf(depositId) == msg.sender, ...)` in `withdrawAtMaturity` ([L142](contracts/SavingCore.sol#L142)), `earlyWithdraw` ([L164](contracts/SavingCore.sol#L164)) and `renewDeposit` ([L186](contracts/SavingCore.sol#L186)). Auto-renew also mints the new certificate to whoever holds the old one ([L264](contracts/SavingCore.sol#L264)). This is useful, because a locked deposit becomes a sellable asset and Alice can get liquidity without paying the early-withdraw penalty. It is also dangerous in two ways. If Alice is phished into transferring or approving the NFT, the attacker owns her principal. And the NFT is not burned after a withdraw or renew, so Bob could buy a "certificate" that is already worth nothing. A buyer must check `getDeposit(id).status == Active` before paying.

### 2. Empty vault

I follow the base rule and revert. In `withdrawAtMaturity` the principal is sent first ([L154](contracts/SavingCore.sol#L154)), then `vaultManager.payInterest` ([L157](contracts/SavingCore.sol#L157)) reverts with `"VaultManager: insufficient funds for interest"` ([VaultManager.sol L57](contracts/VaultManager.sol#L57)), which undoes the principal transfer too. The problem is that the user's own principal is then stuck: `earlyWithdraw` is not an escape route, because it only works before maturity ([L167](contracts/SavingCore.sol#L167)), and `renewDeposit` also needs the vault to pay interest. A fairer design would pay the principal now and record the interest as a debt the user can claim once the vault is funded (Creative Challenge C1). I kept the revert because rule 5 asks for it, it keeps the two contracts simple, and it never lets SavingCore pay interest out of other users' principal. The trade-off is that the user depends on the admin keeping the vault funded.

### 3. Dead bot

Nothing is lost from the principal, and the deposit is not locked: after the grace period it stays `Active`, so the user can still call `withdrawAtMaturity` or `renewDeposit` at any time, since neither has an upper time limit. When the bot comes back, `autoRenewDeposit` starts the new term at the current time (`newMaturityAt = block.timestamp + tenor`, [L251](contracts/SavingCore.sol#L251)). Interest is only ever paid for the fixed tenor, so the month between maturity and the late renewal earns nothing. For 1,000 USDC at 250 bps, a 30-day delay costs about 2.05 USDC. My proposed fix is to backdate the renewal: set the new `startAt` to `maturityAt + GRACE_PERIOD` and the new `maturityAt` to `startAt + tenor`, so the user is credited from the moment the renewal should have happened. Today only the NFT owner or the admin can trigger auto-renew ([L229](contracts/SavingCore.sol#L229)). Making it callable by anyone would also let any keeper step in when the bank's bot is down.

### 4. Rounding dust

The vault keeps the dust. `InterestMath.interest` multiplies everything first and divides once at the end, so the result is rounded down, and the vault pays exactly that rounded-down amount. For the penalty, the rounding goes the other way: `InterestMath.penalty` also rounds down, so the fee receiver gets slightly less and the user keeps that dust. Rounding cannot cause a revert or a wrong balance. Interest is never more than the exact value, so it is never more than the vault was expected to pay. When interest rounds to 0 the vault call is skipped (`if (interest > 0)`, [L156](contracts/SavingCore.sol#L156)), which avoids `payInterest`'s `amount > 0` check. On renew, the vault sends exactly `interest` into SavingCore and the new principal is `principal + interest`, so SavingCore's balance still backs every deposit. Proof is in [contracts/libraries/InterestMath.t.sol](contracts/libraries/InterestMath.t.sol): `testFuzz_RoundingNeverOverpays` checks `paid * denominator <= numerator` for random inputs, and `test_InterestPersonalVariant` shows 1,000 USDC for 180 days at 250 bps pays 12,328,767 units while the exact value is 12,328,767.12. The TypeScript renew tests also check that SavingCore's balance grows by exactly the interest.

### 5. Boundary times

At exactly `maturityAt` the deposit counts as matured. `withdrawAtMaturity` uses `block.timestamp >= deposit.maturityAt` ([L145](contracts/SavingCore.sol#L145)) and `earlyWithdraw` uses `block.timestamp < deposit.maturityAt` ([L167](contracts/SavingCore.sol#L167)). The two conditions are exact opposites, so at every second exactly one of them is allowed, never both and never neither. Manual renew uses the same `>=` ([L189](contracts/SavingCore.sol#L189)) and has no upper limit, so at the exact end of the grace period the user can still renew manually. Auto-renew uses `block.timestamp >= maturityAt + GRACE_PERIOD_DAYS * 86400` ([L233](contracts/SavingCore.sol#L233)), because at that second the full 4 days have passed. So at that exact second both calls are valid. Whichever transaction is mined first wins, and the other reverts with `"deposit not active"`. I chose this so the user is never locked out of their own choice. The bot only acts once the grace period is fully over.

### 6. Disabled plan with active deposits

Disabling a plan only stops new money from entering it. The only check on `plan.enabled` is in `openDeposit` ([L107](contracts/SavingCore.sol#L107)) and on the target plan in `renewDeposit` ([L193](contracts/SavingCore.sol#L193)). Users in a disabled plan can still `earlyWithdraw`, `withdrawAtMaturity`, and be auto-renewed with their locked tenor and APR, because those functions only read the deposit's snapshot. They cannot manually renew *into* the disabled plan, and they cannot manually renew from it into another disabled plan. My reasoning: a manual renew is a new choice of product, the same as opening a new deposit, so it must respect the bank's decision to stop selling that plan. Auto-renew is different. It is the continuation the user was promised when they opened the deposit, and rule 7 says the admin cannot change an open deposit, so disabling the plan must not break it.

### 7. Attack thinking: double withdraw and reentrancy

The realistic attack is to withdraw the same deposit twice: either by sending the call twice, or by re-entering during the payout. `renewDeposit` and `autoRenewDeposit` use `_safeMint`, which calls `onERC721Received` on a contract owner, so an attacker contract gets control in the middle of the function. Every user function follows checks-effects-interactions. It first requires `status == Active`, then sets the new status before any token transfer or mint: `deposit.status = DepositStatus.Withdrawn` ([L151](contracts/SavingCore.sol#L151), [L173](contracts/SavingCore.sol#L173)) and `deposit.status = DepositStatus.ManualRenewed` ([L202](contracts/SavingCore.sol#L202)) come before the transfers and the `_safeMint` at [L224](contracts/SavingCore.sol#L224). If the attacker re-enters from `onERC721Received`, the old deposit is already marked as no longer active, and `nextDepositId` was already increased, so the call reverts with `"SavingCore: deposit not active"`. A fake-token attack is also blocked: `usdc` is `immutable` and set in the constructor, so users cannot choose the token. And only addresses the admin authorizes can call `VaultManager.payInterest` (`onlyAuthorized`, [VaultManager.sol L26](contracts/VaultManager.sol#L26)), which the test "should prevent unauthorized users from paying interest via VaultManager" covers.

## Troubleshooting

| Problem | Fix |
| :-- | :-- |
| Frontend shows "Demo mode" while connected | Your wallet is on another network. Switch to Sepolia or Hardhat Local from the wallet menu in the header. |
| "amount below minimum" / "above maximum" | Enter an amount inside the plan's deposit range shown on its card. |
| "ERC20: insufficient allowance" | Complete step 1 (Approve) in the Open Deposit dialog before depositing. |
| "VaultManager: insufficient funds for interest" | The vault cannot cover the interest. An admin must **fundVault**. |
| Admin actions revert with `OwnableUnauthorizedAccount` | Connect the wallet that deployed the contracts. |
| `Cannot find module` errors from `next` | Delete `frontend/node_modules` and `frontend/.next`, then run `npm install` in `frontend/` again. |
