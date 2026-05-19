/**
 * api.routes.ts — Paid API endpoints
 *
 * Two types of paid endpoints:
 *
 * 1. Built-in endpoints (/btc, /eth, /sol, /gas)
 *    Hardcoded response logic, prices synced from on-chain registry at startup.
 *
 * 2. Generic proxy route (/call/:apiId)
 *    Looks up any registered API by ID from the on-chain registry,
 *    charges its on-chain price, and proxies the request to the
 *    provider's registered endpoint URL. This is what makes the
 *    marketplace truly open — any provider can register and be callable.
 *
 * Endpoints (all under /api/v1/):
 *   GET /catalog        — list all available APIs with prices
 *   GET /btc            — BTC/USD price (built-in)
 *   GET /eth            — ETH/USD price (built-in)
 *   GET /sol            — SOL/USD price (built-in)
 *   GET /gas            — Ethereum gas prices (built-in)
 *   GET /call/:apiId    — proxy any registered API (dynamic)
 */

import { Router, Request, Response } from "express";
import { requirePayment } from "../middleware/x402.middleware";
import { blockchainService } from "../services/blockchain.service";

const router = Router();

const PROVIDER = process.env.PROVIDER_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// Static catalog — built-in endpoints with fallback prices.
// apiId is populated at startup by syncWithRegistry().
// ---------------------------------------------------------------------------
interface EndpointMeta {
	path: string;
	name: string;
	description: string;
	pricePerCall: bigint;  // fallback price in USDC raw units (6 decimals)
	apiId: string;         // populated from on-chain registry at startup
}

export const ENDPOINTS: Record<string, EndpointMeta> = {
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
// Startup registry sync
//
// Called once from server.ts after blockchainService.init().
// Fetches all on-chain APIs and matches them to built-in endpoints by name.
// Populates apiId so resolvePrice() reads live on-chain prices instead of
// the hardcoded fallbacks.
// ---------------------------------------------------------------------------
export async function syncWithRegistry(): Promise<void> {
	try {
		const onChainAPIs = await blockchainService.getAllAPIs();
		if (!onChainAPIs.length) {
			console.log("[api] registry empty — using fallback prices");
			return;
		}

		let synced = 0;
		for (const api of onChainAPIs) {
			// Match by name (case-insensitive) against built-in endpoint names
			const key = Object.keys(ENDPOINTS).find(
				(k) => ENDPOINTS[k].name.toLowerCase() === api.name.toLowerCase()
			);
			if (key && api.active) {
				ENDPOINTS[key].apiId = api.apiId;
				synced++;
				console.log(`[api] synced "${api.name}" → apiId=${api.apiId} price=${api.pricePerCall}`);
			}
		}

		console.log(`[api] registry sync complete — ${synced}/${Object.keys(ENDPOINTS).length} built-in endpoints matched`);
	} catch (err) {
		console.warn("[api] registry sync failed — using fallback prices:", err);
	}
}

// ---------------------------------------------------------------------------
// Resolve price: on-chain if apiId is known, otherwise fallback
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
// Full catalog: built-in endpoints + all on-chain registered APIs.
// Agents call this first to discover everything available.
// ---------------------------------------------------------------------------
router.get("/catalog", async (_req: Request, res: Response) => {
	// Built-in endpoints
	const builtIn = await Promise.all(
		Object.entries(ENDPOINTS).map(async ([key, meta]) => {
			const price = await resolvePrice(key);
			return {
				type:         "builtin",
				key,
				name:         meta.name,
				description:  meta.description,
				endpoint:     meta.path,
				callUrl:      meta.path,
				apiId:        meta.apiId || null,
				pricePerCall: price.toString(),
				priceUsd:     (Number(price) / 1_000_000).toFixed(6),
				provider:     PROVIDER,
				currency:     "USDC",
				network:      process.env.CHAIN_NAME || "morph_hoodi",
			};
		})
	);

	// All on-chain registered APIs (includes provider-registered ones)
	const onChain = await blockchainService.getAllAPIs();
	const external = onChain
		.filter((api) => api.active)
		// Exclude built-ins already listed above
		.filter((api) => !Object.values(ENDPOINTS).some((e) => e.apiId === api.apiId))
		.map((api) => ({
			type:         "registered",
			key:          api.apiId,
			name:         api.name,
			description:  `Provider-registered API`,
			endpoint:     api.endpoint,
			callUrl:      `/api/v1/call/${api.apiId}`,
			apiId:        api.apiId,
			pricePerCall: api.pricePerCall.toString(),
			priceUsd:     (Number(api.pricePerCall) / 1_000_000).toFixed(6),
			provider:     api.provider,
			currency:     "USDC",
			network:      process.env.CHAIN_NAME || "morph_hoodi",
		}));

	const catalog = [...builtIn, ...external];

	res.json({
		success: true,
		count:   catalog.length,
		catalog,
		payment: {
			scheme:      "x402",
			facilitator: process.env.X402_FACILITATOR_ADDRESS,
			nonceUrl:    "/payment/nonce",
			verifyUrl:   "/payment/verify",
		},
	});
});

// ---------------------------------------------------------------------------
// GET /api/v1/btc  (built-in)
// ---------------------------------------------------------------------------
router.get("/btc", async (req: Request, res: Response) => {
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
				nonce:    req.paymentPayload?.nonce,
				provider: req.paymentPayload?.provider,
			},
		});
	});
});

