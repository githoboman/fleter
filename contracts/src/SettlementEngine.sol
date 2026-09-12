// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {
    Direction,
    Market,
    MarketState,
    OracleData,
    Outcome,
    StakeRecord
} from "./Types.sol";
import {ILeaderboardRegistry} from "./interfaces/ILeaderboardRegistry.sol";
import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";
import {Owned} from "./Owned.sol";

contract SettlementEngine is Owned {
    // DIA oracle updates every 120s on Somnia; 150s gives a comfortable buffer.
    uint256 public constant ORACLE_MAX_AGE = 150;

    IPredictionMarket public immutable predictionMarket;
    ILeaderboardRegistry public immutable leaderboardRegistry;

    event MarketSettled(uint256 indexed marketId, Outcome outcome, uint128 settlementPrice);

    error MarketNotLocked();
    error MarketNotExpired();
    error OraclePriceStale();
    error InvalidOraclePrice();

    constructor(address predictionMarket_, address leaderboardRegistry_, address owner_) Owned(owner_) {
        require(predictionMarket_ != address(0) && leaderboardRegistry_ != address(0), "zero address");
        predictionMarket = IPredictionMarket(predictionMarket_);
        leaderboardRegistry = ILeaderboardRegistry(leaderboardRegistry_);
    }

    function settle(uint256 marketId, OracleData calldata priceData) external {
        _assertFreshOracle(priceData);

        Market memory market = predictionMarket.getMarket(marketId);

        if (market.state != MarketState.LOCKED) {
            revert MarketNotLocked();
        }
        if (block.timestamp < market.expiryAt) {
            revert MarketNotExpired();
        }

        Outcome outcome = _determineOutcome(market.strikePrice, priceData.price);

        predictionMarket.finalizeSettlement(marketId, outcome, priceData);
        _recordLeaderboardResults(marketId, market.pomProfitBps, outcome);

        emit MarketSettled(marketId, outcome, priceData.price);
    }

    function _recordLeaderboardResults(uint256 marketId, uint256 pomProfitBps, Outcome outcome) internal {
        address[] memory participants = predictionMarket.getMarketParticipants(marketId);

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            StakeRecord memory stake = predictionMarket.getStakeRecord(marketId, participant);

            if (outcome == Outcome.DRAW) {
                leaderboardRegistry.recordDraw(participant, stake.amount);
                continue;
            }

            bool won = _isWinningStake(stake.direction, outcome);
            uint256 profitAmount = won ? (stake.amount * pomProfitBps) / 10_000 : 0;
            leaderboardRegistry.recordOutcome(participant, won, stake.amount, profitAmount);
        }
    }

    function _determineOutcome(uint128 strikePrice, uint128 finalPrice) internal pure returns (Outcome) {
        if (finalPrice > strikePrice) {
            return Outcome.UP;
        }
        if (finalPrice < strikePrice) {
            return Outcome.DOWN;
        }
        return Outcome.DRAW;
    }

    function _assertFreshOracle(OracleData calldata oracleData) internal view {
        if (oracleData.price == 0) {
            revert InvalidOraclePrice();
        }
        if (oracleData.timestamp > block.timestamp) {
            revert OraclePriceStale();
        }
        if (block.timestamp - oracleData.timestamp > ORACLE_MAX_AGE) {
            revert OraclePriceStale();
        }
    }

    function _isWinningStake(Direction direction, Outcome outcome) internal pure returns (bool) {
        return (direction == Direction.UP && outcome == Outcome.UP)
            || (direction == Direction.DOWN && outcome == Outcome.DOWN);
    }
}
