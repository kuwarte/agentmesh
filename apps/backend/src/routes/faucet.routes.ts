/**
 * faucet.routes.ts
 *
 * MockUSDC faucet endpoints — testnet only.
 * Calls mint() on the MockUSDC contract on behalf of the requester.
 *
 * The MockUSDC contract enforces:
 *   - 1000 USDC per mint
 *   - 1 hour cooldown per wallet
 *   - Max supply cap
 *
 * GET  /faucet/status/:address  — check cooldown and balance for a wallet
 * POST /faucet/mint             — mint 1000 MockUSDC to a wallet
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import MockUSDC from "../abis/MockUSDC.json";

const router = Router();
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

function getUsdcContract(withSigner = false) {
	const rpcProvider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
	if (withSigner) {
		const signer = new ethers.Wallet(process.env.GATEWAY_PRIVATE_KEY!, rpcProvider);
		return new ethers.Contract(process.env.USDC_ADDRESS!, MockUSDC.abi, signer);
	}
	return new ethers.Contract(process.env.USDC_ADDRESS!, MockUSDC.abi, rpcProvider);
}

// ---------------------------------------------------------------------------
// GET /faucet/status/:address
// Check faucet eligibility, cooldown, and current balance for a wallet.
//
// Response:
//   eligible        — true if wallet can mint now
//   cooldownSeconds — seconds until next mint (0 if eligible)
//   usdcBalance     — current USDC balance (human-readable)
//   faucetAmount    — how much will be minted (human-readable)
// ---------------------------------------------------------------------------
router.get("/status/:address", async (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);

		if (!ethers.isAddress(address)) {
			return res.status(400).json({ success: false, error: "Invalid address" });
		}

		const usdc = getUsdcContract();

		const [balance, decimals, cooldown, faucetAmount] = await Promise.all([
			usdc.balanceOf(address),
			usdc.decimals(),
			usdc.cooldownRemaining(address),
			usdc.FAUCET_AMOUNT(),
		]);

		const cooldownSeconds = Number(cooldown);

		res.json({
			success:        true,
			address,
			eligible:       cooldownSeconds === 0,
			cooldownSeconds,
			cooldownMinutes: Math.ceil(cooldownSeconds / 60),
			usdcBalance:    ethers.formatUnits(balance, decimals),
			faucetAmount:   ethers.formatUnits(faucetAmount, decimals),
			network:        process.env.CHAIN_NAME || "morph_hoodi",
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// POST /faucet/mint
// Mint 1000 MockUSDC to the specified wallet.
// The gateway wallet calls mint() on behalf of the user.
//
// Body: { address: "0x..." }
//
// Response:
//   txHash      — on-chain transaction hash
//   explorerUrl — link to Morph Hoodi explorer
//   amount      — amount minted (human-readable)
//   address     — wallet that received the tokens
// ---------------------------------------------------------------------------
router.post("/mint", async (req: Request, res: Response) => {
	try {
		const { address } = req.body;

		if (!address || !ethers.isAddress(address)) {
			return res.status(400).json({
				success: false,
				error:   "Required: address (valid Ethereum address)",
			});
		}

		// Check cooldown before attempting tx (saves gas on revert)
		const usdcRead    = getUsdcContract();
		const cooldown    = await usdcRead.cooldownRemaining(address);
		const cooldownSec = Number(cooldown);

		if (cooldownSec > 0) {
			return res.status(429).json({
				success:         false,
				error:           "Cooldown active — wallet must wait before minting again",
				cooldownSeconds: cooldownSec,
				cooldownMinutes: Math.ceil(cooldownSec / 60),
			});
		}

		// MockUSDC.mint() mints to msg.sender (the gateway wallet).
		// After minting, transfer the tokens to the requested address.
		const usdcWrite = getUsdcContract(true);
		const faucetAmt = await usdcRead.FAUCET_AMOUNT();
		const decimals  = await usdcRead.decimals();

		// Step 1: mint to gateway
		const mintTx = await usdcWrite.mint();
		await mintTx.wait();

		// Step 2: transfer from gateway to user
		const transferTx      = await usdcWrite.transfer(address, faucetAmt);
		const transferReceipt = await transferTx.wait();

		res.json({
			success:     true,
			address,
			amount:      ethers.formatUnits(faucetAmt, decimals),
			txHash:      transferReceipt.hash,
			explorerUrl: `https://explorer-hoodi.morphl2.io/tx/${transferReceipt.hash}`,
			network:     process.env.CHAIN_NAME || "morph_hoodi",
		});
	} catch (err: any) {
		// Contract revert messages (cooldown, max supply) come through here
		const reason = err.reason || err.message || "Mint failed";
		res.status(500).json({ success: false, error: reason });
	}
});

export default router;
