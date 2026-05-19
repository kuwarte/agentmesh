/**
 * api.routes.ts — Paid API endpoints
 *
 * Each endpoint is protected by requirePayment() middleware.
 * Price is read dynamically from the on-chain APIRegistry.
 * Falls back to a hardcoded default if registry is unavailable.
 *
 * Endpoints (all under /api/v1/):
 *   GET /btc      — BTC/USD price
 *   GET /eth      — ETH/USD price
 *   GET /sol      — SOL/USD price
 *   GET /gas      — Ethereum gas prices (fast/standard/slow)
 *   GET /catalog  — List all available paid endpoints with prices
 */

import { Router, Request, Response } from "express";
import { requirePayment } from "../middleware/x402.middleware";
import { blockchainService } from "../services/blockchain.service";

const router = Router();

const PROVIDER = process.env.PROVIDER_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// ---------------------------------------------------------------------------
// Static catalog — defines all paid endpoints.
// pricePerCall is the fallback if the on-chain registry is unavailable.
// apiId is set after registration on-chain (populated at startup).
// ---------------------------------------------------------------------------
interface EndpointMeta {
	path: string;
	name: string;
	description: string;
	pricePerCall: bigint;   // fallback price in USDC raw units (6 decimals)
	apiId: string;          // populated from on-chain registry at startup
}

const ENDPOINTS: Record<string, EndpointMeta> = {
	btc: {
		path:         "/api/v1/btc",
		name:         "BTC Price",
		description:  "Real-time Bitcoin/USD price",
		pricePerCall: 1000n,  // $0.001
		apiId:        "",
	},
	eth: {
		path:         "/api/v1/eth",
		name:         "ETH Price",
		description:  "Real-time Ethereum/USD price",
		pricePerCall: 1000n,
		apiId:        "",
	},
	sol: {
		path:         "/api/v1/sol",
		name:         "SOL Price",
		description:  "Real-time Solana/USD price",
		pricePerCall: 500n,   // $0.0005
		apiId:        "",
	},
	gas: {
		path:         "/api/v1/gas",
		name:         "Gas Tracker",
		description:  "Ethereum gas prices (fast / standard / slow) in gwei",
		pricePerCall: 500n,
		apiId:        "",
	},
};

// ---------------------------------------------------------------------------
// Resolve price from on-chain registry, fall back to static default
// ---------------------------------------------------------------------------
async function resolvePrice(key: string): Promise<bigint> {
	const meta = ENDPOINTS[key];
	if (!meta) return 1000n;

	if (meta.apiId) {
		try {
			const api = await blockchainService.getAPI(meta.apiId);
			if (api && api.active) return BigInt(api.pricePerCall);
		} catch {}
	}

	return meta.pricePerCall;
}

// ---------------------------------------------------------------------------
// GET /api/v1/catalog
// Returns all available paid endpoints with on-chain prices.
// Agents call this first to discover what's available.
// ---------------------------------------------------------------------------
router.get("/catalog", async (_req: Request, res: Response) => {
	const items = await Promise.all(
		Object.entries(ENDPOINTS).map(async ([key, meta]) => {
			const price = await resolvePrice(key);
			return {
				key,
				name:        meta.name,
				description: meta.description,
				endpoint:    meta.path,
				apiId:       meta.apiId || null,
				pricePerCall: price.toString(),
				priceUsd:    (Number(price) / 1_000_000).toFixed(6),
				provider:    PROVIDER,
				currency:    "USDC",
				network:     process.env.CHAIN_NAME || "morph_hoodi",
			};
		})
	);

	res.json({
		success: true,
		count:   items.length,
		catalog: items,
		payment: {
			scheme:      "x402",
			facilitator: process.env.X402_FACILITATOR_ADDRESS,
			nonceUrl:    "/payment/nonce",
			verifyUrl:   "/payment/verify",
		},
	});
});

// ---------------------------------------------------------------------------
// GET /api/v1/btc
// ---------------------------------------------------------------------------
router.get("/btc", async (req: Request, res: Response, next) => {
	const price = await resolvePrice("btc");
	requirePayment(price, PROVIDER, ENDPOINTS.btc.apiId, "BTC Price")(req, res, async () => {
		res.json({
			success: true,
			data: {
				symbol:    "BTC",
				price:     65000 + Math.floor(Math.random() * 2000),
				currency:  "USD",
				timestamp: Date.now(),
			},
			payment: {
				nonce:      req.paymentPayload?.nonce,
				provider:   req.paymentPayload?.provider,
				// txHash is settled async — check /dashboard/:payer for confirmation
			},
		});
	});
});

// ---------------------------------------------------------------------------
// GET /api/v1/eth
// ---------------------------------------------------------------------------
router.get("/eth", async (req: Request, res: Response, next) => {
	const price = await resolvePrice("eth");
	requirePayment(price, PROVIDER, ENDPOINTS.eth.apiId, "ETH Price")(req, res, async () => {
		res.json({
			success: true,
			data: {
				symbol:    "ETH",
				price:     3200 + Math.floor(Math.random() * 200),
				currency:  "USD",
				timestamp: Date.now(),
			},
			payment: {
				nonce:    req.paymentPayload?.nonce,
				provider: req.paymentPayload?.provider,
			},
		});
	});
});

// ---------------------------------------------------------------------------
// GET /api/v1/sol
// ---------------------------------------------------------------------------
router.get("/sol", async (req: Request, res: Response, next) => {
	const price = await resolvePrice("sol");
	requirePayment(price, PROVIDER, ENDPOINTS.sol.apiId, "SOL Price")(req, res, async () => {
		res.json({
			success: true,
			data: {
				symbol:    "SOL",
				price:     140 + Math.floor(Math.random() * 20),
				currency:  "USD",
				timestamp: Date.now(),
			},
			payment: {
				nonce:    req.paymentPayload?.nonce,
				provider: req.paymentPayload?.provider,
			},
		});
	});
});

// ---------------------------------------------------------------------------
// GET /api/v1/gas
// ---------------------------------------------------------------------------
router.get("/gas", async (req: Request, res: Response, next) => {
	const price = await resolvePrice("gas");
	requirePayment(price, PROVIDER, ENDPOINTS.gas.apiId, "Gas Tracker")(req, res, async () => {
		const base = 20 + Math.floor(Math.random() * 30);
		res.json({
			success: true,
			data: {
				network:   "ethereum",
				unit:      "gwei",
				fast:      base + 10,
				standard:  base + 3,
				slow:      base,
				timestamp: Date.now(),
			},
			payment: {
				nonce:    req.paymentPayload?.nonce,
				provider: req.paymentPayload?.provider,
			},
		});
	});
});

export { ENDPOINTS, PROVIDER };
export default router;
