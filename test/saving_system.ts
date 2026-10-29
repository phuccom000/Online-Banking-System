import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("SavingCore & VaultManager Integration", async function () {
  const { viem, networkHelpers } = await network.create();

  async function deploySavingSystem() {
    const [owner, user, feeReceiver] = await viem.getWalletClients();

    const mockUSDC = await viem.deployContract("MockUSDC");
    const vaultManager = await viem.deployContract("VaultManager", [
      mockUSDC.address,
      feeReceiver.account.address,
    ]);
    const savingCore = await viem.deployContract("SavingCore", [
      mockUSDC.address,
      vaultManager.address,
    ]);

    // Authorize SavingCore to pay interest/penalty via VaultManager
    await vaultManager.write.setAuthorizedCaller([savingCore.address, true]);

    // Fund the vault with USDC for interest payments
    const vaultFundingAmount = 1000000n * 10n**6n; // 1M USDC
    await mockUSDC.write.mint([owner.account.address, vaultFundingAmount]);
    await mockUSDC.write.approve([vaultManager.address, vaultFundingAmount], {
      account: owner.account,
    });
    await vaultManager.write.fundVault([vaultFundingAmount]);

    // Give user some USDC
    const userDepositAmount = 1000n * 10n**6n; // 1k USDC
    await mockUSDC.write.mint([user.account.address, userDepositAmount]);
    await mockUSDC.write.approve([savingCore.address, userDepositAmount], {
      account: user.account,
    });

    return {
      savingCore,
      vaultManager,
      mockUSDC,
      owner,
      user,
      feeReceiver,
      userDepositAmount,
    };
  }

  const {
    savingCore,
    vaultManager,
    mockUSDC,
    owner,
    user,
    feeReceiver,
    userDepositAmount,
  } = await networkHelpers.loadFixture(deploySavingSystem);

  it("should allow creating a plan and opening a deposit", async function () {
    const tenorDays = 180n; // Personal Variant
    const aprBps = 250n; // Personal Variant: 2.50%
    const minDeposit = 100n * 10n**6n;
    const maxDeposit = 10000n * 10n**6n;
    const penaltyBps = 450n; // Personal Variant: 4.50%

    await savingCore.write.createPlan([tenorDays, aprBps, minDeposit, maxDeposit, penaltyBps]);

    const planId = 1n;
    await savingCore.write.openDeposit([planId, userDepositAmount], {
      account: user.account,
    });

    const deposit = await savingCore.read.getDeposit([1n]);
    assert.strictEqual(deposit.principal, userDepositAmount);
    assert.strictEqual(deposit.status, 0); // Active
    assert.strictEqual((await savingCore.read.ownerOf([1n])).toLowerCase(), user.account.address.toLowerCase());
  });

  it("should handle plan updates without affecting existing deposits", async function () {
    const planId = 1n;
    const oldApr = 250n;
    const newApr = 500n;

    // Mint and approve additional USDC for this test to avoid balance issues
    await mockUSDC.write.mint([user.account.address, userDepositAmount], {
      account: owner.account,
    });
    await mockUSDC.write.approve([savingCore.address, userDepositAmount], {
      account: user.account,
    });

    // Deposit opened with old APR
    await savingCore.write.openDeposit([planId, userDepositAmount], {
      account: user.account,
    });

    // In Hardhat, we need to be careful about IDs if previous tests shared state.
    const nextId = await savingCore.read.nextDepositId();
    const depositId = nextId - 1n;

    // Update plan APR
    await savingCore.write.updatePlan([planId, newApr]);

    const deposit = await savingCore.read.getDeposit([depositId]);
    assert.strictEqual(deposit.aprBpsAtOpen, oldApr, "Existing deposit should keep original APR");
  });

  it("should prevent deposits into disabled plans", async function () {
    const planId = 1n;
    await savingCore.write.disablePlan([planId]);

    await viem.assertions.revert(
      savingCore.write.openDeposit([planId, userDepositAmount], { account: user.account }),
      "SavingCore: plan is disabled"
    );

    await savingCore.write.enablePlan([planId]);
  });

  it("should enforce min and max deposit limits", async function () {
    const planId = 1n;
    const plan = await savingCore.read.getPlan([planId]);

    const tooLow = plan.minDeposit - 1n;
    await viem.assertions.revert(
      savingCore.write.openDeposit([planId, tooLow], { account: user.account }),
      "SavingCore: amount below minimum"
    );

    const tooHigh = plan.maxDeposit + 1n;
    await viem.assertions.revert(
      savingCore.write.openDeposit([planId, tooHigh], { account: user.account }),
      "SavingCore: amount above maximum"
    );
  });

  it("should handle early withdrawal with penalty", async function () {
    const depositId = 1n;
    const principal = userDepositAmount;
    const penaltyBps = 450n; // Personal Variant: 4.50%
    const expectedPenalty = (principal * penaltyBps) / 10000n;
    const expectedUserReceives = principal - expectedPenalty;

    const balanceBefore = await mockUSDC.read.balanceOf([user.account.address]);

    await savingCore.write.earlyWithdraw([depositId], {
      account: user.account,
    });

    const balanceAfter = await mockUSDC.read.balanceOf([user.account.address]);
    assert.strictEqual(balanceAfter - balanceBefore, expectedUserReceives);

    const deposit = await savingCore.read.getDeposit([depositId]);
    assert.strictEqual(deposit.status, 1); // Withdrawn
  });

  it("should allow withdrawal at maturity", async function () {
    // Create a new deposit to test maturity
    const tenorDays = 1n;
    const aprBps = 1000n; // 10%

    // Ensure we use a new plan ID. The previous tests might have created several.
    const currentPlanId = await savingCore.read.nextPlanId();
    await savingCore.write.createPlan([tenorDays, aprBps, 0n, 0n, 0n]);
    const planId = currentPlanId;

    const amount = 500n * 10n**6n;
    await mockUSDC.write.mint([user.account.address, amount]);
    await mockUSDC.write.approve([savingCore.address, amount], { account: user.account });

    await savingCore.write.openDeposit([planId, amount], { account: user.account });

    const nextDepId = await savingCore.read.nextDepositId();
    const depositId = nextDepId - 1n;

    // Fast forward time to maturity
    await networkHelpers.time.increase(Number(tenorDays * 86400n));

    const balanceBefore = await mockUSDC.read.balanceOf([user.account.address]);
    await savingCore.write.withdrawAtMaturity([depositId], { account: user.account });
    const balanceAfter = await mockUSDC.read.balanceOf([user.account.address]);

    // Interest = (principal * aprBps * tenorSeconds) / (SECONDS_PER_YEAR * BASIS_POINTS)
    const interest = (amount * aprBps * (tenorDays * 86400n)) / (365n * 86400n * 10000n);
    assert.strictEqual(balanceAfter - balanceBefore, amount + interest);
  });

  it("should prevent unauthorized users from paying interest via VaultManager", async function () {
    await viem.assertions.revert(
      vaultManager.write.payInterest([user.account.address, 100n], { account: user.account }),
      "VaultManager: not authorized"
    );
  });

  it("should allow manual renewal compounding interest", async function () {
    // Setup a short term deposit for quick testing
    const tenorDays = 1n;
    const aprBps = 1000n; // 10%
    const currentPlanId = await savingCore.read.nextPlanId();
    await savingCore.write.createPlan([tenorDays, aprBps, 0n, 0n, 0n]);
    const planId = currentPlanId;

    const amount = 1000n * 10n**6n;
    await mockUSDC.write.mint([user.account.address, amount], { account: owner.account });
    await mockUSDC.write.approve([savingCore.address, amount], { account: user.account });
    await savingCore.write.openDeposit([planId, amount], { account: user.account });

    const depId = (await savingCore.read.nextDepositId()) - 1n;
    await networkHelpers.time.increase(Number(tenorDays * 86400n));

    // Setup a second plan for renewal
    const renewalTenor = 2n;
    const renewalApr = 500n;
    const renewalPlanId = (await savingCore.read.nextPlanId());
    await savingCore.write.createPlan([renewalTenor, renewalApr, 0n, 0n, 0n]);

    const balanceBefore = await mockUSDC.read.balanceOf([user.account.address]);
    await savingCore.write.renewDeposit([depId, renewalPlanId], { account: user.account });
    const balanceAfter = await mockUSDC.read.balanceOf([user.account.address]);

    // Principal stays in contract, so user balance shouldn't change
    assert.strictEqual(balanceBefore, balanceAfter);

    const newDepId = (await savingCore.read.nextDepositId()) - 1n;
    const newDeposit = await savingCore.read.getDeposit([newDepId]);

    const expectedInterest = (amount * aprBps * (tenorDays * 86400n)) / (365n * 86400n * 10000n);
    assert.strictEqual(newDeposit.principal, amount + expectedInterest);
    assert.strictEqual(newDeposit.aprBpsAtOpen, renewalApr);
  });

  it("should handle auto-renewal after grace period", async function () {
    const tenorDays = 1n;
    const aprBps = 1000n;
    const currentPlanId = await savingCore.read.nextPlanId();
    await savingCore.write.createPlan([tenorDays, aprBps, 0n, 0n, 0n]);
    const planId = currentPlanId;

    const amount = 1000n * 10n**6n;
    await mockUSDC.write.mint([user.account.address, amount], { account: owner.account });
    await mockUSDC.write.approve([savingCore.address, amount], { account: user.account });
    await savingCore.write.openDeposit([planId, amount], { account: user.account });

    const depId = (await savingCore.read.nextDepositId()) - 1n;

    // Fast forward to maturity
    await networkHelpers.time.increase(Number(tenorDays * 86400n));

    // 1. Try to auto-renew BEFORE grace period (4 days)
    await viem.assertions.revert(
      savingCore.write.autoRenewDeposit([depId], { account: user.account }),
      "SavingCore: grace period not ended"
    );

    // 2. Fast forward past grace period
    await networkHelpers.time.increase(Number(4n * 86400n + 1n));

    // 3. Auto-renew should now succeed
    await savingCore.write.autoRenewDeposit([depId], { account: user.account });

    const newDepId = (await savingCore.read.nextDepositId()) - 1n;
    const newDeposit = await savingCore.read.getDeposit([newDepId]);

    // Verify original APR is locked
    assert.strictEqual(newDeposit.aprBpsAtOpen, aprBps, "Auto-renew must lock original APR");

    const expectedInterest = (amount * aprBps * (tenorDays * 86400n)) / (365n * 86400n * 10000n);
    assert.strictEqual(newDeposit.principal, amount + expectedInterest);
  });
});
