// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title X402PaymentFacilitator
 * @author Defi-nitely Broke
 * @notice Facilitates x402 payments from AI agents to API providers
 * @dev Implements signature-based payment authorization with replay protection
 * 
 * x402 Protocol Overview:
 * - Agent signs payment intent off-chain
 * - Gateway validates signature and settles on-chain
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
 * 1. Agent signs payment message with wallet
 * 2. Gateway calls settle() with signature
 * 3. Contract verifies signature matches payer
 * 4. Transfers USDC to provider (minus fee)
 * 5. Transfers fee to treasury
 */
contract X402PaymentFacilitator {
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
    /// @dev Mapping from nonce hash to boolean (true = used)
    mapping(bytes32 => bool) public usedNonces;

    /**
     * @notice Emitted when a payment is successfully settled
     * @param payer Agent wallet that paid
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
     * @notice Initialize the payment router
     * @param _usdc USDC token address on Morph L2
     * @param _treasury Treasury address for collecting fees
     * 
     * Requirements:
     * - USDC address must not be zero
     * - Treasury address must not be zero
     */
    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * @notice Settle an x402 payment from agent to provider
     * @dev Verifies signature, prevents replay, transfers USDC
     * 
     * @param provider API provider receiving payment
     * @param amount Total payment in USDC (6 decimals, e.g., 10000 = $0.01)
     * @param nonce Unique identifier for this payment (prevents replay)
     * @param deadline Unix timestamp when signature expires
     * @param signature ECDSA signature from payer authorizing payment
     * @return bool True if payment succeeded
     * 
     * Requirements:
     * - Current time < deadline
     * - Nonce not previously used
     * - Amount > 0
     * - Provider address valid
     * - Signature must be from msg.sender (payer)
     * - Payer must have approved router for USDC
     * - Payer must have sufficient USDC balance
     */
    function settle(
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

        usedNonces[nonce] = true;

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(this), 
                msg.sender,    
                provider,       
                amount,         
                nonce,         
                deadline       
            )
        );

        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        address signer = ethSignedHash.recover(signature);

        require(signer == msg.sender, "Invalid signature");

        uint256 fee = (amount * feeBps) / 10000;
        uint256 providerAmount = amount - fee;

        require(
            usdc.transferFrom(msg.sender, provider, providerAmount),
            "Provider payment failed"
        );

        if (fee > 0) {
            require(
                usdc.transferFrom(msg.sender, treasury, fee),
                "Fee payment failed"
            );
        }

        emit PaymentSettled(msg.sender, provider, amount, fee, nonce);
        return true;
    }

    /**
     * @notice Update platform fee (treasury only)
     * @param newFeeBps New fee in basis points (100 = 1%)
     * 
     * Requirements:
     * - Caller must be treasury
     * - Fee must be <= 500 (5% max)
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
     * 
     * Requirements:
     * - Caller must be current treasury
     * - New treasury must not be zero address
     */
    function setTreasury(address newTreasury) external {
        require(msg.sender == treasury, "Only treasury");
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
}
