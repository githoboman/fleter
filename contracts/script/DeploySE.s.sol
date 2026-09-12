// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {SettlementEngine} from "../src/SettlementEngine.sol";
import {LeaderboardRegistry} from "../src/LeaderboardRegistry.sol";

contract DeploySE is Script {
    // Current live contracts on Somnia Shannon
    address constant PREDICTION_MARKET = 0x73c1c308Ac8166a2fc6685A5BbC79cda128864BA;
    address constant LEADERBOARD      = 0x6Fa55D5C1E49D135506Bb93d1F34A6E6b98529be;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new Leaderboard
        LeaderboardRegistry lb = new LeaderboardRegistry(deployer);
        address newLb = address(lb);

        // 2. Deploy new SE wired to correct PM + New Leaderboard
        SettlementEngine se = new SettlementEngine(PREDICTION_MARKET, newLb, deployer);

        // 3. Wire PM → SE (requires deployer == owner of PM)
        (bool ok,) = PREDICTION_MARKET.call(
            abi.encodeWithSignature("setSettlementEngine(address)", address(se))
        );
        require(ok, "setSettlementEngine failed");

        // 4. Wire Leaderboard → SE
        lb.setSettlementEngine(address(se));

        vm.stopBroadcast();

        console.log("=== SE & LB Redeployment ===");
        console.log("Leaderboard:       ", address(lb));
        console.log("SettlementEngine:  ", address(se));
        console.log("PM wired to SE:    ", address(se));
        console.log("LB wired to SE:    ", address(se));
    }
}
