// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";
import { InterestMath } from "./InterestMath.sol";

contract InterestMathTest is Test {
    uint256 constant USDC = 1e6;

    // Assignment example (3.2): 1,000 USDC, 90 days, 250 bps -> 6,164,383 units
    function test_InterestMatchesSpecExample() public pure {
        assertEq(InterestMath.interest(1000 * USDC, 250, 90 days), 6164383);
    }

    // Personal variant: 1,000 USDC, 180 days, 250 bps -> 12,328,767 units (dust truncated)
    function test_InterestPersonalVariant() public pure {
        assertEq(InterestMath.interest(1000 * USDC, 250, 180 days), 12328767);
    }

    // Personal variant: 450 bps penalty on 1,000 USDC -> 45 USDC
    function test_PenaltyPersonalVariant() public pure {
        assertEq(InterestMath.penalty(1000 * USDC, 450), 45 * USDC);
    }

    function test_SmallPrincipalRoundsDownToZero() public pure {
        assertEq(InterestMath.interest(1, 250, 1 days), 0);
    }

    function testFuzz_RoundingNeverOverpays(uint64 principal, uint16 aprBps, uint16 tenorDays) public pure {
        uint256 tenorSeconds = uint256(tenorDays) * 1 days;
        uint256 paid = InterestMath.interest(principal, aprBps, tenorSeconds);
        // paid * denominator never exceeds the exact numerator, so the vault keeps the dust
        assertLe(paid * 365 days * 10000, uint256(principal) * aprBps * tenorSeconds);
    }
}
