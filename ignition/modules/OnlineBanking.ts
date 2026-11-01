import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OnlineBankingModule", (m) => {
  // Account 0 is the single admin: it deploys (and so owns) VaultManager and SavingCore,
  // and receives early-withdraw penalties. SavingCore reverts if its deployer does not own VaultManager.
  const feeReceiver = m.getAccount(0);

  const mockUSDC = m.contract("MockUSDC");
  const vaultManager = m.contract("VaultManager", [mockUSDC, feeReceiver]);
  const savingCore = m.contract("SavingCore", [mockUSDC, vaultManager]);

  m.call(vaultManager, "setAuthorizedCaller", [savingCore, true]);

  return { mockUSDC, vaultManager, savingCore };
});
