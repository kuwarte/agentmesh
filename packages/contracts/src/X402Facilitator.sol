// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract X402Facilitator {
	IERC20 public usdc;

	address public treasury;
	uint256 public feeBps = 100; // 1%

	mapping(bytes32 => bool) public usedNonces;

	event PaymentSettled(
		address indexed payer,
		address indexed provider,
		uint256 amount,
		uint256 fee,
		bytes32 nonce
	);

	constructor(address _usdc, address _treasury) {
		usdc = IERC20(_usdc);
		treasury = _treasury;
	}

	function settle(
		address payer,
		address provider,
		uint256 amount,
		bytes32 nonce,
		uint256 deadline,
		bytes calldata /* signedAuthorization */
	) external returns (bool) {
		require(block.timestamp <= deadline, "Expired payment");

		require(!usedNonces[nonce], "Replay attack detected");
		require(amount > 0, "Invalid amount");
		require(payer != address(0) && provider != address(0), "Invalid addresses");

		usedNonces[nonce] = true;

		uint256 fee = (amount * feeBps) / 10000;
		uint256 providerAmount = amount - fee;

		require(usdc.transferFrom(payer, provider, providerAmount), "Provider transfer failed");

		if (fee > 0) {
			require(usdc.transferFrom(payer, treasury, fee), "Fee transfer failed");
		}

		emit PaymentSettled(payer, provider, amount, fee, nonce);

		return true;
	}
}
