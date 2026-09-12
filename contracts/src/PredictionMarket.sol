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
import {ILiquidityVault} from "./interfaces/ILiquidityVault.sol";
import {Owned} from "./Owned.sol";

contract PredictionMarket is Owned {
    uint256 public constant MIN_POM_BPS = 500;
    uint256 public constant MAX_POM_BPS = 7000;
    uint256 public constant PROTOCOL_FEE_BPS = 200;
    // DIA oracle updates every 120s on Somnia; 150s gives a comfortable buffer.
    uint256 public constant ORACLE_MAX_AGE = 150;

    address public immutable vault;
    address public immutable treasury;

    uint256 public nextMarketId;
    address public settlementEngine;

    mapping(uint256 => Market) private _markets;
    mapping(uint256 => mapping(address => StakeRecord)) private _stakes;
    mapping(uint256 => mapping(address => bool)) private _hasJoined;
    mapping(uint256 => address[]) private _participants;

    event SettlementEngineUpdated(address indexed settlementEngine);
    event MarketOpened(
        uint256 indexed marketId,
        address indexed opener,
        Direction direction,
        uint256 stakeAmount,
        uint256 duration,
        uint128 strikePrice
    );
    event MarketJoined(uint256 indexed marketId, address indexed participant, Direction direction, uint256 stakeAmount);
    event MarketPomUpdated(uint256 indexed marketId, uint256 pomProfitBps);
    event MarketLocked(uint256 indexed marketId);
    event MarketSettled(
        uint256 indexed marketId,
        Outcome outcome,
        uint128 settlementPrice,
        uint256 feeAmount,
        uint256 sweptToVault
    );
    event MarketClaimed(
        uint256 indexed marketId,
        address indexed participant,
        Outcome outcome,
        uint256 payout,
        uint256 profit
    );

    error InvalidDuration();
    error InvalidStake();
    error InvalidPom();
    error MarketNotOpen();
    error MarketNotLocked();
    error MarketNotClaimable();
    error JoiningWindowActive();
    error JoiningWindowClosed();
    error MarketNotExpired();
    error StakeMissing();
    error AlreadyClaimed();
    error AlreadyJoined();
    error OraclePriceStale();
    error InvalidOraclePrice();
    error Unauthorized();
    error TransferFailed();

    constructor(address vault_, address treasury_, address owner_) Owned(owner_) {
        require(vault_ != address(0) && treasury_ != address(0), "zero address");
        vault = vault_;
        treasury = treasury_;
    }

    receive() external payable {}

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

    function openMarket(
        Direction direction,
        uint256 duration,
        OracleData calldata strikeData
    ) external payable returns (uint256 marketId) {
        if (!_isSupportedDuration(duration)) {
            revert InvalidDuration();
        }
        if (msg.value == 0) {
            revert InvalidStake();
        }

        _assertFreshOracle(strikeData);

        marketId = ++nextMarketId;
        uint256 joiningWindowEnd = block.timestamp + _joiningWindowFor(duration);

        Market storage market = _markets[marketId];
        market.marketId = marketId;
        market.opener = msg.sender;
        market.openerDirection = direction;
        market.duration = duration;
        market.openedAt = block.timestamp;
        market.joiningWindowEnd = joiningWindowEnd;
        market.expiryAt = block.timestamp + duration;
        market.strikePrice = strikeData.price;
        market.strikeTimestamp = strikeData.timestamp;
        market.pomProfitBps = MIN_POM_BPS;
        market.state = MarketState.OPEN;
        market.outcome = Outcome.PENDING;

        _recordStake(marketId, msg.sender, direction, msg.value);

        emit MarketOpened(marketId, msg.sender, direction, msg.value, duration, strikeData.price);
    }

    function joinMarket(uint256 marketId, Direction direction) external payable {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.OPEN) {
            revert MarketNotOpen();
        }
        if (block.timestamp > market.joiningWindowEnd) {
            revert JoiningWindowClosed();
        }
        if (msg.value == 0) {
            revert InvalidStake();
        }

        _recordStake(marketId, msg.sender, direction, msg.value);

        emit MarketJoined(marketId, msg.sender, direction, msg.value);
    }

    function setPomProfitBps(uint256 marketId, uint256 pomProfitBps) external {
        if (msg.sender != owner() && msg.sender != settlementEngine) {
            revert Unauthorized();
        }
        if (pomProfitBps < MIN_POM_BPS || pomProfitBps > MAX_POM_BPS) {
            revert InvalidPom();
        }

        Market storage market = _markets[marketId];
        if (market.state != MarketState.OPEN) {
            revert MarketNotOpen();
        }

        market.pomProfitBps = pomProfitBps;

        emit MarketPomUpdated(marketId, pomProfitBps);
    }

    function lockMarket(uint256 marketId) external {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.OPEN) {
            revert MarketNotOpen();
        }
        if (block.timestamp < market.joiningWindowEnd) {
            revert JoiningWindowActive();
        }

        market.state = MarketState.LOCKED;

        emit MarketLocked(marketId);
    }

    function finalizeSettlement(uint256 marketId, Outcome outcome, OracleData calldata settlementData)
        external
        onlySettlementEngine
    {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.LOCKED) {
            revert MarketNotLocked();
        }
        if (block.timestamp < market.expiryAt) {
            revert MarketNotExpired();
        }

        _assertFreshOracle(settlementData);

        market.outcome = outcome;
        market.settlementPrice = settlementData.price;
        market.settlementTimestamp = settlementData.timestamp;
        market.state = MarketState.CLAIMABLE;

        if (outcome == Outcome.DRAW) {
            if (market.vaultCommitted > 0) {
                _nativeTransfer(vault, market.vaultCommitted);
            }
        } else {
            uint256 totalPool = market.upPool + market.downPool;
            uint256 feeAmount = (totalPool * PROTOCOL_FEE_BPS) / 10_000;
            uint256 sweptToVault = totalPool - feeAmount;

            market.feeAmount = feeAmount;
            market.sweptToVault = sweptToVault;

            if (feeAmount > 0) {
                _nativeTransfer(treasury, feeAmount);
            }
            if (sweptToVault > 0) {
                _nativeTransfer(vault, sweptToVault);
            }
        }

        emit MarketSettled(
            marketId,
            outcome,
            settlementData.price,
            market.feeAmount,
            market.sweptToVault
        );
    }

    function claimPayout(uint256 marketId) external {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.CLAIMABLE) {
            revert MarketNotClaimable();
        }

        StakeRecord storage stake = _stakes[marketId][msg.sender];

        if (!stake.exists) {
            revert StakeMissing();
        }
        if (stake.claimed) {
            revert AlreadyClaimed();
        }

        stake.claimed = true;
        market.claimedCount += 1;

        uint256 payout;
        uint256 profit;

        if (market.outcome == Outcome.DRAW) {
            payout = stake.amount;
            ILiquidityVault(vault).payWinner(msg.sender, payout, 0);
        } else if (_isWinningStake(stake.direction, market.outcome)) {
            profit = (stake.amount * market.pomProfitBps) / 10_000;
            payout = stake.amount + profit;
            ILiquidityVault(vault).payWinner(msg.sender, stake.amount, profit);
        }

        if (market.claimedCount == market.participantCount) {
            market.state = MarketState.CLOSED;
        }

        emit MarketClaimed(marketId, msg.sender, market.outcome, payout, profit);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function getMarketParticipants(uint256 marketId) external view returns (address[] memory) {
        return _participants[marketId];
    }

    function getStakeRecord(uint256 marketId, address participant) external view returns (StakeRecord memory) {
        return _stakes[marketId][participant];
    }

    function _recordStake(uint256 marketId, address participant, Direction direction, uint256 stakeAmount) internal {
        if (_hasJoined[marketId][participant]) {
            revert AlreadyJoined();
        }

        _hasJoined[marketId][participant] = true;
        _participants[marketId].push(participant);

        // Native STT already received via msg.value — no token transfer needed.
        // Ask vault to match the user's stake on the opposite side.
        Direction vaultDirection = _opposite(direction);
        ILiquidityVault(vault).fundMarket(marketId, vaultDirection, stakeAmount, address(this));

        StakeRecord storage stake = _stakes[marketId][participant];
        stake.direction = direction;
        stake.amount = stakeAmount;
        stake.claimed = false;
        stake.exists = true;

        Market storage market = _markets[marketId];
        market.totalUserStaked += stakeAmount;
        market.vaultCommitted += stakeAmount;
        market.participantCount += 1;

        if (direction == Direction.UP) {
            market.upPool += stakeAmount;
        } else {
            market.downPool += stakeAmount;
        }
    }

    function _nativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
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

    function _isSupportedDuration(uint256 duration) internal pure returns (bool) {
        return duration == 30 || duration == 60 || duration == 300;
    }

    function _joiningWindowFor(uint256 duration) internal pure returns (uint256) {
        uint256 window = duration / 3;
        return window < 10 ? 10 : window;
    }

    function _opposite(Direction direction) internal pure returns (Direction) {
        return direction == Direction.UP ? Direction.DOWN : Direction.UP;
    }

    function _isWinningStake(Direction direction, Outcome outcome) internal pure returns (bool) {
        return (direction == Direction.UP && outcome == Outcome.UP)
            || (direction == Direction.DOWN && outcome == Outcome.DOWN);
    }
}
