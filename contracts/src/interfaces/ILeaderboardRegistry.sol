// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ILeaderboardRegistry {
    function recordOutcome(address trader, bool won, uint256 stakeAmount, uint256 profitAmount) external;
    function recordDraw(address trader, uint256 stakeAmount) external;
}
