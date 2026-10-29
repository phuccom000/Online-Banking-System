// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ISavingCore {
    // Marker interface
}

contract VaultManager is Ownable, Pausable {
    IERC20 public immutable usdc;
    address public feeReceiver;
    
    mapping(address => bool) public authorizedCallers;

    event VaultFunded(address indexed from, uint256 amount);
    event VaultWithdrawn(address indexed to, uint256 amount);
    event FeeReceiverSet(address indexed feeReceiver);
    event AuthorizedCallerSet(address indexed caller, bool authorized);
    event InterestPaid(address indexed to, uint256 amount);
    event PenaltyPaid(address indexed to, uint256 amount);

    constructor(address _usdc, address _feeReceiver) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        feeReceiver = _feeReceiver;
    }

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "VaultManager: not authorized");
        _;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerSet(caller, authorized);
    }

    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "VaultManager: zero address");
        feeReceiver = _feeReceiver;
        emit FeeReceiverSet(_feeReceiver);
    }

    function fundVault(uint256 amount) external onlyOwner whenNotPaused {
        require(amount > 0, "VaultManager: amount must be > 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "VaultManager: transfer failed");
        emit VaultFunded(msg.sender, amount);
    }

    function withdrawVault(uint256 amount) external onlyOwner whenNotPaused {
        require(amount > 0, "VaultManager: amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "VaultManager: insufficient balance");
        require(usdc.transfer(msg.sender, amount), "VaultManager: transfer failed");
        emit VaultWithdrawn(msg.sender, amount);
    }

    function payInterest(address to, uint256 amount) external onlyAuthorized whenNotPaused {
        require(amount > 0, "VaultManager: amount must be > 0");
        require(usdc.balanceOf(address(this)) >= amount, "VaultManager: insufficient funds for interest");
        require(usdc.transfer(to, amount), "VaultManager: transfer failed");
        emit InterestPaid(to, amount);
    }

    function payPenalty(uint256 amount) external onlyAuthorized whenNotPaused {
        require(amount > 0, "VaultManager: amount must be > 0");
        require(feeReceiver != address(0), "VaultManager: fee receiver not set");
        require(usdc.balanceOf(address(this)) >= amount, "VaultManager: insufficient funds");
        require(usdc.transfer(feeReceiver, amount), "VaultManager: transfer failed");
        emit PenaltyPaid(feeReceiver, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
