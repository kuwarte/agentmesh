/**
 * api.routes.ts — Paid API endpoints
 *
 * All paid calls go through a single route:
 *
 *   GET /api/v1/call/:apiId
 *
 * The gateway looks up the API on-chain (price, endpoint, provider),
 * runs x402 payment verification, then proxies the request to the
 * registered endpoint URL.
 *
 * Built-in feeds (BTC, ETH, SOL, Gas) are registered on-chain at startup
 * pointing to /internal/:key — unauthenticated handlers on this same server
 * that return mock data. They are indistinguishable from any other provider
 * API from the agent's perspective.
 *
 * Endpoints (all under /api/v1/):
 *   GET /catalog          — list all active on-chain APIs
 *   GET /call/:apiId      — proxy any registered API (universal entry point)
 *   GET /internal/:key    — unauthenticated data handlers for built-in feeds
 */

import { Router, Request, Response } from "express";
import { requirePayment } from "../middleware/x402.middleware";
import { blockchainService } from "../services/blockchain.service";
import { requireInternal } from "../middleware/internal.middleware";

const router = Router();

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3001";
const PROVIDER = process.env.PROVIDER_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// Built-in feed definitions
// These are registered on-chain at startup. The endpoint URL points back to
// /internal/:key on this server so the proxy route can call them.
// ---------------------------------------------------------------------------
interface BuiltinDef {
	name: string;
	description: string;
	pricePerCall: bigint; // USDC raw units (6 decimals)
}

export const BUILTIN_FEEDS: Record<string, BuiltinDef> = {
	btc: {
		name: "BTC Price",
		description: "Real-time Bitcoin/USD price",
		pricePerCall: 1000n, // $0.001
	},
	eth: {
		name: "ETH Price",
		description: "Real-time Ethereum/USD price",
		pricePerCall: 1000n,
	},
	sol: {
		name: "SOL Price",
		description: "Real-time Solana/USD price",
		pricePerCall: 500n, // $0.0005
	},
	gas: {
		name: "Gas Tracker",
		description: "Ethereum gas prices (fast / standard / slow) in gwei",
		pricePerCall: 500n,
	},
};

// ---------------------------------------------------------------------------
// autoRegisterBuiltins()
//
// Called once from server.ts after blockchainService.init().
// For each built-in feed, checks if an API with that name is already
// registered on-chain. If not, registers it with the gateway as provider,
// pointing the endpoint to /internal/:key on this server.
//
// This means built-ins are real on-chain entries — agents discover them
// via /api/v1/catalog and call them via /api/v1/call/:apiId, exactly like
// any provider-registered API.
// ---------------------------------------------------------------------------
export async function autoRegisterBuiltins(): Promise<void> {
	if (!blockchainService.isReady()) {
		console.log("[api] chain not ready — skipping built-in registration");
		return;
	}

	try {
		const existing = await blockchainService.getAllAPIs();
		const existingNames = new Set(existing.map((a) => a.name.toLowerCase()));

		for (const [key, def] of Object.entries(BUILTIN_FEEDS)) {
			if (existingNames.has(def.name.toLowerCase())) {
				console.log(`[api] built-in "${def.name}" already registered — skipping`);
				continue;
			}

			const endpoint = `${GATEWAY_URL}/internal/${key}`;
			console.log(`[api] registering built-in "${def.name}" → ${endpoint}`);

			const result = await blockchainService.registerAPI(
				def.name,
				endpoint,
				def.pricePerCall
			);

			if (result) {
				console.log(
					`[api] registered "${def.name}" apiId=${result.apiId} txHash=${result.txHash}`
				);
			} else {
				console.warn(`[api] failed to register built-in "${def.name}"`);
			}
		}
	} catch (err) {
		console.warn("[api] autoRegisterBuiltins failed (non-fatal):", err);
	}
}

// ---------------------------------------------------------------------------
// GET /api/v1/catalog
//
// Lists all active on-chain APIs. Agents call this to discover what's
// available and get the callUrl for each API.
// ---------------------------------------------------------------------------
router.get("/catalog", async (_req: Request, res: Response) => {
	const onChain = await blockchainService.getAllAPIs();

	const catalog = onChain
		.filter((api) => api.active)
		.map((api) => ({
			apiId: api.apiId,
			name: api.name,
			endpoint: api.endpoint,
			callUrl: `/api/v1/call/${api.apiId}`,
			pricePerCall: api.pricePerCall.toString(),
			priceUsd: (Number(api.pricePerCall) / 1_000_000).toFixed(6),
			provider: api.provider,
			currency: "USDC",
			network: process.env.CHAIN_NAME || "morph_hoodi",
		}));

	res.json({
		success: true,
		count: catalog.length,
		catalog,
		payment: {
			scheme: "x402",
			facilitator: process.env.X402_FACILITATOR_ADDRESS,
			nonceUrl: "/payment/nonce",
			verifyUrl: "/payment/verify",
		},
	});
});

// ---------------------------------------------------------------------------
// GET /internal/:key
//
// Unauthenticated data handlers for built-in feeds.
// These are the upstream endpoints that /api/v1/call/:apiId proxies to
// after payment is verified. No payment check here — the proxy already
// handled that.
//
// Only reachable from the proxy (or directly for testing).
// In production, restrict this to localhost-only traffic.
// ---------------------------------------------------------------------------
export const internalRoutes = Router();

