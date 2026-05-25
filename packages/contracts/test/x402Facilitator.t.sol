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

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract X402FacilitatorTest is Test {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    X402Facilitator facilitator;
    MockUSDC usdc;

    // gateway is a separate wallet — simulates the backend calling settle()
    address gateway = address(0xD4);
    address provider = address(0xB2);
    address treasury = address(0xC3);

    uint256 payerPrivateKey = 0xA11CE;
    address payer;

    // Dummy apiId for tests — bytes32(0) is valid (unknown API)
    bytes32 constant TEST_API_ID = bytes32(0);

    function setUp() public {
        usdc = new MockUSDC();
        facilitator = new X402Facilitator(address(usdc), treasury);

        payer = vm.addr(payerPrivateKey);

        usdc.mint(payer, 10_000 * 1e6);

        // payer approves facilitator (agent does this once)
        vm.prank(payer);
        usdc.approve(address(facilitator), type(uint256).max);
    }

    /// @notice Helper: build the message hash the agent signs
    function _buildMessageHash(
        address _payer,
        address _provider,
        uint256 _amount,
        bytes32 _nonce,
        uint256 _deadline
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(address(facilitator), _payer, _provider, _amount, _nonce, _deadline)
        ).toEthSignedMessageHash();
    }

    /// @notice Gateway settles on behalf of agent — core autonomous flow
    function testGatewaySettlesOnBehalfOfAgent() public {
        uint256 amount = 1000; // 0.001 USDC
        bytes32 nonce = keccak256("nonce1");
        uint256 deadline = block.timestamp + 300;

        // Agent signs off-chain
        bytes32 msgHash = _buildMessageHash(payer, provider, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, msgHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        uint256 providerBefore = usdc.balanceOf(provider);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        // Gateway (not payer) calls settle — this is the key Option B behavior
        vm.prank(gateway);
        bool ok = facilitator.settle(payer, provider, amount, nonce, deadline, TEST_API_ID, signature);

        assertTrue(ok);

        uint256 fee = (amount * 100) / 10000; // 1%
        assertEq(usdc.balanceOf(provider), providerBefore + amount - fee);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + fee);
    }

    /// @notice Replay attack must fail
    function testReplayAttackFails() public {
        uint256 amount = 1000;
        bytes32 nonce = keccak256("nonce2");
        uint256 deadline = block.timestamp + 300;

        bytes32 msgHash = _buildMessageHash(payer, provider, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, msgHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(gateway);
        facilitator.settle(payer, provider, amount, nonce, deadline, TEST_API_ID, signature);

        vm.expectRevert("Nonce used");
        vm.prank(gateway);
        facilitator.settle(payer, provider, amount, nonce, deadline, TEST_API_ID, signature);
    }

    /// @notice Wrong signer must fail
    function testWrongSignerFails() public {
        uint256 amount = 1000;
        bytes32 nonce = keccak256("nonce3");
        uint256 deadline = block.timestamp + 300;

        // Sign with a different key
        uint256 wrongKey = 0xBAD;
        bytes32 msgHash = _buildMessageHash(payer, provider, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, msgHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid signature");
        vm.prank(gateway);
        facilitator.settle(payer, provider, amount, nonce, deadline, TEST_API_ID, signature);
    }

    /// @notice Expired deadline must fail
    function testExpiredDeadlineFails() public {
        uint256 amount = 1000;
        bytes32 nonce = keccak256("nonce4");
        uint256 deadline = block.timestamp - 1; // already expired

        bytes32 msgHash = _buildMessageHash(payer, provider, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, msgHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.expectRevert("Expired");
        vm.prank(gateway);
        facilitator.settle(payer, provider, amount, nonce, deadline, TEST_API_ID, signature);
    }

    /// @notice apiId is emitted in PaymentSettled event
    function testApiIdEmittedInEvent() public {
        uint256 amount = 1000;
        bytes32 nonce = keccak256("nonce5");
        uint256 deadline = block.timestamp + 300;
        bytes32 apiId = keccak256("some-api-id");

        bytes32 msgHash = _buildMessageHash(payer, provider, amount, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPrivateKey, msgHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        uint256 fee = (amount * 100) / 10000;

        vm.expectEmit(true, true, false, true);
        emit X402Facilitator.PaymentSettled(payer, provider, amount, fee, nonce, apiId);

        vm.prank(gateway);
        facilitator.settle(payer, provider, amount, nonce, deadline, apiId, signature);
    }
}
