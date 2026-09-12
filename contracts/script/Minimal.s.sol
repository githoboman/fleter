// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";

// Minimal test contract to verify deployment works
contract MinimalTest {
    address public owner;
    
    constructor(address _owner) {
        require(_owner != address(0), "Zero address");
        owner = _owner;
    }
}

contract MinimalDeploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        MinimalTest test = new MinimalTest(deployer);
        vm.stopBroadcast();

        require(address(test) != address(0), "Deployment failed");
    }
}
