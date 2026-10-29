# Design Notes - Online Banking System

**Student ID:** 21125132

## Personal Variant
| Parameter | Value |
| :-- | :-- |
| Grace Period (Auto-Renew) | 4 Days |
| Default Plan APR | 250 bps (2.50%) |
| Early Withdraw Penalty | 450 bps (4.50%) |
| Default Plan Tenor | 180 Days |

## Architecture Overview

### Contract Separation (as per assignment)
- **MockUSDC (ERC20, 6 decimals)**: Test token - anyone can mint. This helps catch decimal bugs early.
- **VaultManager**: Holds bank's interest pool. Admin-only functions. Only authorized callers (SavingCore) can pay interest/penalties. Separate from user principal.
- **SavingCore**: Business logic - plans, deposits, withdraws, renews. Holds user principal (transferred in). Mints ERC721 deposit certificates.

**Key principle:** Principal stays in SavingCore, interest comes from VaultManager. Interest is never paid from other users' principal.

### Access Control
- **MockUSDC**: Public mint for testing
- **VaultManager**: Ownable (or admin role). Functions like fundVault/withdrawVault/setFeeReceiver/pause/unpause restricted to admin. Functions to pay interest/penalties restricted to authorized callers (SavingCore).
- **SavingCore**: Ownable for plan management (create/update/enable/disable). Pausable for emergency stops.

### Authorization Pattern
Need to allow SavingCore to call VaultManager to pay interest/penalties. Options:
1. Give SavingCore a specific role/authorization in VaultManager (e.g., `setAuthorizedCaller(address, bool)`)
2. Make VaultManager owned by admin who can also grant permission
3. Have VaultManager check `msg.sender == savingCore` after setting it

Will go with authorization mapping in VaultManager - `authorizedCallers[msg.sender]` or explicitly set `savingCore` address.

### Storage Layout

**VaultManager:**
```solidity
IERC20 public usdc;
address public feeReceiver;
mapping(address => bool) public authorizedCallers; // SavingCore
bool public paused;
```

**SavingCore:**
```solidity
IERC20 public usdc;
IVaultManager public vaultManager;
uint256 public nextPlanId;
uint256 public nextDepositId;

// Plan
struct Plan {
  uint256 tenorDays;
  uint256 aprBps;
  uint256 minDeposit;
  uint256 maxDeposit;
  uint256 earlyWithdrawPenaltyBps;
  bool enabled;
}
mapping(uint256 => Plan) public plans;

// Deposit
enum DepositStatus { Active, Withdrawn, ManualRenewed, AutoRenewed }
struct Deposit {
  uint256 planId;
  address owner; // or rely on NFT ownership
  uint256 principal;
  uint256 startAt;
  uint256 maturityAt;
  uint256 aprBpsAtOpen;
  uint256 penaltyBpsAtOpen;
  DepositStatus status;
}
mapping(uint256 => Deposit) public deposits;
// Also need to track which deposits belong to users if needed
```

**Events (required):**
- PlanCreated(planId, tenorDays, aprBps)
- PlanUpdated(planId, newAprBps)
- DepositOpened(depositId, owner, planId, principal, maturityAt, aprBpsAtOpen)
- Withdrawn(depositId, owner, principal, interest, isEarly)
- Renewed(oldDepositId, newDepositId, newPrincipal, newPlanId)

### Interest Calculation (Simple Interest)
```solidity
// interest = (principal * aprBpsAtOpen * tenorSeconds) / (365 * 24 * 3600 * 10000)
// Multiply before divide for precision
uint256 tenorSeconds = deposit.tenorDaysAtOpen * 86400; // or store tenor
uint256 interest = (deposit.principal * deposit.aprBpsAtOpen * tenorSeconds) / (365 days * 10000);
```
Need to be careful with units - all amounts in smallest units (1 USDC = 1e6 for 6 decimals).

### Early Withdrawal
```solidity
uint256 penalty = (deposit.principal * deposit.penaltyBpsAtOpen) / 10000;
uint256 userReceives = deposit.principal - penalty;
// penalty goes to feeReceiver via VaultManager
```

### Auto-Renew
- Grace period = 4 days (our variant)
- Only allowed if `block.timestamp >= maturityAt + gracePeriod` (or check)
- Same tenor as original deposit
- **APR locked to original aprBpsAtOpen** (critical)
- New principal = old principal + interest
- Old deposit status becomes AutoRenewed
- Mint new NFT with newDepositId

### Key Decisions to Make
1. **NFT transferability** (Q1): If NFT is transferred, who can withdraw? ERC721 ownerOf() is the source of truth - so new owner can withdraw. Need to track ownership correctly. This is transferable by default with ERC721.
2. **Time comparisons**: Need to be precise about >= vs >. For maturity - can withdraw at exactly maturityAt? "withdrawAtMaturity" suggests at maturity or after - use >= maturityAt. For grace period end - if user hasn't acted by end of grace period, bot can auto-renew. So autoRenew allowed when now >= maturityAt + gracePeriod. Manual renew allowed on/after maturityAt.
3. **Double withdraw prevention**: Mark deposit status as Withdrawn/renewed and check status != Active.
4. **Rounding dust**: Integer division truncates - dust goes to vault (stays there). This is fine as long as it doesn't cause issues.
5. **Disabled plan with active deposits**: Existing deposits remain valid and can be withdrawn/renewed regardless of plan being disabled. Can only prevent NEW deposits. Manual renew into a disabled plan - need to check plan enabled? The plan is being used for the new deposit; better to allow renewing into any plan? Or same plan? Let us look up requirements again - "renewDeposit(depositId, newPlanId)" takes a new plan. The new plan's rules apply? But APR is locked in our case for auto-renew; for manual renew also says "A new deposit NFT is minted using the new plan's rate" - wait look up section 3.4 again.
> "4. A new deposit NFT is minted using the new plan's rate.  
> 5. Old deposit status is set to ManualRenewed."  
Also says "new principal = old principal + interest" - compounded. But does it use new plan's APR/tenor? Let us look up more: "Example: Alice renews to a 180-day plan at 2.5% APR" - so new plan determines tenor and APR for the renewed deposit. But for auto-renew: "Same tenor as the original deposit. APR is locked to the original aprBpsAtOpen" - different rules for auto vs manual.

So manual renew uses the NEW plan's parameters (tenor, APR from new plan) - but when opening the new deposit, we snapshot from new plan. Auto-renew uses original tenor and original APR (locked).

Also need to track - when renewing, do we take principal+interest as principal for the new deposit.

## Test Plan (from section 7.2)
- createPlan: valid plan, disabled plan, invalid APR
- openDeposit: happy path, below min, above max, disabled plan  
- withdrawAtMaturity: correct interest, too early, already withdrawn
- earlyWithdraw: correct penalty, no interest paid
- renewDeposit (manual): correct new principal, status update
- autoRenewDeposit: before grace period (should fail), after grace period, APR locked
- Vault: fund, withdraw, insufficient vault for interest payout
- Pause: withdraw blocked when paused
