// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {LiquidityVaultV2} from "../src/LiquidityVaultV2.sol";

contract DeployVaultScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);
        new LiquidityVaultV2(owner);
        vm.stopBroadcast();
    }
}
