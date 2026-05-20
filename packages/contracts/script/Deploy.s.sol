// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/APIRegistry.sol";
import "../src/X402Facilitator.sol";

/**
 * @notice Deploys APIRegistry and X402Facilitator
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
