# Plan: Online Banking System (Monday - Thursday)

**Student ID:** 21125132  
**Today:** Monday, Oct 26, 2026  
**Target Completion:** Thursday, Oct 29, 2026  
**Project:** Blockchain-based term deposit system (MockUSDC + VaultManager + SavingCore with ERC721)

## Personal Variant (Computed)

Based off of your student ID, these are the values that you *must* use for your contracts, tests, README and demo video. 

| Parameter | Formula | Calculation | Final Value |
| :-- | :-- | :-- | :-- |
| A (Last Digit) | N/A | Last digit of 21125132 | `2` |
| B (Second to last digit) | N/A | Second to last digit of 21125132 | `3` |
| Grace Period (Auto-Renew) | `(A mod 3) + 2` days | `(2 mod 3) + 2` | **4 Days** |
| Default Plan APR | `(200 + A * 25)` bps | `(200 + 2 * 25) = 200 + 50` | **250 bps (2.50%)** |
| Early Withdraw Penalty | `(300 + B * 50)` bps | `(300 + 3 * 50) = 300 + 150` | **450 bps (4.50%)** |
| Default Plan Tenor | B even = 90 days, B odd = 180 days | B = 3 (Odd) | **180 Days** | 

> Put these values at the very top of your `README.md` as requested by the assignment. 


---


## MONDAY (Oct 26) - Setup, Analysis & Design 
*Goal: Fully understand the assignment and design your architecture before writing any code.* 

| Task | Time | Details |
| :-- | :-- | :-- |
| [ ] Re-read the full assignment | 1 - 2h | Focus heavily on sections 3 (User Flows), 6 (Business Rules), 8.1 and 8.2. Pay extra attention to the interest formula and auto-renew rules. |
| [ ] Record your personal variant | 5 - 10min | Add the table above to your notes and plan to put it into your README. |
| [ ] Analyze the current repo | 30 - 45min | Look over `hardhat.config.ts`, `package.json`, `AGENTS.md` and the already existing files. This project uses Hardhat 3, `node:test` and `viem`. Do not try to use ethers.js as it's not the standard here. |
| [ ] Design contract architecture | 2 - 3h | Plan interactions between `MockUSDC`, `VaultManager` and `SavingCore`. Decide on access control (e.g `Ownable`), how to authorize `SavingCore` to call `VaultManager` to pay interest/penalties, and your storage layout for plans and deposits. |
| [ ] Plan tests based off of section 7.2 | 1h | Create a checklist of every required test case and map them to your personal variant values (e.g test auto-renew against a 4 day grace period). |
| [ ] Environment setup | 15 - 30min | Run `npm install`, then `npx hardhat compile` to verify that the base project compiles as is. | 

**Deliverable:** A design document/notes consisting of your planned function signatures, state variables, access control, event emissions and your personal variant values. 



---


## TUESDAY (Oct 27) - Core Contracts
*Goal: Implement all three required contracts to satisfy the base flows.* 

| Task | Time | Details |
| :-- | :-- | :-- |
| [ ] Create `contracts/MockUSDC.sol` | 30 - 45min | ERC20 with 6 decimals. Add a `mint(address to, uint256 amount)` function for testing purposes. Be extremely careful to not assume 18 decimals anywhere. |
| [ ] Create `contracts/VaultManager.sol` | 2 - 3h | Hold the interest pool. Implement `fundVault`, `withdrawVault`, `setFeeReceiver`, `pause`/`unpause`. Only allow authorized callers (e.g only `SavingCore`) to pay out interest and penalties. Keep track of balances. This is the "bank's money" pool. |
| [ ] Create `contracts/SavingCore.sol` | 4 - 6h | Core logic. Utilize OpenZeppelin's `ERC721`, `Ownable` and `Pausable` if desired (just understand them). Implement saving plans, deposits (with snapshots of `aprBpsAtOpen` and `earlyWithdrawPenaltyBpsAtOpen`), `openDeposit`, `withdrawAtMaturity`, `earlyWithdraw`, `renewDeposit` (manual) and `autoRenewDeposit`. |
| [ ] Implement interest & penalty math | 1h | Use the exact formula from the assignment. *Always multiply before dividing* (e.g `(principal * aprBpsAtOpen * tenorSeconds) / (365 days * 10000)`). Account for 6 decimals when calculating and testing. |
| [ ] Emit all required events | 30min | Emit `PlanCreated`, `PlanUpdated`, `DepositOpened`, `Withdrawn` and `Renewed` with the exact parameters specified in section 5. |
| [ ] Compile and sanity check | 15min | Run `npx hardhat compile` and fix any compilation errors. | 

**Key Focuses:** Separation of principal (SavingCore) and interest (VaultManager), snapshots, 6 decimal precision, and the 4 day grace period for auto renewals. 



---


## WEDNESDAY (Oct 28) - Tests & Edge Cases
*Goal: Write a comprehensive test suite with >90% coverage. All tests must utilize your personal variant.* 

