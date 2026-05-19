import { Request, Response, NextFunction } from "express";
import { blockchainService, PaymentPayload } from "../services/blockchain.service";
import { nonceService } from "../services/nonce.service";
import { ledgerService } from "../services/ledger.service";

declare global {
	namespace Express {
		interface Request {
			paymentPayload?: PaymentPayload;
			apiPrice?: bigint;
			apiId?: string;
			apiName?: string;
		}
	}
}

const EXPLORER = "https://explorer-hoodi.morphl2.io/tx";

function build402(priceRaw: bigint, provider: string) {
	return {
		error: "Payment Required",
		scheme: "x402",
		payment: {
			currency: "USDC",
			amount: priceRaw.toString(),
			amountUsd: (Number(priceRaw) / 1_000_000).toFixed(6),
			provider,
			decimals: 6,
			facilitator: process.env.X402_FACILITATOR_ADDRESS,
			network: process.env.CHAIN_NAME || "morph_hoodi",
		},
	};
}

export function requirePayment(
	priceRaw: bigint,
	provider: string,
	apiId: string = "",
	apiName: string = ""
) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const payer        = req.headers["x-payment-payer"]     as string;
		const providerHdr  = req.headers["x-payment-provider"]  as string;
		const amount       = req.headers["x-payment-amount"]    as string;
		const nonce        = req.headers["x-payment-nonce"]     as string;
		const deadline     = req.headers["x-payment-deadline"]  as string;
		const signature    = req.headers["x-payment-signature"] as string;

		// No payment headers → return 402 with full payment requirements
		if (!payer || !providerHdr || !amount || !nonce || !deadline || !signature) {
			return res.status(402).json(build402(priceRaw, provider));
		}

		const amountBig  = BigInt(amount);
		const deadlineNum = Number(deadline);

		if (amountBig < priceRaw) {
			return res.status(402).json({
				error: "Underpayment",
				required: priceRaw.toString(),
				provided: amount,
			});
		}

		if (nonceService.has(nonce)) {
			return res.status(402).json({ error: "Nonce already used" });
		}

		const payload: PaymentPayload = {
			payer,
			provider: providerHdr,
			amount: amountBig,
			nonce: nonce as `0x${string}`,
			deadline: deadlineNum,
			signature,
		};

		const result = blockchainService.verifyPayment(payload);
		if (!result.valid) {
			return res.status(402).json({ error: "Invalid payment", reason: result.reason });
		}

		const ok = nonceService.consume(nonce, providerHdr, amount);
		if (!ok) {
			return res.status(402).json({ error: "Nonce race condition" });
		}

		req.paymentPayload = payload;
		req.apiPrice       = priceRaw;
		req.apiId          = apiId;
		req.apiName        = apiName;

		// Settle on-chain after response is sent, then record in ledger
		res.on("finish", () => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				blockchainService.settlePayment(payload).then((settlement) => {
					if (settlement.success && settlement.txHash) {
						const fee = (amountBig * 100n) / 10000n; // 1%
						ledgerService.record({
							txHash:      settlement.txHash,
							apiId,
							apiName,
							payer,
							provider:    providerHdr,
							amount:      amount,
							amountUsd:   (Number(amountBig) / 1_000_000).toFixed(6),
							fee:         fee.toString(),
							nonce,
							timestamp:   Date.now(),
							explorerUrl: `${EXPLORER}/${settlement.txHash}`,
						});
						console.log(`[x402] settled txHash=${settlement.txHash}`);
					} else {
						console.error("[x402] settlement failed:", settlement.error);
					}
				}).catch((err) => {
					console.error("[x402] settlement error:", err);
				});
			}
		});

		next();
	};
}
