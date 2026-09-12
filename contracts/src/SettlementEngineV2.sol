// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {
    Direction,
    Market,
    MarketState,
    Outcome,
    StakeRecord
} from "./Types.sol";
import {ILeaderboardRegistry} from "./interfaces/ILeaderboardRegistry.sol";
import {IPredictionMarketV2} from "./interfaces/IPredictionMarketV2.sol";
import {IBitdrumPriceAdapter} from "./interfaces/IBitdrumPriceAdapter.sol";
import {Owned} from "./Owned.sol";

/**
 * @title SettlementEngineV2
 * @notice Settles locked markets using BitdrumPriceAdapter snapshots.
 *
 * V2 changes from V1:
 * - settle(marketId) takes no oracle data — it reads from the price adapter.
 * - Validates the adapter's latest round timestamp is >= market expiry (price
 *   must have been observed after the market expired, not before).
 * - Validates the adapter's latest round is fresh enough (within SETTLEMENT_PRICE_MAX_AGE).
 * - Anyone can call settle() once conditions are met — typically the keeper.
 */
contract SettlementEngineV2 is Owned {
    // Maximum number of seconds the settlement price can lag behind block.timestamp.
    // Set to 90s to allow for up to 3 missed 30s adapter posts before a settlement
    // becomes impossible for that adapter round (keeper should post another).
    uint256 public constant SETTLEMENT_PRICE_MAX_AGE = 90;

    IPredictionMarketV2 public immutable predictionMarket;
    ILeaderboardRegistry public immutable leaderboardRegistry;
    IBitdrumPriceAdapter public immutable priceAdapter;

    event MarketSettled(uint256 indexed marketId, Outcome outcome, uint128 settlementPrice);

    error MarketNotLocked();
    error MarketNotExpired();
    error SettlementPriceTooEarly();
    error SettlementPriceStale();
    error NoAdapterData();

    constructor(
        address predictionMarket_,
        address leaderboardRegistry_,
        address priceAdapter_,
        address owner_
    ) Owned(owner_) {
        require(
            predictionMarket_ != address(0)
                && leaderboardRegistry_ != address(0)
                && priceAdapter_ != address(0),
            "zero address"
        );
        predictionMarket  = IPredictionMarketV2(predictionMarket_);
        leaderboardRegistry = ILeaderboardRegistry(leaderboardRegistry_);
        priceAdapter       = IBitdrumPriceAdapter(priceAdapter_);
    }

    /**
     * @notice Settle a locked, expired market using the latest adapter snapshot.
     * @dev Keeper calls this after market expiry once a fresh adapter round is available.
     *
     * The adapter round must satisfy:
     *   - round.timestamp >= market.expiryAt  (price observed after market expired)
     *   - block.timestamp − round.timestamp <= SETTLEMENT_PRICE_MAX_AGE (price still fresh)
     */
    function settle(uint256 marketId) external {
        Market memory market = predictionMarket.getMarket(marketId);

        if (market.state != MarketState.LOCKED) revert MarketNotLocked();
        if (block.timestamp < market.expiryAt)  revert MarketNotExpired();

        (, uint128 price, uint128 timestamp) = priceAdapter.getLatestRound();

        if (price == 0) revert NoAdapterData();

        // Settlement price must have been observed AFTER the market expired.
        if (timestamp < market.expiryAt) revert SettlementPriceTooEarly();

        // Settlement price must still be fresh (not too stale).
        if (block.timestamp - uint256(timestamp) > SETTLEMENT_PRICE_MAX_AGE) revert SettlementPriceStale();

        Outcome outcome = _determineOutcome(market.strikePrice, price);

        predictionMarket.finalizeSettlement(marketId, outcome, price, timestamp);
        _recordLeaderboardResults(marketId, market.pomProfitBps, outcome);

        emit MarketSettled(marketId, outcome, price);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _recordLeaderboardResults(uint256 marketId, uint256 payoutBps, Outcome outcome) internal {
        address[] memory participants = predictionMarket.getMarketParticipants(marketId);

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            StakeRecord memory stake = predictionMarket.getStakeRecord(marketId, participant);

            if (outcome == Outcome.DRAW) {
                leaderboardRegistry.recordDraw(participant, stake.amount);
                continue;
            }

            bool won = _isWinningStake(stake.direction, outcome);
            uint256 profitAmount = won ? (stake.amount * payoutBps) / 10_000 : 0;
            leaderboardRegistry.recordOutcome(participant, won, stake.amount, profitAmount);
        }
    }

    function _determineOutcome(uint128 strikePrice, uint128 finalPrice) internal pure returns (Outcome) {
        if (finalPrice > strikePrice) return Outcome.UP;
        if (finalPrice < strikePrice) return Outcome.DOWN;
        return Outcome.DRAW;
    }

    function _isWinningStake(Direction direction, Outcome outcome) internal pure returns (bool) {
        return (direction == Direction.UP && outcome == Outcome.UP)
            || (direction == Direction.DOWN && outcome == Outcome.DOWN);
    }
}