| Task | Time | Details |
| :-- | :-- | :-- |
| [ ] Set up test files | 30min | Utilize Hardhat 3's `node:test` runner with `viem` (as per the repo's setup). Create tests under `test/` (TypeScript). Solidity unit tests can go in `contracts/` or `test/` depending on preference. |
| [ ] Plan management tests | 45 - 60min | Test `createPlan` (valid and invalid APR), `updatePlan` (verify it only affects new deposits), `enablePlan` and `disablePlan`. |
| [ ] Deposit tests | 1 - 2h | Test `openDeposit` happy path, below min, above max, disabled plan, and verify that `aprBpsAtOpen` and penalty are snapshotted correctly. |
| [ ] Maturity & early withdrawal tests | 2h | Test `withdrawAtMaturity` with correct interest from the vault, test `earlyWithdraw` paying 0 interest with 450 bps penalty going to `feeReceiver`, and test double withdraw prevention. |
| [ ] Renew tests | 2h | Test `renewDeposit` (manual) compounding interest into new principal, test `autoRenewDeposit` *before* the 4 day grace period (must revert), test *after* grace period (must succeed), and most importantly verify the **original APR is locked** for auto-renew (do not use the updated plan APR). |
| [ ] Vault & admin tests | 1 - 2h | Test funding/withdrawing the vault, test insufficient vault funds causing a revert on interest payout, test `pause()` blocking withdrawals and renewals, and test `unpause()`. |
| [ ] Edge cases | 1 - 2h | Test NFT transferability (see question 1), boundary timestamps (`>=` vs `>` for maturity and grace period), disabled plans with already active deposits, rounding dust, and ensure admin cannot mutate existing deposits. |
| [ ] Coverage check | 30min | Run tests and aim for >90% coverage. Add any missing tests before moving onto Thursday. | 

**Note:** When fast forwarding time for maturity/grace period, use Hardhat's time manipulation utilities. All of these tests must explicitly use your computed values (4 day grace period, 250 bps APR, 450 bps penalty, 180 day tenor). 



---


## THURSDAY (Oct 29) - Frontend, README, Polish & Prep
*Goal: Finalize all deliverables for submission and prepare for the oral defense.* 

| Task | Time | Details |
| :-- | :-- | :-- |
| [ ] Frontend (React) | 3 - 4h | Create a simple React frontend that connects to MetaMask. Implement views to see available plans, open a deposit (approve + deposit), view active deposits owned by the connected wallet (via NFT ownership), and buttons to withdraw/renew a deposit. Don't over engineer, functionality is what's being tested. |
| [ ] Write README.md | 2 - 3h | Add setup instructions (`npm install`, compile, test, deploy), how to run the frontend, your personal variant table at the top, your architecture explanation (why the 3 contracts are split), and your "Design Answers" section. |
| [ ] Answer all Design Questions (Section 8.2) | 1 - 2h | Answer *all 7 questions* in your own words. For every answer, reference specific functions/lines from your code (e.g. "see `withdrawAtMaturity` in SavingCore.sol: L###, uses `>=` for..."). Be able to defend these live, as the teacher will pick 2-3 at random. |
| [ ] (Optional but recommended) Creative Challenges | 1 - 3h | If time permits, attempt at most one or two of the bonus challenges (C1-C4). If you do, create their own tests and a short "Bonus" section in your README describing the problem, solution and trade-offs. Remember max +10 and base flows must still pass. |
| [ ] End-to-end integration test | 45 - 60min | Test the full flow through your frontend or via scripts (open deposit with MockUSDC, fund vault, wait to maturity/early withdraw, renew). Verify events are emitted correctly. |
| [ ] Demo video script & practice | 30 - 60min | Record a 3-5 minute walkthrough of your frontend showing opening a deposit, viewing it, withdrawing/renewing. Be sure to showcase your personal variant numbers within the demo. |
| [ ] Final checks | 30min | Verify all required events exist, tests pass (`npx hardhat test`), coverage >90%, README is complete, personal variant is correct, and your code is clean/readable with comments where needed. | 

**Deliverable:** Fully complete submission ready to be pushed to GitHub with README, tests, contracts, frontend and your demo video. 


---


## Quick Commands & Reminders 

```bash
# Setup
npm install

# Compile
npx hardhat compile

# Run all tests
npx hardhat test

# Run specific test types
npx hardhat test nodejs
npx hardhat test solidity
```

### Critical Reminders
- **Separation:** `SavingCore` holds principal, `VaultManager` holds interest. Interest *must* come from the vault. 
- **Snapshots:** `aprBpsAtOpen` and penalty must be locked at `openDeposit`. Plan updates must never affect existing deposits.
- **Precision:** Multiply before dividing for interest. `MockUSDC` is 6 decimals, not 18. Store amounts in smallest units.
- **Auto-Renew:** Same tenor as original, original APR locked, only executable after maturity + **4 days** grace period. 
- **Vault safety:** If the vault does not have enough funds for interest, the withdrawal must revert (Base rule). Be prepared to defend your stance on this for question 2.
- **Security:** Prevent double withdrawals, think about reentrancy, and be explicit about your `>=` vs `>` choices for all time based comparisons. 
- **Your Variant:** Your tests and demo *must* use 250 bps, 450 bps, 180 days and a 4 day grace period at all times. 

**Note:** For the oral defense, know your codebase like the back of your hand. The grade is heavily reliant on being able to explain your design answers whilst pointing to the exact lines of code that enforce them. Good luck!