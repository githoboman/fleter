// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {BitdrumPriceAdapter} from "../src/BitdrumPriceAdapter.sol";
import {LeaderboardRegistry} from "../src/LeaderboardRegistry.sol";
import {LiquidityVaultV2} from "../src/LiquidityVaultV2.sol";
import {PredictionMarketV2} from "../src/PredictionMarketV2.sol";
import {SettlementEngineV2} from "../src/SettlementEngineV2.sol";
import {TreasuryV2} from "../src/TreasuryV2.sol";

/**
 * @notice BitDrum V2 deployment script for Somnia Shannon testnet.
 *
 * Deployment order:
 *   1. LiquidityVaultV2
 *   2. TreasuryV2  (routes fees: 60% → vault, 40% → reserve)
 *   3. BitdrumPriceAdapter
 *   4. LeaderboardRegistry
 *   5. PredictionMarketV2
 *   6. SettlementEngineV2
 *
 * Wiring:
 *   - vault.setPredictionMarket(market)
 *   - market.setSettlementEngine(settlementEngine)
 *   - leaderboard.setSettlementEngine(settlementEngine)
 *   - adapter.setKeeper(KEEPER_ADDRESS)
 *   - vault.deposit(VAULT_SEED_STT)
 *
 * Required env vars:
 *   PRIVATE_KEY          — deployer / owner key
 *   KEEPER_ADDRESS       — keeper EOA that will post adapter prices
 *   RESERVE_ADDRESS      — treasury reserve recipient (team wallet)
 *   VAULT_SEED_STT       — wei amount to seed vault (default 50 STT)
 *
 * Run:
 *   forge script script/DeployV2.s.sol --rpc-url shannon --broadcast --verify
 */
contract DeployV2Script is Script {
    uint256 constant DEFAULT_VAULT_SEED = 50 ether; // 50 STT

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address keeperAddress  = vm.envOr("KEEPER_ADDRESS", deployer);
        address reserveAddress = vm.envOr("RESERVE_ADDRESS", deployer);
        uint256 vaultSeed      = vm.envOr("VAULT_SEED_STT", DEFAULT_VAULT_SEED);

        console.log("=== BitDrum V2 Deployment ===");
        console.log("Deployer / Owner:  ", deployer);
        console.log("Keeper address:    ", keeperAddress);
        console.log("Reserve recipient: ", reserveAddress);
        console.log("Vault seed:        ", vaultSeed / 1 ether, "STT");
        console.log("=============================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Vault — holds native STT, provides opposing liquidity for all positions.
        LiquidityVaultV2 vault = new LiquidityVaultV2(deployer);

        // 2. Treasury — auto-routes 2% protocol fee (60% back to vault, 40% to reserve).
        TreasuryV2 treasury = new TreasuryV2(address(vault), reserveAddress, deployer);

        // 3. Price adapter — keeper posts BTC/USD snapshots every 15-30s.
        BitdrumPriceAdapter adapter = new BitdrumPriceAdapter(deployer);

        // 4. Leaderboard — tracks wins/losses/PnL per trader.
        LeaderboardRegistry leaderboard = new LeaderboardRegistry(deployer);

        // 5. Prediction market — the core protocol contract.
        PredictionMarketV2 market = new PredictionMarketV2(
            address(vault),
            address(treasury),
            address(adapter),
            deployer
        );

        // 6. Settlement engine — keeper calls settle(marketId) after expiry.
        SettlementEngineV2 settlementEngine = new SettlementEngineV2(
            address(market),
            address(leaderboard),
            address(adapter),
            deployer
        );

        // Wire contracts together.
        vault.setPredictionMarket(address(market));
        market.setSettlementEngine(address(settlementEngine));
        leaderboard.setSettlementEngine(address(settlementEngine));
        adapter.setKeeper(keeperAddress);

        // Seed vault.
        vault.deposit{value: vaultSeed}();

        vm.stopBroadcast();

        console.log("=== Deployment Addresses ===");
        console.log("BitdrumPriceAdapter:    ", address(adapter));
        console.log("LiquidityVaultV2:       ", address(vault));
        console.log("TreasuryV2:             ", address(treasury));
        console.log("LeaderboardRegistry:    ", address(leaderboard));
        console.log("PredictionMarketV2:     ", address(market));
        console.log("SettlementEngineV2:     ", address(settlementEngine));
        console.log("============================");
        console.log("Vault seeded with:      ", vaultSeed / 1 ether, "STT");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Export these addresses to your .env files.");
        console.log("  2. Start the keeper price publisher (posts to adapter).");
        console.log("  3. Start the keeper market lifecycle loop.");
        console.log("  4. Start indexer from the deploy block.");
        console.log("  5. Start gateway, then frontend.");
    }
}
