// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402Facilitator.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
	constructor() ERC20("Mock USDC", "USDC") {}

	function mint(address to, uint256 amount) external {
		_mint(to, amount);
	}
}

contract X402FacilitatorTest is Test {
	X402Facilitator facilitator;
	MockUSDC usdc;

	address payer = address(1);
	address provider = address(2);
	address treasury = address(3);

	function setUp() public {
		usdc = new MockUSDC();
		facilitator = new X402Facilitator(address(usdc), treasury);

		usdc.mint(payer, 1000 ether);

		vm.prank(payer);
		usdc.approve(address(facilitator), 1000 ether);
	}

	function testSettlePayment() public {
		uint256 amount = 100 ether;
		bytes32 nonce = keccak256("nonce1");
		uint256 deadline = block.timestamp + 1000;

		vm.prank(address(this));

		facilitator.settle(payer, provider, amount, nonce, deadline, "");

		uint256 fee = (amount * 100) / 10000;
		uint256 providerAmount = amount - fee;

		assertEq(usdc.balanceOf(provider), providerAmount);
		assertEq(usdc.balanceOf(treasury), fee);
	}

	function testReplayAttackFails() public {
		uint256 amount = 100 ether;
		bytes32 nonce = keccak256("nonce2");
		uint256 deadline = block.timestamp + 1000;

		facilitator.settle(payer, provider, amount, nonce, deadline, "");

		vm.expectRevert("Replay attack detected");

		facilitator.settle(payer, provider, amount, nonce, deadline, "");
	}
}
