// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IBitdrumPriceAdapter {
    function latestRoundId() external view returns (uint256);
    function getLatestRound() external view returns (uint256 roundId, uint128 price, uint128 timestamp);
    function getRound(uint256 roundId) external view returns (uint128 price, uint128 timestamp);
    function assertFreshLatest(uint256 maxAge) external view;
}
