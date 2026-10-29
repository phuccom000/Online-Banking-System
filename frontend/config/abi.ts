export const CONTRACT_ADDRESSES = {
  SavingCore: "0x35c01ecB096caFa80401Ead21c6F4274d455a9bc",
  USDC: "0x55603EB67953fa50851159350FA1A9f55A529f5E",
};

export const SAVING_CORE_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "planId", "type": "uint256" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "openDeposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [ { "internalType": "uint256", "name": "planId", "type": "uint256" } ],
    "name": "getPlan",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "tenorDays", "type": "uint256" },
          { "internalType": "uint256", "name": "aprBps", "type": "uint256" },
          { "internalType": "uint256", "name": "minDeposit", "type": "uint256" },
          { "internalType": "uint256", "name": "maxDeposit", "type": "uint256" },
          { "internalType": "uint256", "name": "earlyWithdrawPenaltyBps", "type": "uint256" },
          { "internalType": "bool", "name": "enabled", "type": "bool" }
        ],
        "internalType": "struct SavingCore.Plan",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextPlanId",
    "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [ { "internalType": "uint256", "name": "depositId", "type": "uint256" } ],
    "name": "getDeposit",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "planId", "type": "uint256" },
          { "internalType": "uint256", "name": "principal", "type": "uint256" },
          { "internalType": "uint256", "name": "startAt", "type": "uint256" },
          { "internalType": "uint256", "name": "maturityAt", "type": "uint256" },
          { "internalType": "uint256", "name": "tenorDaysAtOpen", "type": "uint256" },
          { "internalType": "uint256", "name": "aprBpsAtOpen", "type": "uint256" },
          { "internalType": "uint256", "name": "penaltyBpsAtOpen", "type": "uint256" },
          { "internalType": "DepositStatus", "name": "status", "type": "uint8" }
        ],
        "internalType": "struct SavingCore.Deposit",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [ { "internalType": "uint256", "name": "depositId", "type": "uint256" } ],
    "name": "withdrawAtMaturity",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [ { "internalType": "uint256", "name": "depositId", "type": "uint256" } ],
    "name": "earlyWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const USDC_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ],
    "stateMutability": "view",
    "type": "function"
  }
];
