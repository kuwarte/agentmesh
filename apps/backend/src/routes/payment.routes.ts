/**
 * payment.routes.ts
 *
 * Payment utility endpoints — used by agents and the frontend before/after
 * making paid API calls.
 *
 * GET  /payment/nonce            — generate a fresh nonce + deadline
 * POST /payment/verify           — pre-flight signature check
 * GET  /payment/balance/:address — USDC balance for any wallet
 * GET  /payment/status           — payment layer health check
 */

import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { blockchainService } from "../services/blockchain.service";

const router = Router();
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// GET /payment/nonce
// Returns a cryptographically random nonce and a 5-minute deadline.
// Agents call this before signing a payment authorization.
//
// Response: { success, nonce, deadline }
//   nonce    — 32-byte hex string (0x-prefixed)
//   deadline — unix timestamp (seconds), expires in 5 minutes
// ---------------------------------------------------------------------------
router.get("/nonce", (_req: Request, res: Response) => {
	const nonce    = ethers.hexlify(ethers.randomBytes(32));
	const deadline = Math.floor(Date.now() / 1000) + 60 * 5;

	res.json({ success: true, nonce, deadline });
});

// ---------------------------------------------------------------------------
// POST /payment/verify
// Pre-flight signature verification — call this before hitting a paid endpoint
// to confirm the signature is valid without spending a nonce.
//
// Body: { payer, provider, amount, nonce, deadline, signature }
//   payer     — agent wallet address that signed
//   provider  — provider wallet address
//   amount    — USDC raw units (6 decimals), e.g. "1000" = $0.001
//   nonce     — 0x-prefixed 32-byte hex from GET /payment/nonce
//   deadline  — unix timestamp from GET /payment/nonce
//   signature — ECDSA signature over (facilitator, payer, provider, amount, nonce, deadline)
//
// Response: { success, valid, reason? }
// ---------------------------------------------------------------------------
router.post("/verify", async (req: Request, res: Response) => {
	try {
		const { payer, provider, amount, nonce, deadline, signature } = req.body;

		if (!payer || !provider || !amount || !nonce || !deadline || !signature) {
			return res.status(400).json({
				success: false,
				error:   "Required fields: payer, provider, amount, nonce, deadline, signature",
			});
		}

		const result = blockchainService.verifyPayment({
			payer,
			provider,
			amount:   BigInt(amount),
			nonce,
			deadline: Number(deadline),
			signature,
		});

		return res.json({ success: true, valid: result.valid, reason: result.reason ?? null });
	} catch (err: any) {
		return res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /payment/balance/:address
// Returns the USDC balance for any wallet address.
// Useful for the dashboard and provider portal wallet display.
//
// Response: { success, address, usdcBalance }
//   usdcBalance — human-readable string, e.g. "10.000000"
// ---------------------------------------------------------------------------
router.get("/balance/:address", async (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);
		const balance = await blockchainService.getUSDCBalance(address);

		res.json({ success: true, address, usdcBalance: balance });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /payment/status
// Payment layer health check — chain connection, contract addresses, network.
//
// Response: { success, chainConnected, facilitator, network, explorer }
// ---------------------------------------------------------------------------
router.get("/status", (_req: Request, res: Response) => {
	res.json({
		success:        true,
		chainConnected: blockchainService.isReady(),
		facilitator:    process.env.X402_FACILITATOR_ADDRESS || "not set",
		network:        process.env.CHAIN_NAME || "morph_hoodi",
		explorer:       "https://explorer-hoodi.morphl2.io",
	});
});

export default router;
