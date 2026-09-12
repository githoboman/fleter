// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {
    Direction,
    Market,
    MarketState,
    Outcome,
    StakeRecord
} from "./Types.sol";
import {ILiquidityVault} from "./interfaces/ILiquidityVault.sol";
import {IBitdrumPriceAdapter} from "./interfaces/IBitdrumPriceAdapter.sol";
import {Owned} from "./Owned.sol";

/**
 * @title PredictionMarketV2
 * @notice Vault-backed binary prediction market for BTC/USD direction.
 *
 * V2 changes from V1:
 * - Strike price is read from BitdrumPriceAdapter at open time (no user-supplied price).
 * - Payout rate (payoutBps) is computed dynamically from vault liquidity at open time,
 *   clamped between MIN_PAYOUT_BPS (30%) and MAX_PAYOUT_BPS (80%).
 * - Only 60s and 300s durations are supported.
 * - Join windows: 20s for 60s markets, 60s for 300s markets.
 * - No setPomProfitBps — payout is locked at open, determined by vault health.
 * - Settlement is initiated by SettlementEngineV2 using adapter snapshots.
 * - Treasury fees route immediately on settlement.
 *
 * Economic model:
 *   Each user stake is matched 1:1 by the vault on the opposite direction.
 *   At settlement the entire pool (user + vault funds) sweeps back to the vault
 *   minus a protocol fee. Winners then claim principal + profit from the vault.
 *   Vault edge: fee + (50% chance vault wins) − (50% chance vault pays out profit).
 */
