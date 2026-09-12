// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {TraderRecord} from "./Types.sol";
import {ILeaderboardRegistry} from "./interfaces/ILeaderboardRegistry.sol";
import {Owned} from "./Owned.sol";

contract LeaderboardRegistry is Owned, ILeaderboardRegistry {
    mapping(address => TraderRecord) public records;
    address public settlementEngine;

    event SettlementEngineUpdated(address indexed settlementEngine);
    event OutcomeRecorded(address indexed trader, bool won, uint256 stakeAmount, uint256 profitAmount);
    event DrawRecorded(address indexed trader, uint256 stakeAmount);

    error Unauthorized();

    constructor(address owner_) Owned(owner_) {}

    modifier onlySettlementEngine() {
        if (msg.sender != settlementEngine) {
            revert Unauthorized();
        }
        _;
    }

    function setSettlementEngine(address settlementEngine_) external onlyOwner {
        require(settlementEngine_ != address(0), "zero settlement engine");
        settlementEngine = settlementEngine_;
        emit SettlementEngineUpdated(settlementEngine_);
    }

    function recordOutcome(address trader, bool won, uint256 stakeAmount, uint256 profitAmount)
        external
        onlySettlementEngine
    {
        TraderRecord storage record = records[trader];
        record.totalMarkets += 1;

        if (won) {
            record.wins += 1;
            record.netPnl += int256(profitAmount);
        } else {
            record.losses += 1;
            record.netPnl -= int256(stakeAmount);
        }

        emit OutcomeRecorded(trader, won, stakeAmount, profitAmount);
    }

    function recordDraw(address trader, uint256 stakeAmount) external onlySettlementEngine {
        TraderRecord storage record = records[trader];
        record.totalMarkets += 1;
        record.draws += 1;

        emit DrawRecorded(trader, stakeAmount);
    }
}
