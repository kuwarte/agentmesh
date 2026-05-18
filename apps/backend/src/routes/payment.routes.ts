import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { blockchainService } from "../services/blockchain.service";

const router = Router();

/**
 * GET /payment/nonce
 * Generates a fresh payment nonce + deadline
 */
router.get("/nonce", (_req: Request, res: Response) => {
	const nonce = ethers.hexlify(ethers.randomBytes(32));
	const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 min

	res.json({
		success: true,
		nonce,
		deadline,
	});
});

/**
 * POST /payment/verify
 * Pre-flight verification before hitting paid API
 */
router.post("/verify", async (req: Request, res: Response) => {
	try {
		const { provider, amount, nonce, deadline, signature } = req.body;

		if (!provider || !amount || !nonce || !deadline || !signature) {
			return res.status(400).json({
				success: false,
				error: "Missing payment fields",
			});
		}

		const result = blockchainService.verifyPayment({
			provider,
			amount: BigInt(amount),
			nonce,
			deadline: Number(deadline),
			signature,
		});

		return res.json({
			success: true,
			valid: result.valid,
			reason: result.reason,
		});
	} catch (err: any) {
		return res.status(500).json({
			success: false,
			error: err.message,
		});
	}
});

/**
 * GET /payment/balance/:address
 * Check USDC balance on-chain (or mock mode)
 */
router.get("/balance/:address", async (req: Request, res: Response) => {
	try {
		const balance = await blockchainService.getUSDCBalance(req.params.address as string);

		res.json({
			success: true,
			address: req.params.address,
			usdcBalance: balance,
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: err.message,
		});
	}
});

/**
 * GET /payment/status
 * System health check for payment layer
 */
router.get("/status", (_req: Request, res: Response) => {
	res.json({
		success: true,
		chainConnected: blockchainService.isReady(),
		facilitator: process.env.X402_FACILITATOR_ADDRESS || "not set",
		network: process.env.CHAIN_NAME || "morphl2",
		mode: process.env.FOUNDRY_MODE || "local",
	});
});

export default router;
