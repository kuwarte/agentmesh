// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockUSDC.sol";

/**
 * @notice Deploys MockUSDC to Morph Hoodi testnet
 */
contract DeployMockUSDC is Script {
	function run() external {
		vm.startBroadcast();

		MockUSDC usdc = new MockUSDC();

		vm.stopBroadcast();

		console.log("=== MockUSDC Deployed ===");
		console.log("Address      :", address(usdc));
		console.log("Decimals     :", usdc.decimals());
		console.log("Faucet amount:", usdc.FAUCET_AMOUNT(), "raw units (1000 USDC)");
		console.log("Cooldown     :", usdc.COOLDOWN(), "seconds (1 hour)");
		console.log("");
		console.log("Set in apps/backend/.env:");
		console.log("USDC_ADDRESS=", address(usdc));
	}
}
