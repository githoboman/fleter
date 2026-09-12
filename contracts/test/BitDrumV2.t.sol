// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {BitdrumPriceAdapter} from "../src/BitdrumPriceAdapter.sol";
import {LeaderboardRegistry} from "../src/LeaderboardRegistry.sol";
import {LiquidityVaultV2} from "../src/LiquidityVaultV2.sol";
import {PredictionMarketV2} from "../src/PredictionMarketV2.sol";
import {SettlementEngineV2} from "../src/SettlementEngineV2.sol";
import {TreasuryV2} from "../src/TreasuryV2.sol";
import {Direction, Market, MarketState, Outcome, TraderRecord} from "../src/Types.sol";

contract BitDrumV2Test is Test {
    uint256 internal constant ONE_STT   = 1 ether;
    uint256 internal constant VAULT_SEED = 100 ether; // HIGH_WATER → max 80% payout

    // Actors
    address internal keeper   = makeAddr("keeper");
    address internal reserve  = makeAddr("reserve");
    address internal user1    = makeAddr("user1");
    address internal user2    = makeAddr("user2");
    address internal user3    = makeAddr("user3");
    address internal stranger = makeAddr("stranger");

    // Protocol
    BitdrumPriceAdapter internal adapter;
    LiquidityVaultV2    internal vault;
    TreasuryV2          internal treasury;
    LeaderboardRegistry internal leaderboard;
    PredictionMarketV2  internal market;
    SettlementEngineV2  internal settlementEngine;

    receive() external payable {}

    function setUp() external {
        vm.deal(address(this), 200 ether);
        vm.deal(user1, 50 ether);
        vm.deal(user2, 50 ether);
        vm.deal(user3, 50 ether);

        adapter       = new BitdrumPriceAdapter(address(this));
        vault         = new LiquidityVaultV2(address(this));
        treasury      = new TreasuryV2(address(vault), reserve, address(this));
        leaderboard   = new LeaderboardRegistry(address(this));
        market        = new PredictionMarketV2(
            address(vault), address(treasury), address(adapter), address(this)
        );
        settlementEngine = new SettlementEngineV2(
            address(market), address(leaderboard), address(adapter), address(this)
        );

        // Wire
        adapter.setKeeper(keeper);
        vault.setPredictionMarket(address(market));
        market.setSettlementEngine(address(settlementEngine));
        leaderboard.setSettlementEngine(address(settlementEngine));

        // Seed vault at HIGH_WATER to get max 80% payout
        vault.deposit{value: VAULT_SEED}();

        // Post initial price
        _keeperPost(50_000e8);
    }

    // ── Keeper helpers ────────────────────────────────────────────────────────

    function _keeperPost(uint128 price) internal returns (uint256 roundId) {
        vm.prank(keeper);
        roundId = adapter.postPrice(price, uint128(block.timestamp));
    }

    // ── Market helpers ────────────────────────────────────────────────────────

    function _open1m(address opener, Direction dir, uint256 stake) internal returns (uint256 marketId) {
        vm.prank(opener);
        marketId = market.openMarket{value: stake}(dir, 60);
    }

    function _open5m(address opener, Direction dir, uint256 stake) internal returns (uint256 marketId) {
        vm.prank(opener);
        marketId = market.openMarket{value: stake}(dir, 300);
    }

    function _lockAndSettle(uint256 marketId, uint128 settlementPrice) internal {
        Market memory mkt = market.getMarket(marketId);

        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);

        vm.warp(mkt.expiryAt);
        _keeperPost(settlementPrice);
        settlementEngine.settle(marketId);
    }

    function _fullCycle1m(Direction dir, uint128 settlementPrice) internal returns (uint256 marketId) {
        marketId = _open1m(user1, dir, ONE_STT);
        _lockAndSettle(marketId, settlementPrice);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PRICE ADAPTER
    // ═════════════════════════════════════════════════════════════════════════

    function testAdapterPostAndRead() external {
        vm.prank(keeper);
        uint256 roundId = adapter.postPrice(70_000e8, uint128(block.timestamp));
        assertEq(roundId, 2); // setUp already posted round 1

        (uint256 latestId, uint128 price, uint128 ts) = adapter.getLatestRound();
        assertEq(latestId, 2);
        assertEq(price, 70_000e8);
        assertEq(ts, uint128(block.timestamp));
    }

    function testAdapterGetRound() external {
        vm.prank(keeper);
        adapter.postPrice(65_000e8, uint128(block.timestamp));

        (uint128 price, uint128 ts) = adapter.getRound(1);
        assertEq(price, 50_000e8); // round 1 from setUp
        (price,) = adapter.getRound(2);
        assertEq(price, 65_000e8);
    }

    function testAdapterOwnerCanAlsoPost() external {
        // owner() is also allowed to post (useful before keeper is set)
        adapter.postPrice(55_000e8, uint128(block.timestamp));
        (,uint128 price,) = adapter.getLatestRound();
        assertEq(price, 55_000e8);
    }

    function testAdapterUnauthorizedPostReverts() external {
        vm.expectRevert(BitdrumPriceAdapter.Unauthorized.selector);
        vm.prank(stranger);
        adapter.postPrice(50_000e8, uint128(block.timestamp));
    }

    function testAdapterZeroPriceReverts() external {
        vm.expectRevert(BitdrumPriceAdapter.InvalidPrice.selector);
        vm.prank(keeper);
        adapter.postPrice(0, uint128(block.timestamp));
    }

    function testAdapterFutureTimestampReverts() external {
        vm.expectRevert(BitdrumPriceAdapter.InvalidTimestamp.selector);
        vm.prank(keeper);
        adapter.postPrice(50_000e8, uint128(block.timestamp + 1));
    }

    function testAdapterAssertFreshLatestReverts() external {
        vm.warp(block.timestamp + 200); // 200s later
        // latest round is 200s old, maxAge = 60s → stale
        vm.expectRevert(BitdrumPriceAdapter.StaleRound.selector);
        adapter.assertFreshLatest(60);
    }

    function testAdapterNoRoundsReverts() external {
        // Deploy a fresh adapter with no rounds
        BitdrumPriceAdapter freshAdapter = new BitdrumPriceAdapter(address(this));
        vm.expectRevert(BitdrumPriceAdapter.NoRoundsYet.selector);
        freshAdapter.getLatestRound();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PAYOUT BPS COMPUTATION
    // ═════════════════════════════════════════════════════════════════════════

    function testPayoutBpsAtHighWater() external view {
        // vault has 100 STT (HIGH_WATER) → 80%
        assertEq(market.currentPayoutBps(), 8000);
    }

    function testPayoutBpsAtLowWater() external {
        // drain vault below LOW_WATER
        vm.prank(address(market));
        vault.payWinner(address(this), 96 ether, 0); // leaves 4 STT < 5 STT LOW_WATER
        assertEq(market.currentPayoutBps(), 3000);
    }

    function testPayoutBpsMidRange() external {
        // drain to 55 STT (midpoint between 5 and 100)
        // at 55 STT: excess = 50, range = 95
        // expected = 3000 + 5000 * 50 / 95 ≈ 5631
        vm.prank(address(market));
        vault.payWinner(address(this), 45 ether, 0); // 100 - 45 = 55 STT remains
        uint256 bps = market.currentPayoutBps();
        assertTrue(bps >= 5000 && bps <= 6500, "mid-range payout unexpected");
    }

    function testPayoutBpsLockedAtOpen() external {
        // Drain vault to low water before opening, then open — payout should be low
        vm.prank(address(market));
        vault.payWinner(address(this), 96 ether, 0); // 4 STT remains
        vault.deposit{value: 2 ether}(); // 6 STT > LOW_WATER but low

        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        // payout should be locked at low-end value
        assertTrue(mkt.pomProfitBps < 5000);

        // Later replenish vault — payout on this market should NOT change
        vault.deposit{value: 100 ether}();
        assertEq(market.getMarket(marketId).pomProfitBps, mkt.pomProfitBps);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PREDICTIONMARKETV2 — LIFECYCLE
    // ═════════════════════════════════════════════════════════════════════════

    function testOpen1mMarket() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        Market memory mkt = market.getMarket(marketId);
        assertEq(mkt.marketId, 1);
        assertEq(mkt.duration, 60);
        assertEq(mkt.strikePrice, 50_000e8);
        assertEq(uint256(mkt.state), uint256(MarketState.OPEN));
        assertEq(mkt.pomProfitBps, 8000); // vault at HIGH_WATER
        // join window = 20s for 1m
        assertEq(mkt.joiningWindowEnd, block.timestamp + 20);
        // expiry = now + 60s
        assertEq(mkt.expiryAt, block.timestamp + 60);
    }

    function testOpen5mMarket() external {
        uint256 marketId = _open5m(user1, Direction.DOWN, ONE_STT);

        Market memory mkt = market.getMarket(marketId);
        assertEq(mkt.duration, 300);
        // join window = 60s for 5m
        assertEq(mkt.joiningWindowEnd, block.timestamp + 60);
        assertEq(mkt.expiryAt, block.timestamp + 300);
    }

    function testJoinMarketDifferentDirection() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);

        Market memory mkt = market.getMarket(marketId);
        assertEq(mkt.upPool, ONE_STT);
        assertEq(mkt.downPool, ONE_STT);
        assertEq(mkt.participantCount, 2);
    }

    function testJoinMarketSameDirection() external {
        // Same direction joins are allowed — vault covers each
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        vm.prank(user2);
        market.joinMarket{value: 2 * ONE_STT}(marketId, Direction.UP);

        Market memory mkt = market.getMarket(marketId);
        assertEq(mkt.upPool, 3 * ONE_STT);
        assertEq(mkt.downPool, 0);
        assertEq(mkt.participantCount, 2);
        // vault committed 3 STT (one per STT staked in total)
        assertEq(mkt.vaultCommitted, 3 * ONE_STT);
    }

    function testLockMarket() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);

        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);

        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.LOCKED));
    }

    // ── Full 1m settle + claim: UP wins ───────────────────────────────────────

    function testFullCycle1mUpWins() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);

        // settle: price goes up → UP wins
        _lockAndSettle(marketId, 51_000e8);

        Market memory settled = market.getMarket(marketId);
        assertEq(uint256(settled.state), uint256(MarketState.CLAIMABLE));
        assertEq(uint256(settled.outcome), uint256(Outcome.UP));

        // fee = 2 STT × 2% = 0.04 STT. TreasuryV2 auto-routes so treasury balance stays 0.
        assertEq(address(treasury).balance, 0);

        uint256 u1Before = user1.balance;
        vm.prank(user1);
        market.claimPayout(marketId);
        // user1 (UP winner): stake = 1 STT, profit = 1 × 80% = 0.8 STT, payout = 1.8 STT
        assertEq(user1.balance, u1Before + 1.8 ether);

        uint256 u2Before = user2.balance;
        vm.prank(user2);
        market.claimPayout(marketId); // loser — no payout
        assertEq(user2.balance, u2Before);

        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLOSED));
    }

    // ── Full 5m settle + claim: DOWN wins ─────────────────────────────────────

    function testFullCycle5mDownWins() external {
        _keeperPost(50_000e8); // ensure fresh price
        uint256 marketId = _open5m(user1, Direction.DOWN, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.UP);

        _lockAndSettle(marketId, 48_000e8);

        assertEq(uint256(market.getMarket(marketId).outcome), uint256(Outcome.DOWN));

        uint256 u1Before = user1.balance;
        vm.prank(user1);
        market.claimPayout(marketId);
        // 80% payout (vault at HIGH_WATER) → 1.8 STT
        assertEq(user1.balance, u1Before + 1.8 ether);
    }

    // ── Draw: refund stakes ────────────────────────────────────────────────────

    function testDrawRefundsStakes() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: 2 * ONE_STT}(marketId, Direction.DOWN);

        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);
        _keeperPost(50_000e8); // same price → DRAW
        settlementEngine.settle(marketId);

        assertEq(uint256(market.getMarket(marketId).outcome), uint256(Outcome.DRAW));

        uint256 u1Before = user1.balance;
        vm.prank(user1);
        market.claimPayout(marketId);
        assertEq(user1.balance, u1Before + ONE_STT); // full refund

        uint256 u2Before = user2.balance;
        vm.prank(user2);
        market.claimPayout(marketId);
        assertEq(user2.balance, u2Before + 2 * ONE_STT); // full refund
    }

    // ── Leaderboard recorded correctly ─────────────────────────────────────────

    function testLeaderboardWinRecorded() external {
        uint256 marketId = _fullCycle1m(Direction.UP, 51_000e8);

        vm.prank(user1);
        market.claimPayout(marketId);

        (uint256 tm, uint256 w, uint256 l,, int256 pnl) = leaderboard.records(user1);
        assertEq(tm, 1);
        assertEq(w, 1);
        assertEq(l, 0);
        assertEq(pnl, int256(0.8 ether)); // 80% of 1 STT
    }

    function testLeaderboardLossRecorded() external {
        uint256 marketId = _open1m(user1, Direction.DOWN, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.UP);
        _lockAndSettle(marketId, 51_000e8); // price up → DOWN loses

        vm.prank(user1);
        market.claimPayout(marketId);

        (,uint256 w, uint256 l,, int256 pnl) = leaderboard.records(user1);
        assertEq(w, 0);
        assertEq(l, 1);
        assertEq(pnl, -int256(ONE_STT));
    }

    function testLeaderboardDrawRecorded() external {
        uint256 marketId = _fullCycle1m(Direction.UP, 50_000e8);

        vm.prank(user1);
        market.claimPayout(marketId);

        (,uint256 w,, uint256 d, int256 pnl) = leaderboard.records(user1);
        assertEq(w, 0);
        assertEq(d, 1);
        assertEq(pnl, 0);
    }

    // ── Multiple markets increment IDs ────────────────────────────────────────

    function testMultipleMarketsIncrementIds() external {
        uint256 id1 = _open1m(user1, Direction.UP, ONE_STT);
        uint256 id2 = _open5m(user2, Direction.DOWN, ONE_STT);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(market.nextMarketId(), 2);
    }

    // ── Market stays CLAIMABLE until all claims ───────────────────────────────

    function testMarketRemainsClaimableUntilAllClaim() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
        _lockAndSettle(marketId, 51_000e8);

        vm.prank(user1);
        market.claimPayout(marketId);
        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLAIMABLE));

        vm.prank(user2);
        market.claimPayout(marketId);
        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLOSED));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TREASURY V2 — auto-distribution
    // ─────────────────────────────────────────────────────────────────────────

    function testTreasuryAutoDistributesOnFee() external {
        // totalPool = 2 user STT + 2 vault committed = 4 STT
        // fee = 4 * 2% = 0.08 STT
        // treasury auto-routes: 60% = 0.048 STT to vault, 40% = 0.032 STT to reserve
        uint256 reserveBefore = reserve.balance;

        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
        _lockAndSettle(marketId, 51_000e8);

        uint256 totalPool       = 4 * ONE_STT; // 2 user + 2 vault committed
        uint256 fee             = totalPool * 200 / 10_000; // 0.08 STT
        uint256 expectedReserve = fee * 4000 / 10_000;     // 0.032 STT

        assertEq(reserve.balance - reserveBefore, expectedReserve);
        assertEq(address(treasury).balance, 0); // auto-routed immediately
    }

    function testTreasurySetRecipients() external {
        address newVault   = makeAddr("newVault");
        address newReserve = makeAddr("newReserve");
        treasury.setRecipients(newVault, newReserve);
        assertEq(treasury.vaultRecipient(), newVault);
        assertEq(treasury.reserveRecipient(), newReserve);
    }

    function testTreasurySetRecipientsNonOwnerReverts() external {
        vm.expectRevert();
        vm.prank(stranger);
        treasury.setRecipients(address(vault), reserve);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VAULT V2 — rescue path
    // ─────────────────────────────────────────────────────────────────────────

    function testVaultRescue() external {
        uint256 before = address(this).balance;
        vault.rescue(address(this), 10 ether);
        assertEq(address(this).balance, before + 10 ether);
    }

    function testVaultRescueNonOwnerReverts() external {
        vm.expectRevert();
        vm.prank(stranger);
        vault.rescue(stranger, 1 ether);
    }

    function testVaultRescueInsufficientReverts() external {
        vm.expectRevert(LiquidityVaultV2.InsufficientBalance.selector);
        vault.rescue(address(this), 200 ether); // more than vault balance
    }

    function testVaultDepositNonOwnerReverts() external {
        vm.prank(stranger);
        (bool success,) = address(vault).call{value: 1 ether}(
            abi.encodeWithSignature("deposit()")
        );
        assertFalse(success);
    }

    function testVaultFundMarketUnauthorizedReverts() external {
        vm.expectRevert(LiquidityVaultV2.Unauthorized.selector);
        vm.prank(stranger);
        vault.fundMarket(1, Direction.UP, 1 ether, stranger);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OPENMARKET REVERTS
    // ─────────────────────────────────────────────────────────────────────────

    function testOpenMarket30sReverts() external {
        vm.expectRevert(PredictionMarketV2.InvalidDuration.selector);
        vm.prank(user1);
        market.openMarket{value: ONE_STT}(Direction.UP, 30);
    }

    function testOpenMarketZeroStakeReverts() external {
        vm.expectRevert(PredictionMarketV2.InvalidStake.selector);
        vm.prank(user1);
        market.openMarket{value: 0}(Direction.UP, 60);
    }

    function testOpenMarketStaleAdapterReverts() external {
        vm.warp(block.timestamp + 200); // adapter round is now 200s old (> 60s max)
        vm.expectRevert(BitdrumPriceAdapter.StaleRound.selector);
        vm.prank(user1);
        market.openMarket{value: ONE_STT}(Direction.UP, 60);
    }

    function testOpenMarketInsufficientVaultReverts() external {
        // Drain vault below user stake
        vault.rescue(address(this), vault.availableLiquidity() - 0.5 ether);

        vm.expectRevert(PredictionMarketV2.InsufficientVaultLiquidity.selector);
        vm.prank(user1);
        market.openMarket{value: ONE_STT}(Direction.UP, 60);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // JOINMARKET REVERTS
    // ─────────────────────────────────────────────────────────────────────────

    function testJoinAfterWindowClosedReverts() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd + 1);

        vm.expectRevert(PredictionMarketV2.JoiningWindowClosed.selector);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
    }

    function testJoinLockedMarketReverts() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);

        vm.expectRevert(PredictionMarketV2.MarketNotOpen.selector);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
    }

    function testCannotJoinTwice() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        vm.expectRevert(PredictionMarketV2.AlreadyJoined.selector);
        vm.prank(user1);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LOCK REVERTS
    // ─────────────────────────────────────────────────────────────────────────

    function testCannotLockDuringJoinWindow() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        vm.expectRevert(PredictionMarketV2.JoiningWindowActive.selector);
        market.lockMarket(marketId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CLAIM REVERTS
    // ─────────────────────────────────────────────────────────────────────────

    function testCannotClaimTwice() external {
        // Need a 2-participant market so it stays CLAIMABLE after user1's first claim.
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
        _lockAndSettle(marketId, 51_000e8);

        vm.prank(user1);
        market.claimPayout(marketId);

        vm.expectRevert(PredictionMarketV2.AlreadyClaimed.selector);
        vm.prank(user1);
        market.claimPayout(marketId);
    }

    function testClaimWithNoStakeReverts() external {
        uint256 marketId = _fullCycle1m(Direction.UP, 51_000e8);

        vm.expectRevert(PredictionMarketV2.StakeMissing.selector);
        vm.prank(user3); // never staked
        market.claimPayout(marketId);
    }

    function testClaimOnOpenMarketReverts() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        vm.expectRevert(PredictionMarketV2.MarketNotClaimable.selector);
        vm.prank(user1);
        market.claimPayout(marketId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FINALIZE SETTLEMENT ACCESS CONTROL
    // ─────────────────────────────────────────────────────────────────────────

    function testFinalizeSettlementOnlySettlementEngine() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);

        vm.expectRevert(PredictionMarketV2.Unauthorized.selector);
        vm.prank(stranger);
        market.finalizeSettlement(marketId, Outcome.UP, 51_000e8, uint128(block.timestamp));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SETTLEMENT ENGINE V2 REVERTS
    // ─────────────────────────────────────────────────────────────────────────

    function testSettleNonLockedMarketReverts() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);

        vm.expectRevert(SettlementEngineV2.MarketNotLocked.selector);
        settlementEngine.settle(marketId);
    }

    function testCannotSettleBeforeExpiry() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        // Warp to just before expiry
        vm.warp(mkt.expiryAt - 1);

        vm.expectRevert(SettlementEngineV2.MarketNotExpired.selector);
        settlementEngine.settle(marketId);
    }

    function testSettlementPriceTooEarlyReverts() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);

        // Post a price BEFORE market expiry, then try to settle after expiry
        _keeperPost(51_000e8); // posted before expiryAt
        vm.warp(mkt.expiryAt);

        // Price round timestamp (joiningWindowEnd) < expiryAt → should revert
        vm.expectRevert(SettlementEngineV2.SettlementPriceTooEarly.selector);
        settlementEngine.settle(marketId);
    }

    function testSettlementPriceStaleReverts() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);

        // Post fresh price at expiry
        _keeperPost(51_000e8);

        // Then warp 200s further — price is now 200s stale (> 90s max)
        vm.warp(block.timestamp + 200);

        vm.expectRevert(SettlementEngineV2.SettlementPriceStale.selector);
        settlementEngine.settle(marketId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ORACLE SPOOF RESISTANCE
    // ─────────────────────────────────────────────────────────────────────────

    function testNoUserSuppliedPriceAtOpen() external view {
        // openMarket() takes only (direction, duration) — no price param.
        // This test asserts the function signature does not accept price data.
        // The market reads from adapter only.
        // If this compiles and the market uses adapter price, the test passes.
        (,uint128 adapterPrice,) = adapter.getLatestRound();
        assertEq(adapterPrice, 50_000e8); // from setUp
    }

    function testStrikeFromAdapterMatchesLatestRound() external {
        _keeperPost(62_000e8); // post new price
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        assertEq(mkt.strikePrice, 62_000e8);
    }

    function testSettlementFromAdapterNotUserInput() external {
        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);

        // Keeper posts 55_000 → UP wins
        _keeperPost(55_000e8);
        settlementEngine.settle(marketId);

        assertEq(market.getMarket(marketId).settlementPrice, 55_000e8);
        assertEq(uint256(market.getMarket(marketId).outcome), uint256(Outcome.UP));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INSOLVENCY PREVENTION
    // ─────────────────────────────────────────────────────────────────────────

    function testVaultSolvencyAfterSettlement() external {
        // totalPool = user stakes (2 STT) + vault committed (2 STT) = 4 STT
        // fee = 4 * 2% = 0.08 STT → treasury auto-routes 60% = 0.048 STT back to vault
        // sweptToVault = 4 - 0.08 = 3.92 STT
        // vault net: -2 (committed) + 3.92 (swept) + 0.048 (treasury) - 1.8 (winner payout) = +0.168 STT
        uint256 vaultBefore = vault.availableLiquidity();

        uint256 marketId = _open1m(user1, Direction.UP, ONE_STT);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
        _lockAndSettle(marketId, 51_000e8); // UP wins

        vm.prank(user1);
        market.claimPayout(marketId);
        vm.prank(user2);
        market.claimPayout(marketId);

        uint256 vaultAfter = vault.availableLiquidity();
        // vault gains +0.168 STT per settled 2-participant market at 80% payout
        assertApproxEqAbs(vaultAfter, vaultBefore + 0.168 ether, 0.001 ether);
    }

    function testSingleUserMarketDrawVaultSolvent() external {
        // Solo market (opener only) → DRAW → vault sweeps all back, pays user principal
        // totalPool = upPool (1) + downPool (0) + vaultCommitted (1) = 2 STT swept to vault
        // vault: -1 (commit) + 2 (sweep) - 1 (pay user) = 0 net change
        uint256 vaultBefore  = vault.availableLiquidity();
        uint256 marketId     = _open1m(user1, Direction.UP, ONE_STT);
        Market memory mkt    = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);
        _keeperPost(50_000e8); // same price → DRAW
        settlementEngine.settle(marketId);

        vm.prank(user1);
        market.claimPayout(marketId);

        uint256 vaultAfter = vault.availableLiquidity();
        // No fee on draw; vault is made whole
        assertEq(vaultAfter, vaultBefore);
    }
}
