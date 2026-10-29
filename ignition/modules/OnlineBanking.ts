import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("OnlineBankingModule", (m) => {
  const feeReceiver = m.getAccount(0);

  const mockUSDC = m.contract("MockUSDC");
  const vaultManager = m.contract("VaultManager", [mockUSDC, feeReceiver]);
  const savingCore = m.contract("SavingCore", [mockUSDC, vaultManager]);

  m.call(vaultManager, "setAuthorizedCaller", [savingCore, true]);

  return { mockUSDC, vaultManager, savingCore };
});
