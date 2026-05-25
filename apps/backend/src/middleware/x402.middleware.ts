/**
 * x402.middleware.ts
 *
 * Payment-as-authentication middleware for the x402 protocol.
 *
 * Protocol:
 *   - No payment headers → 402 with payment requirements
 *   - Agent sends single X-Payment header (base64-encoded JSON)
 *   - Middleware verifies signature, consumes nonce, serves response
 *   - After response: settles on-chain via X402Facilitator.settle()
 *
 * X-Payment header format (base64-encoded JSON):
 *   {
 *     "payer":     "0x...",   // agent wallet address
 *     "provider":  "0x...",   // provider wallet address
 *     "amount":    "1000",    // USDC raw units (6 decimals)
 *     "nonce":     "0x...",   // 32-byte hex from GET /payment/nonce
 *     "deadline":  1234567890, // unix timestamp (seconds)
 *     "signature": "0x..."    // ECDSA signature
 *   }
 */

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

// ---------------------------------------------------------------------------
// Parse X-Payment header
// Accepts base64-encoded JSON (standard) or falls back to legacy
// individual x-payment-* headers for backward compatibility.
// ---------------------------------------------------------------------------
interface ParsedPayment {
	payer: string;
	provider: string;
	amount: string;
	nonce: string;
	deadline: string;
	signature: string;
}

function parsePaymentHeader(req: Request): ParsedPayment | null {
	// Standard: single X-Payment header (base64 JSON)
	const xPayment = req.headers["x-payment"] as string;
	if (xPayment) {
		try {
			const decoded = Buffer.from(xPayment, "base64").toString("utf8");
			const parsed  = JSON.parse(decoded);
			if (
				parsed.payer && parsed.provider && parsed.amount &&
				parsed.nonce && parsed.deadline && parsed.signature
			) {
				return {
					payer:     parsed.payer,
					provider:  parsed.provider,
					amount:    String(parsed.amount),
					nonce:     parsed.nonce,
					deadline:  String(parsed.deadline),
					signature: parsed.signature,
				};
			}
		} catch {
			return null; // malformed base64 or JSON
		}
	}

	// Legacy fallback: individual x-payment-* headers
	const payer     = req.headers["x-payment-payer"]     as string;
	const provider  = req.headers["x-payment-provider"]  as string;
	const amount    = req.headers["x-payment-amount"]    as string;
	const nonce     = req.headers["x-payment-nonce"]     as string;
	const deadline  = req.headers["x-payment-deadline"]  as string;
	const signature = req.headers["x-payment-signature"] as string;

	if (payer && provider && amount && nonce && deadline && signature) {
		return { payer, provider, amount, nonce, deadline, signature };
	}

	return null;
}

// ---------------------------------------------------------------------------
// 402 response body — tells the agent exactly what to sign and send
// ---------------------------------------------------------------------------
function build402(priceRaw: bigint, provider: string) {
	return {
		error:  "Payment Required",
		scheme: "x402",
		payment: {
			currency:    "USDC",
			amount:      priceRaw.toString(),
			amountUsd:   (Number(priceRaw) / 1_000_000).toFixed(6),
			provider,
			decimals:    6,
			facilitator: process.env.X402_FACILITATOR_ADDRESS,
			network:     process.env.CHAIN_NAME || "morph_hoodi",
			chainId:     blockchainService.getChainId(),
		},
		// How to construct the X-Payment header:
		instructions: {
			header:  "X-Payment",
			format:  "base64(JSON({ payer, provider, amount, nonce, deadline, signature }))",
			nonceUrl: "/payment/nonce",
			signMessage: "keccak256(abi.encodePacked(facilitator, payer, provider, amount, nonce, deadline))",
		},
	};
}

// ---------------------------------------------------------------------------
// requirePayment middleware factory
// ---------------------------------------------------------------------------
export function requirePayment(
	priceRaw: bigint,
	provider: string,
	apiId:    string = "",
	apiName:  string = ""
) {
	return async (req: Request, res: Response, next: NextFunction) => {
		const parsed = parsePaymentHeader(req);

		// No payment header → return 402 with full instructions
		if (!parsed) {
			return res.status(402).json(build402(priceRaw, provider));
		}

		const { payer, provider: providerHdr, amount, nonce, deadline, signature } = parsed;
		const amountBig   = BigInt(amount);
		const deadlineNum = Number(deadline);

		if (amountBig < priceRaw) {
			return res.status(402).json({
				error:    "Underpayment",
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
			amount:   amountBig,
			nonce:    nonce as `0x${string}`,
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
				blockchainService.settlePayment({ ...payload, apiId }).then((settlement) => {
					if (settlement.success && settlement.txHash) {
						const fee = (amountBig * 100n) / 10000n;
						ledgerService.record({
							txHash:      settlement.txHash,
							apiId,
							apiName,
							payer,
							provider:    providerHdr,
							amount,
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