contract PredictionMarketV2 is Owned {
    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant PROTOCOL_FEE_BPS  = 200;  // 2% fee on total pool

    uint256 public constant MIN_PAYOUT_BPS    = 3000; // 30% minimum winner profit
    uint256 public constant MAX_PAYOUT_BPS    = 8000; // 80% maximum winner profit

    // Vault liquidity thresholds for payout scaling.
    // Below LOW_WATER → 30%; above HIGH_WATER → 80%; linear in between.
    uint256 public constant VAULT_LOW_WATER   = 5 ether;   //   5 STT
    uint256 public constant VAULT_HIGH_WATER  = 100 ether; // 100 STT

    // Maximum allowed age of the price adapter's latest round when opening a market.
    // Keeper posts every ~15-30s so 60s allows for one missed post.
    uint256 public constant ADAPTER_MAX_AGE   = 60;

    // Supported durations (seconds).
    uint256 public constant DURATION_1M  = 60;
    uint256 public constant DURATION_5M  = 300;

    // Join windows.
    uint256 public constant JOIN_WINDOW_1M = 20;  // 20 seconds
    uint256 public constant JOIN_WINDOW_5M = 60;  // 60 seconds

    // ── Immutables ────────────────────────────────────────────────────────────

    address public immutable vault;
    address public immutable treasury;
    IBitdrumPriceAdapter public immutable priceAdapter;

    // ── State ─────────────────────────────────────────────────────────────────

    uint256 public nextMarketId;
    address public settlementEngine;

    mapping(uint256 => Market) private _markets;
    mapping(uint256 => mapping(address => StakeRecord)) private _stakes;
    mapping(uint256 => mapping(address => bool)) private _hasJoined;
    mapping(uint256 => address[]) private _participants;

    // ── Events ────────────────────────────────────────────────────────────────

    event SettlementEngineUpdated(address indexed settlementEngine);
    event MarketOpened(
        uint256 indexed marketId,
        address indexed opener,
        Direction direction,
        uint256 stakeAmount,
        uint256 duration,
        uint128 strikePrice,
        uint256 payoutBps
    );
    event MarketJoined(uint256 indexed marketId, address indexed participant, Direction direction, uint256 stakeAmount);
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

    // ── Errors ────────────────────────────────────────────────────────────────

    error InvalidDuration();
    error InvalidStake();
    error MarketNotOpen();
    error MarketNotLocked();
    error MarketNotClaimable();
    error JoiningWindowActive();
    error JoiningWindowClosed();
    error MarketNotExpired();
    error StakeMissing();
    error AlreadyClaimed();
    error AlreadyJoined();
    error AdapterPriceStale();
    error Unauthorized();
    error TransferFailed();
    error InsufficientVaultLiquidity();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address vault_, address treasury_, address priceAdapter_, address owner_) Owned(owner_) {
        require(vault_ != address(0) && treasury_ != address(0) && priceAdapter_ != address(0), "zero address");
        vault = vault_;
        treasury = treasury_;
        priceAdapter = IBitdrumPriceAdapter(priceAdapter_);
    }

    receive() external payable {}

    // ── Admin ─────────────────────────────────────────────────────────────────

    modifier onlySettlementEngine() {
        if (msg.sender != settlementEngine) revert Unauthorized();
        _;
    }

    function setSettlementEngine(address settlementEngine_) external onlyOwner {
        require(settlementEngine_ != address(0), "zero settlement engine");
        settlementEngine = settlementEngine_;
        emit SettlementEngineUpdated(settlementEngine_);
    }

    // ── Market lifecycle ──────────────────────────────────────────────────────

    /**
     * @notice Open a new 1m or 5m directional market.
     * @dev Strike price is read directly from the price adapter — no user-supplied data.
     *      Payout rate is locked at open based on current vault liquidity.
     *      The vault immediately commits matching funds on the opposite side.
     */
    function openMarket(Direction direction, uint256 duration)
        external
        payable
        returns (uint256 marketId)
    {
        if (!_isSupportedDuration(duration)) revert InvalidDuration();
        if (msg.value == 0) revert InvalidStake();

        // Enforce fresh adapter price.
        priceAdapter.assertFreshLatest(ADAPTER_MAX_AGE);
        (, uint128 strikePrice, uint128 strikeTimestamp) = priceAdapter.getLatestRound();

        // Compute payout rate from vault liquidity.
        uint256 payoutBps = _computePayoutBps();

        // Ensure the vault can actually commit the matching funds.
        if (ILiquidityVault(vault).availableLiquidity() < msg.value) {
            revert InsufficientVaultLiquidity();
        }

        marketId = ++nextMarketId;
        uint256 joinWindowEnd = block.timestamp + _joinWindowFor(duration);

        Market storage market = _markets[marketId];
        market.marketId      = marketId;
        market.opener        = msg.sender;
        market.openerDirection = direction;
        market.duration      = duration;
        market.openedAt      = block.timestamp;
        market.joiningWindowEnd = joinWindowEnd;
        market.expiryAt      = block.timestamp + duration;
        market.strikePrice   = strikePrice;
        market.strikeTimestamp = strikeTimestamp;
        market.pomProfitBps  = payoutBps; // reuse field — represents winner profit rate
        market.state         = MarketState.OPEN;
        market.outcome       = Outcome.PENDING;

        _recordStake(marketId, msg.sender, direction, msg.value);

        emit MarketOpened(marketId, msg.sender, direction, msg.value, duration, strikePrice, payoutBps);
    }

    /**
     * @notice Join an existing open market during the join window.
     * @dev Anyone can join any direction. Vault commits matching funds for this stake too.
     */
    function joinMarket(uint256 marketId, Direction direction) external payable {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.OPEN) revert MarketNotOpen();
        if (block.timestamp > market.joiningWindowEnd) revert JoiningWindowClosed();
        if (msg.value == 0) revert InvalidStake();
        if (ILiquidityVault(vault).availableLiquidity() < msg.value) {
            revert InsufficientVaultLiquidity();
        }

        _recordStake(marketId, msg.sender, direction, msg.value);

        emit MarketJoined(marketId, msg.sender, direction, msg.value);
    }

    /**
     * @notice Lock a market once the join window has elapsed. Anyone can call.
     */
    function lockMarket(uint256 marketId) external {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.OPEN) revert MarketNotOpen();
        if (block.timestamp < market.joiningWindowEnd) revert JoiningWindowActive();

        market.state = MarketState.LOCKED;

        emit MarketLocked(marketId);
    }

    /**
     * @notice Finalize settlement. Only callable by SettlementEngineV2.
     * @param outcome         Determined outcome (UP / DOWN / DRAW).
     * @param settlementPrice Price used for settlement (from adapter round).
     * @param settlementTimestamp Timestamp of the settlement round.
     */
    function finalizeSettlement(
        uint256 marketId,
        Outcome outcome,
        uint128 settlementPrice,
        uint128 settlementTimestamp
    ) external onlySettlementEngine {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.LOCKED) revert MarketNotLocked();
        if (block.timestamp < market.expiryAt) revert MarketNotExpired();

        market.outcome             = outcome;
        market.settlementPrice     = settlementPrice;
        market.settlementTimestamp = settlementTimestamp;
        market.state               = MarketState.CLAIMABLE;

        // Full pool = user stakes (up + down) + vault's matched commitments.
        // This ensures the vault's committed funds are swept back correctly.
        uint256 totalPool = market.upPool + market.downPool + market.vaultCommitted;

        if (outcome == Outcome.DRAW) {
            // No fee on draws. Sweep everything back to vault; users claim principal from vault.
            if (totalPool > 0) {
                _nativeTransfer(vault, totalPool);
            }
        } else {
            uint256 feeAmount    = (totalPool * PROTOCOL_FEE_BPS) / 10_000;
            uint256 sweptToVault = totalPool - feeAmount;

            market.feeAmount    = feeAmount;
            market.sweptToVault = sweptToVault;

            // Fee routes immediately to treasury (TreasuryV2 auto-distributes on receive).
            if (feeAmount > 0) {
                _nativeTransfer(treasury, feeAmount);
            }
            // Remaining pool sweeps back to vault, which then pays winners on claim.
            if (sweptToVault > 0) {
                _nativeTransfer(vault, sweptToVault);
            }
        }

        emit MarketSettled(marketId, outcome, settlementPrice, market.feeAmount, market.sweptToVault);
    }

    /**
     * @notice Claim payout for a settled market.
     * @dev Winners receive stake + profit from the vault.
     *      Losers receive nothing.
     *      Draw: everyone receives their stake back from the vault.
     */
    function claimPayout(uint256 marketId) external {
        Market storage market = _markets[marketId];

        if (market.state != MarketState.CLAIMABLE) revert MarketNotClaimable();

        StakeRecord storage stake = _stakes[marketId][msg.sender];

        if (!stake.exists) revert StakeMissing();
        if (stake.claimed) revert AlreadyClaimed();

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

    // ── Views ─────────────────────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function getMarketParticipants(uint256 marketId) external view returns (address[] memory) {
        return _participants[marketId];
    }

    function getStakeRecord(uint256 marketId, address participant) external view returns (StakeRecord memory) {
        return _stakes[marketId][participant];
    }

    /**
     * @notice Preview the payout BPS that would be used if a market were opened right now.
     *         Useful for the frontend to display the advertised payout before confirmation.
     */
    function currentPayoutBps() external view returns (uint256) {
        return _computePayoutBps();
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _recordStake(uint256 marketId, address participant, Direction direction, uint256 stakeAmount) internal {
        if (_hasJoined[marketId][participant]) revert AlreadyJoined();

        _hasJoined[marketId][participant] = true;
        _participants[marketId].push(participant);

        // Ask vault to commit matching funds on the opposite side (sent to this contract).
        Direction vaultDirection = _opposite(direction);
        ILiquidityVault(vault).fundMarket(marketId, vaultDirection, stakeAmount, address(this));

        StakeRecord storage stake = _stakes[marketId][participant];
        stake.direction = direction;
        stake.amount    = stakeAmount;
        stake.claimed   = false;
        stake.exists    = true;

        Market storage market = _markets[marketId];
        market.totalUserStaked += stakeAmount;
        market.vaultCommitted  += stakeAmount;
        market.participantCount += 1;

        if (direction == Direction.UP) {
            market.upPool += stakeAmount;
        } else {
            market.downPool += stakeAmount;
        }
    }

    /**
     * @notice Compute winner profit rate based on vault liquidity.
     *
     * Vault LOW_WATER (5 STT)  → 30% profit  (3000 bps)
     * Vault HIGH_WATER (100 STT) → 80% profit (8000 bps)
     * Linear interpolation in between.
     *
     * This is locked at market open time so users see a deterministic rate
     * before confirming their trade.
     */
    function _computePayoutBps() internal view returns (uint256) {
        uint256 liquidity = ILiquidityVault(vault).availableLiquidity();

        if (liquidity >= VAULT_HIGH_WATER) return MAX_PAYOUT_BPS;
        if (liquidity <= VAULT_LOW_WATER)  return MIN_PAYOUT_BPS;

        uint256 range  = VAULT_HIGH_WATER - VAULT_LOW_WATER;
        uint256 excess = liquidity - VAULT_LOW_WATER;
        return MIN_PAYOUT_BPS + (MAX_PAYOUT_BPS - MIN_PAYOUT_BPS) * excess / range;
    }

    function _nativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _isSupportedDuration(uint256 duration) internal pure returns (bool) {
        return duration == DURATION_1M || duration == DURATION_5M;
    }

    function _joinWindowFor(uint256 duration) internal pure returns (uint256) {
        return duration == DURATION_1M ? JOIN_WINDOW_1M : JOIN_WINDOW_5M;
    }

    function _opposite(Direction direction) internal pure returns (Direction) {
        return direction == Direction.UP ? Direction.DOWN : Direction.UP;
    }

    function _isWinningStake(Direction direction, Outcome outcome) internal pure returns (bool) {
        return (direction == Direction.UP && outcome == Outcome.UP)
            || (direction == Direction.DOWN && outcome == Outcome.DOWN);
    }
}
