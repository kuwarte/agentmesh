// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/APIRegistry.sol";

contract APIRegistryTest is Test {
	APIRegistry registry;

	address provider = address(1);

	function setUp() public {
		registry = new APIRegistry();
	}

	function testRegisterAPI() public {
		vm.prank(provider);

		bytes32 id = registry.registerAPI("BTC API", "https://api.example.com/btc", 1000);

		APIRegistry.API memory api = registry.getAPI(id);

		assertEq(api.provider, provider);
		assertEq(api.name, "BTC API");
		assertEq(api.pricePerCall, 1000);
		assertTrue(api.active);
	}

	function testUpdateAPI() public {
		vm.prank(provider);

		bytes32 id = registry.registerAPI("ETH API", "https://api.example.com/eth", 2000);

		vm.prank(provider);
		registry.updateAPI(id, 5000, false);

		APIRegistry.API memory api = registry.getAPI(id);

		assertEq(api.pricePerCall, 5000);
		assertFalse(api.active);
	}
}
