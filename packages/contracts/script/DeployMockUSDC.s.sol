// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal mock USDC for local anvil testing
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract DeployMockUSDC is Script {
    function run() external {
        address mintTo = vm.envAddress("MINT_TO");

        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        // mint 10,000 USDC to the agent wallet for testing
        usdc.mint(mintTo, 10_000 * 1e6);

        vm.stopBroadcast();

        console.log("MockUSDC :", address(usdc));
        console.log("Minted 10,000 USDC to", mintTo);
    }
}
