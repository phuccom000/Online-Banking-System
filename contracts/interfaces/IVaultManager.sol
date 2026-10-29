// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title IVaultManager
/// @notice What SavingCore needs from the bank's interest pool.
interface IVaultManager {
    /// @notice Address that receives early-withdrawal penalties.
    function feeReceiver() external view returns (address);

    /// @notice Pays `amount` of interest from the vault to `to`.
    /// @dev Must revert when the vault cannot cover `amount` (business rule 5).
    function payInterest(address to, uint256 amount) external;
}
