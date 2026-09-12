// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {LeaderboardRegistry} from "../src/LeaderboardRegistry.sol";
import {LiquidityVault} from "../src/LiquidityVault.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {SettlementEngine} from "../src/SettlementEngine.sol";
import {SubscriptionsContract} from "../src/SubscriptionsContract.sol";
import {Treasury} from "../src/Treasury.sol";
import {Direction, Market, MarketState, OracleData, Outcome, Tier, TraderRecord} from "../src/Types.sol";

contract BitDrumProtocolTest is Test {
    uint256 internal constant ONE_STT = 1 ether;

    address internal user1 = makeAddr("user1");
    address internal user2 = makeAddr("user2");
    address internal user3 = makeAddr("user3");
    address internal aiFund = makeAddr("aiFund");
    address internal reserveFund = makeAddr("reserveFund");
    address internal signalRevenuePool = makeAddr("signalRevenuePool");
    address internal stranger = makeAddr("stranger");

    LiquidityVault internal vault;
    Treasury internal treasury;
    LeaderboardRegistry internal leaderboard;
    PredictionMarket internal market;
    SettlementEngine internal settlementEngine;
    SubscriptionsContract internal subscriptions;

    receive() external payable {}

    function setUp() external {
        vm.deal(address(this), 200 ether);
        vm.deal(user1, 50 ether);
        vm.deal(user2, 50 ether);
        vm.deal(user3, 50 ether);

        vault = new LiquidityVault(address(this));
        treasury = new Treasury(address(vault), aiFund, reserveFund, address(this));
        leaderboard = new LeaderboardRegistry(address(this));
        market = new PredictionMarket(address(vault), address(treasury), address(this));
        settlementEngine = new SettlementEngine(address(market), address(leaderboard), address(this));
        subscriptions = new SubscriptionsContract(signalRevenuePool, address(this));

        vault.setPredictionMarket(address(market));
        market.setSettlementEngine(address(settlementEngine));
        leaderboard.setSettlementEngine(address(settlementEngine));

        vault.deposit{value: 10 ether}();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _freshOracle(uint128 price) internal view returns (OracleData memory) {
        return OracleData({price: price, timestamp: uint128(block.timestamp)});
    }

    function _openAndLock(address opener, Direction dir, uint256 stake, uint256 duration)
        internal
        returns (uint256 marketId, Market memory mkt)
    {
        vm.prank(opener);
        marketId = market.openMarket{value: stake}(dir, duration, _freshOracle(50_000e8));
        mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
    }

    function _fullCycle(Direction openerDir, uint128 settlementPrice)
        internal
        returns (uint256 marketId)
    {
        vm.prank(user1);
        marketId = market.openMarket{value: ONE_STT}(openerDir, 30, _freshOracle(50_000e8));
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(
            marketId,
            openerDir == Direction.UP ? Direction.DOWN : Direction.UP
        );
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);
        settlementEngine.settle(marketId, _freshOracle(settlementPrice));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PREDICTIONMARKET
    // ═════════════════════════════════════════════════════════════════════════

    // ── Core lifecycle ────────────────────────────────────────────────────────

    function testOpenJoinSettleAndClaimLifecycle() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 60, _freshOracle(100_000e8));

        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);

        market.setPomProfitBps(marketId, 2_000);

        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);
        settlementEngine.settle(marketId, _freshOracle(101_000e8));

        Market memory settled = market.getMarket(marketId);
        assertEq(uint256(settled.state), uint256(MarketState.CLAIMABLE));
        assertEq(uint256(settled.outcome), uint256(Outcome.UP));
        // fee = 4 STT × 2% = 0.08 STT
        assertEq(address(treasury).balance, 80_000_000_000_000_000);

        uint256 u1Before = address(user1).balance;
        vm.prank(user1);
        market.claimPayout(marketId);
        // payout = 1 STT principal + 20% profit = 1.2 STT
        assertEq(address(user1).balance, u1Before + 1.2 ether);

        uint256 u2Before = address(user2).balance;
        vm.prank(user2);
        market.claimPayout(marketId);
        // loser gets nothing
        assertEq(address(user2).balance, u2Before);

        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLOSED));

        (uint256 tm1, uint256 w1, uint256 l1,, int256 pnl1) = leaderboard.records(user1);
        assertEq(tm1, 1); assertEq(w1, 1); assertEq(l1, 0);
        assertEq(pnl1, int256(0.2 ether));

        (uint256 tm2, uint256 w2, uint256 l2,, int256 pnl2) = leaderboard.records(user2);
        assertEq(tm2, 1); assertEq(w2, 0); assertEq(l2, 1);
        assertEq(pnl2, -int256(ONE_STT));
    }

    function testDownDirectionWinsSettlement() external {
        // user1 opens DOWN, user2 joins UP, price falls → DOWN wins
        uint256 marketId = _fullCycle(Direction.DOWN, 49_000e8);

        assertEq(uint256(market.getMarket(marketId).outcome), uint256(Outcome.DOWN));

        uint256 u1Before = address(user1).balance;
        vm.prank(user1);
        market.claimPayout(marketId);
        // user1 (DOWN winner) receives principal + MIN_POM profit (500 bps = 5%)
        assertEq(address(user1).balance, u1Before + 1.05 ether);

        uint256 u2Before = address(user2).balance;
        vm.prank(user2);
        market.claimPayout(marketId); // loser — no payout
        assertEq(address(user2).balance, u2Before);

        (,uint256 w1,,,) = leaderboard.records(user1);
        assertEq(w1, 1);
        (,, uint256 l2,,) = leaderboard.records(user2);
        assertEq(l2, 1);
    }

    function testDrawRefundsStakeAndReturnsVaultLiquidity() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: 2 * ONE_STT}(Direction.UP, 30, _freshOracle(99_500e8));
        uint256 vaultBefore = address(vault).balance;

        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);
        // Exact same price → DRAW
        settlementEngine.settle(marketId, _freshOracle(99_500e8));

        assertEq(uint256(market.getMarket(marketId).outcome), uint256(Outcome.DRAW));
        assertEq(address(treasury).balance, 0);
        assertEq(address(vault).balance, vaultBefore + 2 ether);

        uint256 u1Before = address(user1).balance;
        vm.prank(user1);
        market.claimPayout(marketId);
        assertEq(address(user1).balance, u1Before + 2 ether);
    }

    function testDrawRecordedOnLeaderboard() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);
        settlementEngine.settle(marketId, _freshOracle(50_000e8));

        vm.prank(user1);
        market.claimPayout(marketId);

        (, uint256 w,, uint256 d, int256 pnl) = leaderboard.records(user1);
        assertEq(w, 0);
        assertEq(d, 1);
        assertEq(pnl, 0);
    }

    function testMarketRemainsClaimableUntilAllClaim() external {
        uint256 marketId = _fullCycle(Direction.UP, 51_000e8);
        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLAIMABLE));

        // Only user1 claims — market should still be CLAIMABLE
        vm.prank(user1);
        market.claimPayout(marketId);
        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLAIMABLE));

        // user2 claims — now CLOSED
        vm.prank(user2);
        market.claimPayout(marketId);
        assertEq(uint256(market.getMarket(marketId).state), uint256(MarketState.CLOSED));
    }

    function testMultipleMarketsIncrement() external {
        vm.prank(user1);
        uint256 id1 = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));
        vm.prank(user2);
        uint256 id2 = market.openMarket{value: ONE_STT}(Direction.DOWN, 60, _freshOracle(50_000e8));

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(market.nextMarketId(), 2);
    }

    // ── openMarket reverts ────────────────────────────────────────────────────

    function testInvalidDurationReverts() external {
        vm.expectRevert(PredictionMarket.InvalidDuration.selector);
        vm.prank(user1);
        market.openMarket{value: ONE_STT}(Direction.UP, 45, _freshOracle(50_000e8));
    }

    function testZeroStakeReverts() external {
        vm.expectRevert(PredictionMarket.InvalidStake.selector);
        vm.prank(user1);
        market.openMarket{value: 0}(Direction.UP, 30, _freshOracle(50_000e8));
    }

    function testOracleZeroPriceReverts() external {
        vm.expectRevert(PredictionMarket.InvalidOraclePrice.selector);
        vm.prank(user1);
        market.openMarket{value: ONE_STT}(Direction.UP, 30, OracleData({price: 0, timestamp: uint128(block.timestamp)}));
    }

    function testOracleFutureTimestampReverts() external {
        vm.expectRevert(PredictionMarket.OraclePriceStale.selector);
        vm.prank(user1);
        market.openMarket{value: ONE_STT}(
            Direction.UP, 30,
            OracleData({price: 50_000e8, timestamp: uint128(block.timestamp + 1)})
        );
    }

    function testOracleTooOldReverts() external {
        vm.warp(1000);
        vm.expectRevert(PredictionMarket.OraclePriceStale.selector);
        vm.prank(user1);
        // timestamp is 151 seconds in the past — exceeds ORACLE_MAX_AGE (150)
        market.openMarket{value: ONE_STT}(
            Direction.UP, 30,
            OracleData({price: 50_000e8, timestamp: uint128(block.timestamp - 151)})
        );
    }

    // ── joinMarket reverts ────────────────────────────────────────────────────

    function testCannotJoinAfterJoiningWindowClosed() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));
        vm.warp(market.getMarket(marketId).joiningWindowEnd + 1);

        vm.expectRevert(PredictionMarket.JoiningWindowClosed.selector);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
    }

    function testCannotJoinLockedMarket() external {
        (uint256 marketId,) = _openAndLock(user1, Direction.UP, ONE_STT, 30);

        vm.expectRevert(PredictionMarket.MarketNotOpen.selector);
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
    }

    function testCannotJoinTwice() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.AlreadyJoined.selector);
        vm.prank(user1);
        market.joinMarket{value: ONE_STT}(marketId, Direction.DOWN);
    }

    function testJoinZeroStakeReverts() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.InvalidStake.selector);
        vm.prank(user2);
        market.joinMarket{value: 0}(marketId, Direction.DOWN);
    }

    // ── lockMarket reverts ────────────────────────────────────────────────────

    function testCannotLockDuringJoiningWindow() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.JoiningWindowActive.selector);
        market.lockMarket(marketId);
    }

    // ── setPomProfitBps reverts ───────────────────────────────────────────────

    function testPomUnauthorizedReverts() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.Unauthorized.selector);
        vm.prank(stranger);
        market.setPomProfitBps(marketId, 1_000);
    }

    function testPomBelowMinReverts() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.InvalidPom.selector);
        market.setPomProfitBps(marketId, 499); // MIN is 500
    }

    function testPomAboveMaxReverts() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.InvalidPom.selector);
        market.setPomProfitBps(marketId, 7_001); // MAX is 7000
    }

    function testPomOnLockedMarketReverts() external {
        (uint256 marketId,) = _openAndLock(user1, Direction.UP, ONE_STT, 30);

        vm.expectRevert(PredictionMarket.MarketNotOpen.selector);
        market.setPomProfitBps(marketId, 1_000);
    }

    // ── claimPayout reverts ───────────────────────────────────────────────────

    function testCannotClaimTwice() external {
        uint256 marketId = _fullCycle(Direction.DOWN, 49_000e8);

        vm.prank(user1);
        market.claimPayout(marketId);

        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        vm.prank(user1);
        market.claimPayout(marketId);
    }

    function testStakeMissingReverts() external {
        uint256 marketId = _fullCycle(Direction.UP, 51_000e8);

        vm.expectRevert(PredictionMarket.StakeMissing.selector);
        vm.prank(user3); // user3 never staked
        market.claimPayout(marketId);
    }

    function testClaimOnOpenMarketReverts() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(PredictionMarket.MarketNotClaimable.selector);
        vm.prank(user1);
        market.claimPayout(marketId);
    }

    // ── finalizeSettlement access ─────────────────────────────────────────────

    function testFinalizeSettlementOnlySettlementEngine() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));
        Market memory mkt = market.getMarket(marketId);
        vm.warp(mkt.joiningWindowEnd);
        market.lockMarket(marketId);
        vm.warp(mkt.expiryAt);

        vm.expectRevert(PredictionMarket.Unauthorized.selector);
        vm.prank(stranger);
        market.finalizeSettlement(marketId, Outcome.UP, _freshOracle(51_000e8));
    }

    // ── SettlementEngine reverts ──────────────────────────────────────────────

    function testSettleNonLockedMarketReverts() external {
        vm.prank(user1);
        uint256 marketId = market.openMarket{value: ONE_STT}(Direction.UP, 30, _freshOracle(50_000e8));

        vm.expectRevert(SettlementEngine.MarketNotLocked.selector);
        settlementEngine.settle(marketId, _freshOracle(51_000e8));
    }

    function testCannotSettleBeforeExpiry() external {
        (uint256 marketId, Market memory mkt) = _openAndLock(user1, Direction.UP, ONE_STT, 30);
        // Still before expiryAt
        vm.warp(mkt.expiryAt - 1);

        vm.expectRevert(SettlementEngine.MarketNotExpired.selector);
        settlementEngine.settle(marketId, _freshOracle(51_000e8));
    }

    function testSettleStaleOracleReverts() external {
        (uint256 marketId, Market memory mkt) = _openAndLock(user1, Direction.UP, ONE_STT, 30);
        vm.warp(mkt.expiryAt + 200); // warp far past expiry

        // Oracle timestamp is now 200s stale — exceeds ORACLE_MAX_AGE (150)
        vm.expectRevert(SettlementEngine.OraclePriceStale.selector);
        settlementEngine.settle(
            marketId,
            OracleData({price: 51_000e8, timestamp: uint128(mkt.expiryAt - 10)})
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LIQUIDITYVAULT
    // ═════════════════════════════════════════════════════════════════════════

    function testVaultDepositNonOwnerReverts() external {
        vm.prank(stranger);
        (bool success,) = address(vault).call{value: 1 ether}(
            abi.encodeWithSignature("deposit()")
        );
        assertFalse(success);
    }

    function testVaultFundMarketUnauthorizedReverts() external {
        vm.expectRevert(LiquidityVault.Unauthorized.selector);
        vm.prank(stranger);
        vault.fundMarket(1, Direction.UP, 1 ether, stranger);
    }

    function testVaultPayWinnerUnauthorizedReverts() external {
        vm.expectRevert(LiquidityVault.Unauthorized.selector);
        vm.prank(stranger);
        vault.payWinner(stranger, 1 ether, 0);
    }

    function testVaultAvailableLiquidity() external view {
        assertEq(vault.availableLiquidity(), 10 ether);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // TREASURY
    // ═════════════════════════════════════════════════════════════════════════

    function testTreasurySetRecipients() external {
        address newVault = makeAddr("newVault");
        address newAi = makeAddr("newAi");
        address newReserve = makeAddr("newReserve");

        treasury.setRecipients(newVault, newAi, newReserve);

        assertEq(treasury.vaultRecipient(), newVault);
        assertEq(treasury.aiFundRecipient(), newAi);
        assertEq(treasury.reserveRecipient(), newReserve);
    }

    function testTreasurySetRecipientsZeroAddressReverts() external {
        vm.expectRevert();
        treasury.setRecipients(address(0), aiFund, reserveFund);
    }

    function testTreasurySetRecipientsNonOwnerReverts() external {
        vm.expectRevert();
        vm.prank(stranger);
        treasury.setRecipients(address(vault), aiFund, reserveFund);
    }

    function testTreasuryDistributeEmptyReverts() external {
        vm.expectRevert();
        treasury.distribute();
    }

    function testSubscriptionsAndTreasuryDistribution() external {
        uint256 proFee = subscriptions.PRO_FEE();
        vm.prank(user1);
        subscriptions.subscribe{value: proFee}(Tier.PRO);

        assertEq(address(signalRevenuePool).balance, proFee);
        assertTrue(subscriptions.isActive(user1, Tier.PRO));

        vm.deal(address(treasury), 100 ether);
        treasury.distribute();

        assertEq(address(vault).balance, 10 ether + 40 ether);
        assertEq(address(aiFund).balance, 35 ether);
        assertEq(address(reserveFund).balance, 25 ether);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUBSCRIPTIONSCONTRACT
    // ═════════════════════════════════════════════════════════════════════════

    function testEliteSubscription() external {
        uint256 eliteFee = subscriptions.ELITE_FEE();
        vm.prank(user1);
        subscriptions.subscribe{value: eliteFee}(Tier.ELITE);

        assertTrue(subscriptions.isActive(user1, Tier.ELITE));
        // ELITE also satisfies PRO access
        assertTrue(subscriptions.isActive(user1, Tier.PRO));
        assertEq(address(signalRevenuePool).balance, eliteFee);
    }

    function testSubscribeWrongFeeReverts() external {
        vm.expectRevert();
        vm.prank(user1);
        subscriptions.subscribe{value: 1 ether}(Tier.PRO); // PRO_FEE is 10 ether
    }

    function testSubscriptionExpiresAfterThirtyDays() external {
        uint256 proFee = subscriptions.PRO_FEE();
        vm.prank(user1);
        subscriptions.subscribe{value: proFee}(Tier.PRO);

        assertTrue(subscriptions.isActive(user1, Tier.PRO));

        vm.warp(block.timestamp + 31 days);
        assertFalse(subscriptions.isActive(user1, Tier.PRO));
    }

    function testSetSignalRevenuePool() external {
        address newPool = makeAddr("newPool");
        subscriptions.setSignalRevenuePool(newPool);
        assertEq(subscriptions.signalRevenuePool(), newPool);
    }

    function testSetSignalRevenuePoolZeroReverts() external {
        vm.expectRevert();
        subscriptions.setSignalRevenuePool(address(0));
    }

    function testSetSignalRevenuePoolNonOwnerReverts() external {
        vm.expectRevert();
        vm.prank(stranger);
        subscriptions.setSignalRevenuePool(makeAddr("newPool"));
    }

    // ═════════════════════════════════════════════════════════════════════════
    // LEADERBOARDREGISTRY
    // ═════════════════════════════════════════════════════════════════════════

    function testLeaderboardRecordOutcomeUnauthorizedReverts() external {
        vm.expectRevert(LeaderboardRegistry.Unauthorized.selector);
        vm.prank(stranger);
        leaderboard.recordOutcome(user1, true, ONE_STT, 0.05 ether);
    }

    function testLeaderboardRecordDrawUnauthorizedReverts() external {
        vm.expectRevert(LeaderboardRegistry.Unauthorized.selector);
        vm.prank(stranger);
        leaderboard.recordDraw(user1, ONE_STT);
    }

    function testLeaderboardSetSettlementEngineNonOwnerReverts() external {
        vm.expectRevert();
        vm.prank(stranger);
        leaderboard.setSettlementEngine(makeAddr("fake"));
    }

    function testLeaderboardAccumulatesAcrossMultipleMarkets() external {
        // market 1: user1 wins UP
        _fullCycle(Direction.UP, 51_000e8);
        vm.prank(user1); market.claimPayout(1);
        vm.prank(user2); market.claimPayout(1);

        // market 2: user1 opens DOWN and wins (price goes down)
        vm.prank(user1);
        uint256 id2 = market.openMarket{value: ONE_STT}(Direction.DOWN, 30, _freshOracle(50_000e8));
        vm.prank(user2);
        market.joinMarket{value: ONE_STT}(id2, Direction.UP);
        Market memory m2 = market.getMarket(id2);
        vm.warp(m2.joiningWindowEnd); market.lockMarket(id2);
        vm.warp(m2.expiryAt); settlementEngine.settle(id2, _freshOracle(49_000e8));

        vm.prank(user1); market.claimPayout(id2);
        vm.prank(user2); market.claimPayout(id2);

        (uint256 tm,, uint256 l,, int256 pnl) = leaderboard.records(user1);
        assertEq(tm, 2);   // entered 2 markets
        assertEq(l, 0);    // lost 0, won both
        // pnl = +profit from market1 + profit from market2
        assertTrue(pnl > 0); // net positive from winning both markets
    }
}
