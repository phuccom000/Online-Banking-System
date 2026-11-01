// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IVaultManager.sol";
import "./libraries/InterestMath.sol";

contract SavingCore is ERC721, Ownable, Pausable {
    IERC20 public immutable usdc;
    IVaultManager public vaultManager;

    uint256 public nextPlanId;
    uint256 public nextDepositId;

    // Personal variant values
    uint256 public constant GRACE_PERIOD_DAYS = 4; // (A mod 3) + 2 where A=2
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 * 86400;

    enum DepositStatus {
        Active,
        Withdrawn,
        ManualRenewed,
        AutoRenewed
    }

    struct Plan {
        uint256 tenorDays;
        uint256 aprBps;
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 earlyWithdrawPenaltyBps;
        bool enabled;
    }

    struct Deposit {
        uint256 planId;
        uint256 principal;
        uint256 startAt;
        uint256 maturityAt;
        uint256 tenorDaysAtOpen;
        uint256 aprBpsAtOpen;
        uint256 penaltyBpsAtOpen;
        DepositStatus status;
        uint256 renewedFrom; // deposit id this one was renewed from (0 = opened fresh)
        uint256 renewedTo; // deposit id this one was renewed into (0 = not renewed)
        address closedBy; // certificate holder when the NFT was burned (ownerOf reverts after burn)
    }

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Deposit) public deposits;

    event PlanCreated(uint256 indexed planId, uint256 tenorDays, uint256 aprBps);
    event PlanUpdated(uint256 indexed planId, uint256 newAprBps);
    event DepositOpened(uint256 indexed depositId, address indexed owner, uint256 indexed planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen);
    event Withdrawn(uint256 indexed depositId, address indexed owner, uint256 principal, uint256 interest, bool isEarly);
    event Renewed(uint256 indexed oldDepositId, uint256 indexed newDepositId, uint256 newPrincipal, uint256 newPlanId);

    constructor(address _usdc, address _vaultManager) ERC721("Saving Deposit Certificate", "SDC") Ownable(msg.sender) {
        // One admin account runs the whole bank: the deployer must already own the VaultManager
        require(Ownable(_vaultManager).owner() == msg.sender, "SavingCore: admin must own VaultManager");
        usdc = IERC20(_usdc);
        vaultManager = IVaultManager(_vaultManager);
        nextPlanId = 1;
        nextDepositId = 1;
    }

    function createPlan(
        uint256 tenorDays,
        uint256 aprBps,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 earlyWithdrawPenaltyBps
    ) external onlyOwner {
        require(aprBps > 0, "SavingCore: APR must be > 0");
        uint256 planId = nextPlanId++;
        plans[planId] = Plan({
            tenorDays: tenorDays,
            aprBps: aprBps,
            minDeposit: minDeposit,
            maxDeposit: maxDeposit,
            earlyWithdrawPenaltyBps: earlyWithdrawPenaltyBps,
            enabled: true
        });
        emit PlanCreated(planId, tenorDays, aprBps);
    }

    function updatePlan(uint256 planId, uint256 newAprBps) external onlyOwner {
        require(plans[planId].tenorDays > 0, "SavingCore: plan does not exist");
        require(newAprBps > 0, "SavingCore: APR must be > 0");
        plans[planId].aprBps = newAprBps;
        emit PlanUpdated(planId, newAprBps);
    }

    function enablePlan(uint256 planId) external onlyOwner {
        require(plans[planId].tenorDays > 0, "SavingCore: plan does not exist");
        plans[planId].enabled = true;
    }

    function disablePlan(uint256 planId) external onlyOwner {
        require(plans[planId].tenorDays > 0, "SavingCore: plan does not exist");
        plans[planId].enabled = false;
    }

    function openDeposit(uint256 planId, uint256 amount) external whenNotPaused {
        Plan storage plan = plans[planId];
        require(plan.tenorDays > 0, "SavingCore: plan does not exist");
        require(plan.enabled, "SavingCore: plan is disabled");
        if (plan.minDeposit > 0) {
            require(amount >= plan.minDeposit, "SavingCore: amount below minimum");
        }
        if (plan.maxDeposit > 0) {
            require(amount <= plan.maxDeposit, "SavingCore: amount above maximum");
        }
        require(amount > 0, "SavingCore: amount must be > 0");

        // Transfer principal from user to this contract
        require(usdc.transferFrom(msg.sender, address(this), amount), "SavingCore: transfer failed");

        uint256 depositId = nextDepositId++;
        uint256 maturityAt = block.timestamp + (plan.tenorDays * SECONDS_PER_DAY);

        deposits[depositId] = Deposit({
            planId: planId,
            principal: amount,
            startAt: block.timestamp,
            maturityAt: maturityAt,
            tenorDaysAtOpen: plan.tenorDays,
            aprBpsAtOpen: plan.aprBps,
            penaltyBpsAtOpen: plan.earlyWithdrawPenaltyBps,
            status: DepositStatus.Active,
            renewedFrom: 0,
            renewedTo: 0,
            closedBy: address(0)
        });

        _safeMint(msg.sender, depositId);
        emit DepositOpened(depositId, msg.sender, planId, amount, maturityAt, plan.aprBps);
    }

    function calculateInterest(uint256 principal, uint256 aprBps, uint256 tenorSeconds) public pure returns (uint256) {
        return InterestMath.interest(principal, aprBps, tenorSeconds);
    }

    function withdrawAtMaturity(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "SavingCore: not deposit owner");
        Deposit storage deposit = deposits[depositId];
        require(deposit.status == DepositStatus.Active, "SavingCore: deposit not active");
        require(block.timestamp >= deposit.maturityAt, "SavingCore: not matured yet");

        uint256 principal = deposit.principal;
        uint256 tenorSeconds = deposit.tenorDaysAtOpen * SECONDS_PER_DAY;
        uint256 interest = calculateInterest(principal, deposit.aprBpsAtOpen, tenorSeconds);

        // Close the deposit and burn its certificate before moving any tokens
        _close(depositId, DepositStatus.Withdrawn);

        // Return principal from this contract
        require(usdc.transfer(msg.sender, principal), "SavingCore: principal transfer failed");
        // Pay interest from vault
        if (interest > 0) {
            vaultManager.payInterest(msg.sender, interest);
        }

        emit Withdrawn(depositId, msg.sender, principal, interest, false);
    }

    function earlyWithdraw(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "SavingCore: not deposit owner");
        Deposit storage deposit = deposits[depositId];
        require(deposit.status == DepositStatus.Active, "SavingCore: deposit not active");
        require(block.timestamp < deposit.maturityAt, "SavingCore: already matured, use withdrawAtMaturity");

        uint256 principal = deposit.principal;
        uint256 penalty = InterestMath.penalty(principal, deposit.penaltyBpsAtOpen);
        uint256 userReceives = principal - penalty;

        // Close the deposit and burn its certificate before moving any tokens
        _close(depositId, DepositStatus.Withdrawn);

        // Penalty is cut from the user's principal (held here), not paid from the vault
        if (penalty > 0) {
            require(usdc.transfer(vaultManager.feeReceiver(), penalty), "SavingCore: penalty transfer failed");
        }
        // Return remaining principal to user
        require(usdc.transfer(msg.sender, userReceives), "SavingCore: principal transfer failed");

        emit Withdrawn(depositId, msg.sender, principal, 0, true);
    }

    function renewDeposit(uint256 depositId, uint256 newPlanId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender, "SavingCore: not deposit owner");
        Deposit storage deposit = deposits[depositId];
        require(deposit.status == DepositStatus.Active, "SavingCore: deposit not active");
        require(block.timestamp >= deposit.maturityAt, "SavingCore: not matured yet");

        Plan storage newPlan = plans[newPlanId];
        require(newPlan.tenorDays > 0, "SavingCore: new plan does not exist");
        require(newPlan.enabled, "SavingCore: new plan is disabled");

        // Calculate interest on old deposit
        uint256 principal = deposit.principal;
        uint256 tenorSeconds = deposit.tenorDaysAtOpen * SECONDS_PER_DAY;
        uint256 interest = calculateInterest(principal, deposit.aprBpsAtOpen, tenorSeconds);
        uint256 newPrincipal = principal + interest;

        // Close the old deposit and burn its certificate; the new one gets a fresh NFT
        _close(depositId, DepositStatus.ManualRenewed);

        // Pull the compounded interest from the vault so this contract's balance still backs every principal
        if (interest > 0) {
            vaultManager.payInterest(address(this), interest);
        }

        // Create new deposit with new plan's parameters
        uint256 newDepositId = nextDepositId++;
        uint256 newMaturityAt = block.timestamp + (newPlan.tenorDays * SECONDS_PER_DAY);

        deposits[newDepositId] = Deposit({
            planId: newPlanId,
            principal: newPrincipal,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            tenorDaysAtOpen: newPlan.tenorDays,
            aprBpsAtOpen: newPlan.aprBps,
            penaltyBpsAtOpen: newPlan.earlyWithdrawPenaltyBps,
            status: DepositStatus.Active,
            renewedFrom: depositId,
            renewedTo: 0,
            closedBy: address(0)
        });
        deposit.renewedTo = newDepositId;

        _safeMint(msg.sender, newDepositId);
        emit Renewed(depositId, newDepositId, newPrincipal, newPlanId);
    }

    function autoRenewDeposit(uint256 depositId) external whenNotPaused {
        require(ownerOf(depositId) == msg.sender || msg.sender == owner(), "SavingCore: not authorized");
        Deposit storage deposit = deposits[depositId];
        require(deposit.status == DepositStatus.Active, "SavingCore: deposit not active");
        // Must be after grace period
        require(block.timestamp >= deposit.maturityAt + (GRACE_PERIOD_DAYS * SECONDS_PER_DAY), "SavingCore: grace period not ended");

        // Calculate interest on old deposit
        uint256 principal = deposit.principal;
        uint256 tenorSeconds = deposit.tenorDaysAtOpen * SECONDS_PER_DAY;
        uint256 interest = calculateInterest(principal, deposit.aprBpsAtOpen, tenorSeconds);
        uint256 newPrincipal = principal + interest;

        // The caller may be the admin (bot), so remember the certificate holder before burning
        address holder = ownerOf(depositId);
        _close(depositId, DepositStatus.AutoRenewed);

        // Pull the compounded interest from the vault so this contract's balance still backs every principal
        if (interest > 0) {
            vaultManager.payInterest(address(this), interest);
        }

        // Create new deposit with SAME tenor as original, ORIGINAL APR locked
        uint256 newDepositId = nextDepositId++;
        uint256 newMaturityAt = block.timestamp + (deposit.tenorDaysAtOpen * SECONDS_PER_DAY);

        deposits[newDepositId] = Deposit({
            planId: deposit.planId,
            principal: newPrincipal,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            tenorDaysAtOpen: deposit.tenorDaysAtOpen,
            aprBpsAtOpen: deposit.aprBpsAtOpen, // Original APR locked
            penaltyBpsAtOpen: deposit.penaltyBpsAtOpen,
            status: DepositStatus.Active,
            renewedFrom: depositId,
            renewedTo: 0,
            closedBy: address(0)
        });
        deposit.renewedTo = newDepositId;

        _safeMint(holder, newDepositId);
        emit Renewed(depositId, newDepositId, newPrincipal, deposit.planId);
    }

    /// @dev Marks a deposit closed and burns its certificate, so a used NFT can never be withdrawn,
    ///      renewed or traded again. The holder is kept in `closedBy` for history.
    function _close(uint256 depositId, DepositStatus status) private {
        Deposit storage deposit = deposits[depositId];
        deposit.status = status;
        deposit.closedBy = ownerOf(depositId);
        _burn(depositId);
    }

    /// @dev Single-admin design: ownership is set once in the constructor (the deployer, who also owns VaultManager)
    ///      and can never be transferred or renounced, so the bank always has exactly one admin.
    function _transferOwnership(address newOwner) internal override {
        require(owner() == address(0), "SavingCore: single admin, ownership is fixed");
        super._transferOwnership(newOwner);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getDeposit(uint256 depositId) external view returns (Deposit memory) {
        return deposits[depositId];
    }

    function getPlan(uint256 planId) external view returns (Plan memory) {
        return plans[planId];
    }
}
