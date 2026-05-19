// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Minimal mock USDC — 6 decimals, freely mintable
 * @dev Used on local anvil and Morph Hoodi testnet (no real USDC bridge needed)
 *
 * Local anvil:
 *   MINT_TO=<addr> forge script script/DeployMockUSDC.s.sol \
 *     --rpc-url http://127.0.0.1:8545 \
 *     --private-key <ANVIL_KEY> \
 *     --broadcast
 *
 * Morph Hoodi testnet:
 *   MINT_TO=<addr> forge script script/DeployMockUSDC.s.sol \
 *     --rpc-url morph_hoodi \
 *     --private-key <YOUR_PRIVATE_KEY> \
 *     --broadcast
 */
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
        // mint 10,000 USDC to the agent/gateway wallet for testing
        usdc.mint(mintTo, 10_000 * 1e6);

        vm.stopBroadcast();

        console.log("MockUSDC :", address(usdc));
        console.log("Minted 10,000 USDC to", mintTo);
        console.log("Set USDC_ADDRESS=", address(usdc), "in your .env");
    }
}
