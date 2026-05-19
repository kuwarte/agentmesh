// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/APIRegistry.sol";
import "../src/X402Facilitator.sol";

/**
 * @notice Deploys APIRegistry and X402Facilitator
 *
 * Usage (local anvil):
 *   forge script script/Deploy.s.sol \
 *     --rpc-url http://127.0.0.1:8545 \
 *     --private-key <ANVIL_PRIVATE_KEY> \
 *     --broadcast
 *
 * The script reads USDC_ADDRESS and TREASURY_ADDRESS from env.
 * On anvil, pass a mock USDC address (deploy MockUSDC first or use the
 * address printed by the mock deploy below when MOCK_USDC=true).
 */
contract Deploy is Script {
    function run() external {
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();

        APIRegistry registry = new APIRegistry();
        X402Facilitator facilitator = new X402Facilitator(usdcAddress, treasury);

        vm.stopBroadcast();

        console.log("APIRegistry     :", address(registry));
        console.log("X402Facilitator :", address(facilitator));
        console.log("USDC            :", usdcAddress);
        console.log("Treasury        :", treasury);
    }
}
