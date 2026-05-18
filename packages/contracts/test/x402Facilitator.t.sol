// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402Facilitator.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract MockUSDC is ERC20 {
	constructor() ERC20("Mock USDC", "USDC") {}

	function mint(address to, uint256 amount) external {
		_mint(to, amount);
	}
}

contract X402FacilitatorTest is Test {
	using ECDSA for bytes32;
	using MessageHashUtils for bytes32;

	X402Facilitator facilitator;
	MockUSDC usdc;

	address payer = address(0xA1);
	address provider = address(0xB2);
	address treasury = address(0xC3);

	uint256 payerPrivateKey = 0xA11CE;

	function setUp() public {
		usdc = new MockUSDC();
		facilitator = new X402Facilitator(address(usdc), treasury);

		payer = vm.addr(payerPrivateKey);

		usdc.mint(payer, 1000 ether);

		vm.prank(payer);
		usdc.approve(address(facilitator), 1000 ether);
	}

	function testSettlePayment() public {
		uint256 amount = 100 ether;
		bytes32 nonce = keccak256("nonce1");
		uint256 deadline = block.timestamp + 1000;

		bytes32 messageHash = keccak256(
			abi.encodePacked(address(facilitator), payer, provider, amount, nonce, deadline)
		).toEthSignedMessageHash();

		(uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, messageHash);
		bytes memory signature = abi.encodePacked(r, s, v);

		vm.prank(payer);

		facilitator.settle(provider, amount, nonce, deadline, signature);

		uint256 fee = (amount * 100) / 10000;
		uint256 providerAmount = amount - fee;

		assertEq(usdc.balanceOf(provider), providerAmount);
		assertEq(usdc.balanceOf(treasury), fee);
	}

	function testReplayAttackFails() public {
		uint256 amount = 100 ether;
		bytes32 nonce = keccak256("nonce2");
		uint256 deadline = block.timestamp + 1000;

		bytes32 messageHash = keccak256(
			abi.encodePacked(address(facilitator), payer, provider, amount, nonce, deadline)
		).toEthSignedMessageHash();

		(uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, messageHash);
		bytes memory signature = abi.encodePacked(r, s, v);

		vm.prank(payer);
		facilitator.settle(provider, amount, nonce, deadline, signature);

		vm.expectRevert("Nonce used");

		vm.prank(payer);
		facilitator.settle(provider, amount, nonce, deadline, signature);
	}
}
