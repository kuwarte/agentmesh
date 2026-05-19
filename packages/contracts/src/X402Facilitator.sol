// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title X402Facilitator
 * @author Defi-nitely Broke
 * @notice Facilitates x402 payments from AI agents to API providers
 * @dev Implements signature-based payment authorization with replay protection
 *
 * x402 Protocol Overview:
 * - Agent signs payment intent off-chain
 * - Gateway calls settle() on behalf of the agent (Option B architecture)
 * - Contract verifies the signature came from `payer`, not msg.sender
 * - This allows autonomous gateway-mediated settlement with no human loop
 * - Prevents replay attacks via nonce tracking
 * - Charges platform fee (default 1%)
 *
 * Security Features:
 * - ECDSA signature verification (prevents unauthorized payments)
 * - Nonce-based replay protection
 * - Deadline enforcement (prevents stale transactions)
 * - Reentrancy protection (nonce marked before transfers)
 *
 * Payment Flow:
 * 1. Agent signs payment message with its wallet (off-chain)
 * 2. Agent sends signed headers to the gateway API
 * 3. Gateway verifies signature, serves the API response
 * 4. Gateway calls settle(payer, ...) on-chain
 * 5. Contract verifies signature matches payer address
 * 6. Transfers USDC from payer to provider (minus fee)
 * 7. Transfers fee to treasury
 */
contract X402Facilitator {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    /// @notice USDC token contract (immutable for gas savings)
    IERC20 public immutable usdc;

    /// @notice Treasury address receiving platform fees
    address public treasury;

    /// @notice Platform fee in basis points (100 = 1%)
    /// @dev Max 500 (5%) enforced in setFeeBps()
    uint256 public feeBps = 100;

    /// @notice Tracks used nonces to prevent replay attacks
    /// @dev Mapping from nonce to boolean (true = used)
    mapping(bytes32 => bool) public usedNonces;

    /**
     * @notice Emitted when a payment is successfully settled
     * @param payer Agent wallet that authorized and paid
     * @param provider API provider receiving payment
     * @param amount Total payment amount (before fee)
     * @param fee Platform fee charged
     * @param nonce Unique nonce for this payment
     */
    event PaymentSettled(
        address indexed payer,
        address indexed provider,
        uint256 amount,
        uint256 fee,
        bytes32 nonce
    );

    /**
     * @notice Emitted when platform fee is updated
     * @param newFeeBps New fee in basis points
     */
    event FeeUpdated(uint256 newFeeBps);

    /**
     * @notice Initialize the payment facilitator
     * @param _usdc USDC token address on Morph L2
     * @param _treasury Treasury address for collecting fees
     */
    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * @notice Settle an x402 payment on behalf of an agent
     * @dev Gateway calls this after verifying the agent's signature off-chain.
     *      The signature is verified against `payer`, not msg.sender, so the
     *      gateway wallet can submit the transaction autonomously.
     *
     * @param payer   Agent wallet that signed the payment authorization
     * @param provider API provider receiving payment
     * @param amount  Total payment in USDC (6 decimals, e.g., 1000 = $0.001)
     * @param nonce   Unique identifier for this payment (prevents replay)
     * @param deadline Unix timestamp when the authorization expires
     * @param signature ECDSA signature from payer over (facilitator, payer, provider, amount, nonce, deadline)
     * @return bool True if payment succeeded
     *
     * Requirements:
     * - Current time <= deadline
     * - Nonce not previously used
     * - Amount > 0
     * - Provider address valid
     * - Signature must recover to payer address
     * - Payer must have approved this contract for USDC
     * - Payer must have sufficient USDC balance
     */
    function settle(
        address payer,
        address provider,
        uint256 amount,
        bytes32 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external returns (bool) {
        require(block.timestamp <= deadline, "Expired");
        require(!usedNonces[nonce], "Nonce used");
        require(amount > 0, "Invalid amount");
        require(provider != address(0), "Invalid provider");
        require(payer != address(0), "Invalid payer");

        // Mark nonce used before transfers (reentrancy protection)
        usedNonces[nonce] = true;

        // Reconstruct the message the agent signed:
        // keccak256(abi.encodePacked(facilitator, payer, provider, amount, nonce, deadline))
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(this),
                payer,
                provider,
                amount,
                nonce,
                deadline
            )
        );

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        // Verify signature came from the declared payer, not msg.sender
        require(signer == payer, "Invalid signature");

        uint256 fee = (amount * feeBps) / 10000;
        uint256 providerAmount = amount - fee;

        // Pull USDC from payer (agent must have approved this contract)
        require(
            usdc.transferFrom(payer, provider, providerAmount),
            "Provider payment failed"
        );

        if (fee > 0) {
            require(
                usdc.transferFrom(payer, treasury, fee),
                "Fee payment failed"
            );
        }

        emit PaymentSettled(payer, provider, amount, fee, nonce);
        return true;
    }

    /**
     * @notice Update platform fee (treasury only)
     * @param newFeeBps New fee in basis points (100 = 1%, max 500 = 5%)
     */
    function setFeeBps(uint256 newFeeBps) external {
        require(msg.sender == treasury, "Only treasury");
        require(newFeeBps <= 500, "Fee too high");
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    /**
     * @notice Update treasury address (treasury only)
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external {
        require(msg.sender == treasury, "Only treasury");
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
}
