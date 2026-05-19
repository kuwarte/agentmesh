import { Request, Response, NextFunction } from "express";
import { blockchainService, PaymentPayload } from "../services/blockchain.service";
import { nonceService } from "../services/nonce.service";

declare global {
	namespace Express {
		interface Request {
			paymentPayload?: PaymentPayload;
			apiPrice?: bigint;
		}
	}
}

function build402(priceRaw: bigint, provider: string) {
	return {
		error: "Payment Required",
		scheme: "x402",
		payment: {
			currency: "USDC",
			amount: priceRaw.toString(),
			provider,
			decimals: 6,
		},
	};
}

export function requirePayment(priceRaw: bigint, provider: string) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const payer = req.headers["x-payment-payer"] as string;
		const providerHeader = req.headers["x-payment-provider"] as string;
		const amount = req.headers["x-payment-amount"] as string;
		const nonce = req.headers["x-payment-nonce"] as string;
		const deadline = req.headers["x-payment-deadline"] as string;
		const signature = req.headers["x-payment-signature"] as string;

		// missing headers → return 402 with payment requirements
		if (!payer || !providerHeader || !amount || !nonce || !deadline || !signature) {
			return res.status(402).json(build402(priceRaw, provider));
		}

		const amountBig = BigInt(amount);
		const deadlineNum = Number(deadline);

		// underpayment check
		if (amountBig < priceRaw) {
			return res.status(402).json({
				error: "Underpayment",
				required: priceRaw.toString(),
				provided: amount,
			});
		}

		// fast nonce check before doing any crypto
		if (nonceService.has(nonce)) {
			return res.status(402).json({ error: "Nonce already used" });
		}

		const payload: PaymentPayload = {
			payer,
			provider: providerHeader,
			amount: amountBig,
			nonce: nonce as `0x${string}`,
			deadline: deadlineNum,
			signature,
		};

		const result = blockchainService.verifyPayment(payload);

		if (!result.valid) {
			return res.status(402).json({
				error: "Invalid payment",
				reason: result.reason,
			});
		}

		// atomic consume — guards against race conditions
		const ok = nonceService.consume(nonce, providerHeader, amount);
		if (!ok) {
			return res.status(402).json({ error: "Nonce race condition" });
		}

		req.paymentPayload = payload;
		req.apiPrice = priceRaw;

		// settle on-chain after response is sent successfully
		res.on("finish", () => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				blockchainService.settlePayment(payload).catch((err) => {
					console.error("[x402] settlement failed:", err);
				});
			}
		});

		next();
	};
}
