import { network } from "hardhat";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Teacher feedback: burn the NFT after withdrawal, burn the old NFT on renew (and link old -> new),
// and keep exactly one admin account.
describe("Certificate burning, renewal links and single admin", async function () {
  const { viem, networkHelpers } = await network.create();
  const USDC = 10n ** 6n;
  const DAY = 86400n;
  // Personal variant: 180 days, 250 bps APR, 450 bps penalty, 4-day grace period
  const TENOR = 180n;
  const APR = 250n;
  const PENALTY = 450n;
  const GRACE = 4n;

  async function deploy() {
    const [admin, user, other] = await viem.getWalletClients();
    const usdc = await viem.deployContract("MockUSDC");
    // The admin is also the fee receiver: one account runs the bank
    const vault = await viem.deployContract("VaultManager", [usdc.address, admin.account.address]);
    const core = await viem.deployContract("SavingCore", [usdc.address, vault.address]);
    await vault.write.setAuthorizedCaller([core.address, true]);

    await usdc.write.mint([admin.account.address, 1_000_000n * USDC]);
    await usdc.write.approve([vault.address, 1_000_000n * USDC]);
    await vault.write.fundVault([1_000_000n * USDC]);

    await core.write.createPlan([TENOR, APR, 0n, 0n, PENALTY]); // plan 1: personal-variant default
    await core.write.createPlan([90n, 300n, 0n, 0n, PENALTY]); // plan 2: renewal target

    await usdc.write.mint([user.account.address, 10_000n * USDC]);
    await usdc.write.approve([core.address, 10_000n * USDC], { account: user.account });
    return { admin, user, other, usdc, vault, core };
  }

  async function withDeposit(amount = 1_000n * USDC) {
    const ctx = await networkHelpers.loadFixture(deploy);
    await ctx.core.write.openDeposit([1n, amount], { account: ctx.user.account });
    return { ...ctx, id: 1n, amount };
  }

  const same = (a: string, b: string) => assert.equal(a.toLowerCase(), b.toLowerCase());

  it("burns the certificate after withdrawAtMaturity", async function () {
    const { core, usdc, user, id, amount } = await withDeposit();
    assert.equal(await core.read.balanceOf([user.account.address]), 1n);

    await networkHelpers.time.increase(Number(TENOR * DAY));
    const before = await usdc.read.balanceOf([user.account.address]);
    await core.write.withdrawAtMaturity([id], { account: user.account });

    const interest = (amount * APR * TENOR * DAY) / (365n * DAY * 10000n);
    assert.equal((await usdc.read.balanceOf([user.account.address])) - before, amount + interest);
    assert.equal(await core.read.balanceOf([user.account.address]), 0n);
    await viem.assertions.revertWithCustomErrorWithArgs(core.read.ownerOf([id]), core, "ERC721NonexistentToken", [id]);

    const d = await core.read.getDeposit([id]);
    assert.equal(d.status, 1); // Withdrawn
    same(d.closedBy, user.account.address);

    // A burned certificate cannot be withdrawn twice
    await viem.assertions.revertWithCustomErrorWithArgs(
      core.write.withdrawAtMaturity([id], { account: user.account }),
      core,
      "ERC721NonexistentToken",
      [id],
    );
  });

  it("burns the certificate after earlyWithdraw (450 bps penalty)", async function () {
    const { core, usdc, user, admin, id, amount } = await withDeposit();
    const feeBefore = await usdc.read.balanceOf([admin.account.address]);
    await core.write.earlyWithdraw([id], { account: user.account });

    assert.equal((await usdc.read.balanceOf([admin.account.address])) - feeBefore, (amount * PENALTY) / 10000n);
    assert.equal(await core.read.balanceOf([user.account.address]), 0n);
    await viem.assertions.revertWithCustomErrorWithArgs(
      core.write.earlyWithdraw([id], { account: user.account }),
      core,
      "ERC721NonexistentToken",
      [id],
    );
  });

  it("renewDeposit burns the old NFT, mints a new one and links them", async function () {
    const { core, user, id, amount } = await withDeposit();
    await networkHelpers.time.increase(Number(TENOR * DAY));

    await viem.assertions.emitWithArgs(
      core.write.renewDeposit([id, 2n], { account: user.account }),
      core,
      "Renewed",
      [id, 2n, (p: bigint) => p > amount, 2n],
    );

    await viem.assertions.revertWithCustomErrorWithArgs(core.read.ownerOf([id]), core, "ERC721NonexistentToken", [id]);
    same(await core.read.ownerOf([2n]), user.account.address);
    assert.equal(await core.read.balanceOf([user.account.address]), 1n);

    const oldD = await core.read.getDeposit([id]);
    const newD = await core.read.getDeposit([2n]);
    assert.equal(oldD.status, 2); // ManualRenewed
    assert.equal(oldD.renewedTo, 2n);
    assert.equal(newD.renewedFrom, id);
    assert.equal(newD.renewedTo, 0n);
    assert.equal(newD.aprBpsAtOpen, 300n);

    // The old certificate is useless: it cannot be renewed again
    await viem.assertions.revertWithCustomErrorWithArgs(
      core.write.renewDeposit([id, 2n], { account: user.account }),
      core,
      "ERC721NonexistentToken",
      [id],
    );
  });

  it("autoRenewDeposit by the admin mints the new NFT to the holder, not the admin", async function () {
    const { core, user, admin, id } = await withDeposit();
    await networkHelpers.time.increase(Number((TENOR + GRACE) * DAY));
    await core.write.updatePlan([1n, 500n]); // must not affect the locked APR

    await core.write.autoRenewDeposit([id], { account: admin.account });

    same(await core.read.ownerOf([2n]), user.account.address);
    assert.equal(await core.read.balanceOf([admin.account.address]), 0n);
    await viem.assertions.revertWithCustomErrorWithArgs(core.read.ownerOf([id]), core, "ERC721NonexistentToken", [id]);

    const oldD = await core.read.getDeposit([id]);
    const newD = await core.read.getDeposit([2n]);
    assert.equal(oldD.status, 3); // AutoRenewed
    same(oldD.closedBy, user.account.address);
    assert.equal(oldD.renewedTo, 2n);
    assert.equal(newD.renewedFrom, id);
    assert.equal(newD.aprBpsAtOpen, APR);
    assert.equal(newD.tenorDaysAtOpen, TENOR);
  });

  it("a renewal chain keeps only the latest certificate alive", async function () {
    const { core, user, id } = await withDeposit();
    await networkHelpers.time.increase(Number(TENOR * DAY));
    await core.write.renewDeposit([id, 2n], { account: user.account }); // #1 -> #2
    await networkHelpers.time.increase(Number(90n * DAY));
    await core.write.renewDeposit([2n, 1n], { account: user.account }); // #2 -> #3

    assert.equal(await core.read.balanceOf([user.account.address]), 1n);
    assert.equal((await core.read.getDeposit([3n])).renewedFrom, 2n);
    assert.equal((await core.read.getDeposit([2n])).renewedFrom, 1n);
    assert.equal((await core.read.getDeposit([2n])).renewedTo, 3n);
  });

  it("allows only one admin account", async function () {
    const { core, vault, usdc, admin, user, other } = await networkHelpers.loadFixture(deploy);

    // SavingCore cannot be deployed by anyone other than the VaultManager owner
    await viem.assertions.revertWith(
      viem.deployContract("SavingCore", [usdc.address, vault.address], { client: { wallet: other } }),
      "SavingCore: admin must own VaultManager",
    );

    // Ownership can never move to a second account
    await viem.assertions.revertWith(
      core.write.transferOwnership([user.account.address]),
      "SavingCore: single admin, ownership is fixed",
    );
    await viem.assertions.revertWith(core.write.renounceOwnership(), "SavingCore: single admin, ownership is fixed");
    await viem.assertions.revertWith(
      vault.write.transferOwnership([user.account.address]),
      "VaultManager: single admin, ownership is fixed",
    );
    await viem.assertions.revertWith(vault.write.renounceOwnership(), "VaultManager: single admin, ownership is fixed");
    same(await core.read.owner(), admin.account.address);
    same(await vault.read.owner(), admin.account.address);

    // Users get no admin powers
    await viem.assertions.revertWithCustomErrorWithArgs(
      core.write.createPlan([30n, 100n, 0n, 0n, 0n], { account: user.account }),
      core,
      "OwnableUnauthorizedAccount",
      [user.account.address],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      vault.write.fundVault([1n], { account: user.account }),
      vault,
      "OwnableUnauthorizedAccount",
      [user.account.address],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(
      core.write.pause({ account: user.account }),
      core,
      "OwnableUnauthorizedAccount",
      [user.account.address],
    );
  });
});
