// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for Morph Hoodi testnet
 * @dev Permissionless faucet with cooldown — no backend required
 *
 * Features:
 *   - 6 decimals (matches real USDC)
 *   - Anyone calls mint() to receive 1000 USDC
 *   - 1 hour cooldown per wallet (prevents drain)
 *   - Max supply cap (1 billion USDC)
 *   - cooldownRemaining() for frontend countdown timers
 *   - FaucetMint event for on-chain history
 */
contract MockUSDC is ERC20 {
    /// @notice Amount minted per faucet request (1000 USDC)
    uint256 public constant FAUCET_AMOUNT = 1000 * 1e6;

    /// @notice Cooldown between faucet claims per wallet
    uint256 public constant COOLDOWN = 1 hours;

    /// @notice Maximum total supply (1 billion USDC)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e6;

    /// @notice Tracks last faucet mint timestamp per wallet
    mapping(address => uint256) public lastMintAt;

    /// @notice Emitted on every successful faucet mint
    event FaucetMint(address indexed user, uint256 amount, uint256 timestamp);

    constructor() ERC20("Mock USDC", "USDC") {}

    /**
     * @notice Mint 1000 USDC to caller
     * @dev Enforces 1-hour cooldown per wallet and max supply cap
     */
    function mint() external {
        require(
            block.timestamp >= lastMintAt[msg.sender] + COOLDOWN,
            "Cooldown active"
        );
        require(
            totalSupply() + FAUCET_AMOUNT <= MAX_SUPPLY,
            "Max supply reached"
        );

        lastMintAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit FaucetMint(msg.sender, FAUCET_AMOUNT, block.timestamp);
    }

    /**
     * @notice Returns seconds until wallet can mint again (0 if eligible)
     * @dev Used by frontend for countdown timers
     */
    function cooldownRemaining(address user) external view returns (uint256) {
        uint256 nextMint = lastMintAt[user] + COOLDOWN;
        if (block.timestamp >= nextMint) return 0;
        return nextMint - block.timestamp;
    }

    /// @notice 6 decimals to match real USDC
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