// ---------------------------------------------------------------------------
// GET /api/v1/eth  (built-in)
// ---------------------------------------------------------------------------
router.get("/eth", async (req: Request, res: Response) => {
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
// GET /api/v1/sol  (built-in)
// ---------------------------------------------------------------------------
router.get("/sol", async (req: Request, res: Response) => {
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
// GET /api/v1/gas  (built-in)
// ---------------------------------------------------------------------------
router.get("/gas", async (req: Request, res: Response) => {
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

// ---------------------------------------------------------------------------
// GET /api/v1/call/:apiId  (generic proxy)
//
// Calls any API registered on-chain by its apiId.
// Flow:
//   1. Look up the API in the registry (gets endpoint URL, price, provider)
//   2. Verify it exists and is active
//   3. Run requirePayment() with the on-chain price and provider address
//   4. Forward the request (method + query params + body) to the endpoint URL
//   5. Return the provider's response to the agent
//
// Query params are forwarded as-is to the upstream endpoint.
// The x-payment-* headers are consumed by the middleware and NOT forwarded.
// ---------------------------------------------------------------------------
router.all("/call/:apiId", async (req: Request, res: Response) => {
	const apiId = param(req.params.apiId);

	// Step 1 — look up the API on-chain
	const api = await blockchainService.getAPI(apiId);

	if (!api) {
		return res.status(404).json({
			success: false,
			error:   `API not found: ${apiId}`,
		});
	}

	if (!api.active) {
		return res.status(410).json({
			success: false,
			error:   "This API has been deactivated by the provider",
		});
	}

	const price    = BigInt(api.pricePerCall);
	const provider = api.provider;

	// Step 2 — run payment middleware
	requirePayment(price, provider, apiId, api.name)(req, res, async () => {
		// Step 3 — build the upstream URL (forward query string)
		const queryString = new URLSearchParams(
			req.query as Record<string, string>
		).toString();
		const upstreamUrl = queryString
			? `${api.endpoint}?${queryString}`
			: api.endpoint;

		// Step 4 — proxy the request
		try {
			const upstreamRes = await fetch(upstreamUrl, {
				method:  req.method,
				headers: {
					"Content-Type": "application/json",
					"User-Agent":   "AgentMesh-Gateway/0.2.0",
					// Pass agent identity downstream so providers can log it
					"X-AgentMesh-Payer": req.paymentPayload?.payer ?? "",
					"X-AgentMesh-Nonce": req.paymentPayload?.nonce ?? "",
				},
				// Forward body for POST/PUT/PATCH
				body: ["POST", "PUT", "PATCH"].includes(req.method)
					? JSON.stringify(req.body)
					: undefined,
			});

			const contentType = upstreamRes.headers.get("content-type") ?? "";
			const isJson      = contentType.includes("application/json");

			// Step 5 — return upstream response
			res.status(upstreamRes.status);

			if (isJson) {
				const data = await upstreamRes.json();
				res.json({
					success: upstreamRes.ok,
					data,
					payment: {
						apiId,
						apiName:  api.name,
						provider: req.paymentPayload?.provider,
						nonce:    req.paymentPayload?.nonce,
					},
				});
			} else {
				const text = await upstreamRes.text();
				res.send(text);
			}
		} catch (err: any) {
			// Upstream unreachable — payment was already verified and will settle,
			// but the provider's server is down. Return 502.
			res.status(502).json({
				success: false,
				error:   "Upstream provider unreachable",
				detail:  err.message,
				payment: {
					apiId,
					nonce: req.paymentPayload?.nonce,
					note:  "Payment was authorized. Settlement may still occur on-chain.",
				},
			});
		}
	});
});

export { PROVIDER };
export default router;
