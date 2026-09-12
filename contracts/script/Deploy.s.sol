// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {LeaderboardRegistry} from "../src/LeaderboardRegistry.sol";
import {LiquidityVault} from "../src/LiquidityVault.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {SettlementEngine} from "../src/SettlementEngine.sol";
import {SubscriptionsContract} from "../src/SubscriptionsContract.sol";
import {Treasury} from "../src/Treasury.sol";

contract DeployScript is Script {
    /// Vault seed: 10 STT — enough to match up to 10 concurrent 1-STT stakes
    /// before any market settles. The vault is self-sustaining after the first
    /// settled market (it earns ~0.87 STT per 2-participant round).
    uint256 constant VAULT_SEED_STT = 10 ether;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Core protocol contracts — all use native STT, no token address needed
        LiquidityVault vault = new LiquidityVault(deployer);
        Treasury treasury = new Treasury(address(vault), deployer, deployer, deployer);
        LeaderboardRegistry leaderboard = new LeaderboardRegistry(deployer);
        PredictionMarket market = new PredictionMarket(address(vault), address(treasury), deployer);
        SettlementEngine settlementEngine = new SettlementEngine(address(market), address(leaderboard), deployer);
        SubscriptionsContract subscriptions = new SubscriptionsContract(deployer, deployer);

        // 2. Wire contracts together
        vault.setPredictionMarket(address(market));
        market.setSettlementEngine(address(settlementEngine));
        leaderboard.setSettlementEngine(address(settlementEngine));

        // 3. Seed the vault with native STT so it can pay out winners
        vault.deposit{value: VAULT_SEED_STT}();

        vm.stopBroadcast();

        console.log("=== BitDrum Deployment Addresses ===");
        console.log("LiquidityVault:            ", address(vault));
        console.log("Treasury:                  ", address(treasury));
        console.log("LeaderboardRegistry:       ", address(leaderboard));
        console.log("PredictionMarket:          ", address(market));
        console.log("SettlementEngine:          ", address(settlementEngine));
        console.log("SubscriptionsContract:     ", address(subscriptions));
        console.log("=====================================");
        console.log("Vault seeded with:          10 STT (native)");
    }
}
