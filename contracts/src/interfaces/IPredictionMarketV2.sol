// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Market, Outcome, StakeRecord} from "../Types.sol";

interface IPredictionMarketV2 {
    function getMarket(uint256 marketId) external view returns (Market memory);
    function getMarketParticipants(uint256 marketId) external view returns (address[] memory);
    function getStakeRecord(uint256 marketId, address participant) external view returns (StakeRecord memory);
    function finalizeSettlement(
        uint256 marketId,
        Outcome outcome,
        uint128 settlementPrice,
        uint128 settlementTimestamp
    ) external;
}
