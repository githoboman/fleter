// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Owned} from "./Owned.sol";

/**
 * @title BitdrumPriceAdapter
 * @notice Keeper-fed onchain BTC/USD price snapshots.
 *
 * The keeper posts a new round every 15-30 seconds. PredictionMarketV2 reads
 * the latest round when a market is opened (to record the strike price) and
 * SettlementEngineV2 reads a round at or after market expiry to settle.
 *
 * This gives the contracts a trustworthy, onchain price source that does not
 * depend on user-supplied data, enabling 1-minute and 5-minute market support.
 */
contract BitdrumPriceAdapter is Owned {
    struct Round {
        uint128 price;     // BTC/USD in 8-decimal integer (e.g. 7000000000000 = $70,000.00)
        uint128 timestamp; // Unix seconds of the price observation
    }

    uint256 public latestRoundId;
    mapping(uint256 => Round) public rounds;

    address public keeper;

    event PricePosted(uint256 indexed roundId, uint128 price, uint128 timestamp);
    event KeeperUpdated(address indexed keeper);

    error Unauthorized();
    error InvalidPrice();
    error InvalidTimestamp();
    error StaleRound();
    error NoRoundsYet();

    constructor(address owner_) Owned(owner_) {}

    modifier onlyKeeper() {
        if (msg.sender != keeper && msg.sender != owner()) revert Unauthorized();
        _;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setKeeper(address keeper_) external onlyOwner {
        require(keeper_ != address(0), "zero keeper");
        keeper = keeper_;
        emit KeeperUpdated(keeper_);
    }

    // ── Keeper feed ───────────────────────────────────────────────────────────

    /**
     * @notice Post a new BTC/USD price snapshot.
     * @param price     BTC/USD price in 8-decimal integer format.
     * @param timestamp Unix timestamp of the price observation. Must not be
     *                  in the future and must be >= the previous round's timestamp.
     */
    function postPrice(uint128 price, uint128 timestamp) external onlyKeeper returns (uint256 roundId) {
        if (price == 0) revert InvalidPrice();
        if (timestamp > block.timestamp) revert InvalidTimestamp();

        roundId = ++latestRoundId;
        rounds[roundId] = Round({price: price, timestamp: timestamp});

        emit PricePosted(roundId, price, timestamp);
    }

    // ── Reads ─────────────────────────────────────────────────────────────────

    /**
     * @notice Return the most recent round.
     */
    function getLatestRound() external view returns (uint256 roundId, uint128 price, uint128 timestamp) {
        roundId = latestRoundId;
        if (roundId == 0) revert NoRoundsYet();
        Round storage r = rounds[roundId];
        price = r.price;
        timestamp = r.timestamp;
    }

    /**
     * @notice Return a specific round's data.
     */
    function getRound(uint256 roundId_) external view returns (uint128 price, uint128 timestamp) {
        Round storage r = rounds[roundId_];
        price = r.price;
        timestamp = r.timestamp;
    }

    /**
     * @notice Revert if the latest round is older than `maxAge` seconds.
     *         Called by market and settlement contracts to enforce freshness.
     */
    function assertFreshLatest(uint256 maxAge) external view {
        if (latestRoundId == 0) revert NoRoundsYet();
        Round storage r = rounds[latestRoundId];
        if (block.timestamp - r.timestamp > maxAge) revert StaleRound();
    }
}