internalRoutes.get("/:key", requireInternal, async (req: Request, res: Response) => {
	const key = param(req.params.key);

	switch (key) {
		case "btc":
			return res.json({
				symbol: "BTC",
				price: 65000 + Math.floor(Math.random() * 2000),
				currency: "USD",
				timestamp: Date.now(),
			});

		case "eth":
			return res.json({
				symbol: "ETH",
				price: 3200 + Math.floor(Math.random() * 200),
				currency: "USD",
				timestamp: Date.now(),
			});

		case "sol":
			return res.json({
				symbol: "SOL",
				price: 140 + Math.floor(Math.random() * 20),
				currency: "USD",
				timestamp: Date.now(),
			});

		case "gas": {
			const base = 20 + Math.floor(Math.random() * 30);
			return res.json({
				network: "ethereum",
				unit: "gwei",
				fast: base + 10,
				standard: base + 3,
				slow: base,
				timestamp: Date.now(),
			});
		}

		case "trivia": {
			try {
				const triviaRes = await fetch("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
				if (triviaRes.ok) {
					const triviaData = await triviaRes.json();
					return res.json({
						fact: triviaData.text,
						source: triviaData.source_url,
						timestamp: Date.now(),
					});
				}
			} catch (_e) {}
			return res.json({
				fact: "Did you know? Honey never spoils.",
				source: "general knowledge",
				timestamp: Date.now(),
			});
		}

		case "weather": {
			const city = String(req.query.city || "London");
			try {
				const geoRes = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=en&format=json");
				if (!geoRes.ok) throw new Error("geo failed");
				const geoData = await geoRes.json();
				const loc = geoData.results && geoData.results[0];
				if (!loc) return res.status(404).json({ error: "City not found: " + city });
				const wxRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.latitude + "&longitude=" + loc.longitude + "&current_weather=true&temperature_unit=celsius");
				if (!wxRes.ok) throw new Error("weather fetch failed");
				const wxData = await wxRes.json();
				const cw = wxData.current_weather;
				return res.json({
					city: loc.name,
					country: loc.country_code,
					temperature_c: cw.temperature,
					windspeed_kmh: cw.windspeed,
					weathercode: cw.weathercode,
					is_day: cw.is_day === 1,
					timestamp: Date.now(),
				});
			} catch (err) {
				return res.status(502).json({ error: "Weather fetch failed", detail: (err as any).message });
			}
		}

		default:
			return res.status(404).json({ error: `Unknown internal feed: ${key}` });
	}
});

// ---------------------------------------------------------------------------
// GET|POST|... /api/v1/call/:apiId
//
// Universal paid entry point for every registered API.
//
// Flow:
//   1. Look up the API on-chain (endpoint URL, price, provider)
//   2. Verify it exists and is active
//   3. Run requirePayment() — verifies x402 signature, consumes nonce
//   4. Proxy the request to the registered endpoint URL
//   5. Return the upstream response to the agent
//
// Query params are forwarded as-is. X-Payment header is consumed here
// and NOT forwarded upstream.
// ---------------------------------------------------------------------------
router.all("/call/:apiId", async (req: Request, res: Response) => {
	const apiId = param(req.params.apiId);

	// Step 1 — look up on-chain
	const api = await blockchainService.getAPI(apiId);

	if (!api) {
		return res.status(404).json({
			success: false,
			error: `API not found: ${apiId}`,
		});
	}

	if (!api.active) {
		return res.status(410).json({
			success: false,
			error: "This API has been deactivated by the provider",
		});
	}

	const price = BigInt(api.pricePerCall);
	const provider = api.provider;

	// Step 2 — payment middleware
	requirePayment(
		price,
		provider,
		apiId,
		api.name
	)(req, res, async () => {
		// Step 3 — build upstream URL (forward query string)
		const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
		const upstreamUrl = queryString ? `${api.endpoint}?${queryString}` : api.endpoint;

		// Step 4 — proxy
		try {
			const upstreamRes = await fetch(upstreamUrl, {
				method: req.method,
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "AgentMesh-Gateway/1.0.0",
					"X-AgentMesh-Payer": req.paymentPayload?.payer ?? "",
					"X-AgentMesh-Nonce": req.paymentPayload?.nonce ?? "",

					"X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
				},
				body: ["POST", "PUT", "PATCH"].includes(req.method)
					? JSON.stringify(req.body)
					: undefined,
			});

			const contentType = upstreamRes.headers.get("content-type") ?? "";
			const isJson = contentType.includes("application/json");

			res.status(upstreamRes.status);

			if (isJson) {
				const data = await upstreamRes.json();
				res.json({
					success: upstreamRes.ok,
					data,
					payment: {
						apiId,
						apiName: api.name,
						provider: req.paymentPayload?.provider,
						nonce: req.paymentPayload?.nonce,
					},
				});
			} else {
				const text = await upstreamRes.text();
				res.send(text);
			}
		} catch (err: any) {
			// Upstream unreachable — payment was verified and will settle on-chain.
			res.status(502).json({
				success: false,
				error: "Upstream provider unreachable",
				detail: err.message,
				payment: {
					apiId,
					nonce: req.paymentPayload?.nonce,
					note: "Payment was authorized. Settlement may still occur on-chain.",
				},
			});
		}
	});
});

export { PROVIDER };
export default router;
