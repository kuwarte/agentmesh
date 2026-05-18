import { Router, Request, Response } from "express";
import { requirePayment } from "../middleware/x402.middleware";

const router = Router();

const PROVIDER = process.env.PROVIDER_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// price = 0.001 USDC (6 decimals)
const PRICE_BTC = 1000n;

router.get("/btc", requirePayment(PRICE_BTC, PROVIDER), (req: Request, res: Response) => {
	res.json({
		success: true,
		data: {
			symbol: "BTC",
			price: 65000 + Math.floor(Math.random() * 500),
			timestamp: Date.now(),
		},
		payment: {
			nonce: req.paymentPayload?.nonce,
			provider: req.paymentPayload?.provider,
		},
	});
});

export default router;
