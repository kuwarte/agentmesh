// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/APIRegistry.sol";
import "../src/X402Facilitator.sol";

/**
 * @notice Deploys APIRegistry and X402Facilitator
 *
 * Local anvil:
 *   USDC_ADDRESS=<mock> TREASURY_ADDRESS=<addr> \
 *   forge script script/Deploy.s.sol \
 *     --rpc-url http://127.0.0.1:8545 \
 *     --private-key <ANVIL_KEY> \
 *     --broadcast
 *
 * Morph Hoodi testnet:
 *   USDC_ADDRESS=<mock_hoodi> TREASURY_ADDRESS=<addr> \
 *   forge script script/Deploy.s.sol \
 *     --rpc-url morph_hoodi \
 *     --private-key <YOUR_PRIVATE_KEY> \
 *     --broadcast
 *
 * Chain ID: 2910
 * Explorer: https://explorer-hoodi.morphl2.io
 */
contract Deploy is Script {
    function run() external {
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();

        APIRegistry registry = new APIRegistry();
        X402Facilitator facilitator = new X402Facilitator(usdcAddress, treasury);

        vm.stopBroadcast();

        console.log("=== Deployed Contracts ===");
        console.log("APIRegistry     :", address(registry));
        console.log("X402Facilitator :", address(facilitator));
        console.log("USDC            :", usdcAddress);
        console.log("Treasury        :", treasury);
        console.log("");
        console.log("Copy these into apps/backend/.env");
    }
}
