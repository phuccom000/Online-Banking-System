// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title InterestMath
/// @notice Simple-interest and penalty formulas from the assignment spec.
/// @dev Always multiplies before dividing so small principals do not truncate to zero.
///      Rounding dust is truncated in favour of the vault.
library InterestMath {
    uint256 internal constant SECONDS_PER_DAY = 86400;
    uint256 internal constant SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
    uint256 internal constant BASIS_POINTS = 10000;

    /// @notice interest = principal * aprBps * tenorSeconds / (SECONDS_PER_YEAR * BASIS_POINTS)
    function interest(uint256 principal, uint256 aprBps, uint256 tenorSeconds) internal pure returns (uint256) {
        return (principal * aprBps * tenorSeconds) / (SECONDS_PER_YEAR * BASIS_POINTS);
    }

    /// @notice penalty = principal * penaltyBps / BASIS_POINTS
    function penalty(uint256 principal, uint256 penaltyBps) internal pure returns (uint256) {
        return (principal * penaltyBps) / BASIS_POINTS;
    }
}
