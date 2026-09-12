// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

enum Direction {
    UP,
    DOWN
}

enum MarketState {
    NONE,
    OPEN,
    LOCKED,
    CLAIMABLE,
    CLOSED
}

enum Outcome {
    PENDING,
    UP,
    DOWN,
    DRAW
}

enum Tier {
    NONE,
    PRO,
    ELITE
}

struct OracleData {
    uint128 price;
    uint128 timestamp;
}

struct Market {
    uint256 marketId;
    address opener;
    Direction openerDirection;
    uint256 duration;
    uint256 openedAt;
    uint256 joiningWindowEnd;
    uint256 expiryAt;
    uint128 strikePrice;
    uint128 settlementPrice;
    uint128 strikeTimestamp;
    uint128 settlementTimestamp;
    uint256 pomProfitBps;
    uint256 upPool;
    uint256 downPool;
    uint256 totalUserStaked;
    uint256 vaultCommitted;
    uint256 feeAmount;
    uint256 sweptToVault;
    uint256 participantCount;
    uint256 claimedCount;
    MarketState state;
    Outcome outcome;
}

struct StakeRecord {
    Direction direction;
    uint256 amount;
    bool claimed;
    bool exists;
}

struct TraderRecord {
    uint256 totalMarkets;
    uint256 wins;
    uint256 losses;
    uint256 draws;
    int256 netPnl;
}

struct Subscription {
    Tier tier;
    uint256 expiresAt;
}
