// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {LiquidityVault} from "../src/LiquidityVault.sol";

contract SeedScript is Script {
    /// Seed amount: 10 STT
    uint256 constant VAULT_SEED_STT = 10 ether;

    function run() external {
        // LiquidityVault address from deployment
        address payable vaultAddress = payable(0x833E8336d77F7Da45c155e6df4E5c72391073E6c);
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        LiquidityVault vault = LiquidityVault(vaultAddress);
        
        // Seed the vault with 10 STT
        vault.deposit{value: VAULT_SEED_STT}();

        vm.stopBroadcast();

        console.log("=== BitDrum Vault Seeding ===");
        console.log("LiquidityVault:      ", address(vault));
        console.log("Seed amount:          10 STT (native)");
        console.log("New vault balance:   ", address(vault).balance);
        console.log("=============================");
    }
}
