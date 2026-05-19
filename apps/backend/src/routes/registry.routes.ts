/**
 * registry.routes.ts
 *
 * On-chain API registry endpoints.
 *
 * GET  /registry/apis              — list all registered APIs (marketplace)
 * GET  /registry/api/:id           — single API detail (marketplace/:id)
 * GET  /registry/provider/:address — all APIs by a provider (provider portal)
 * GET  /registry/stats             — total count + chain status
 * POST /registry/register          — register a new API on-chain
 * PUT  /registry/api/:id           — update price / active status (provider portal)
 */

import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";
import { ledgerService } from "../services/ledger.service";

const router = Router();

// Express 5 types req.params values as string | string[] — this narrows to string
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// GET /registry/apis
// Marketplace — list all APIs with name, price, provider
// ---------------------------------------------------------------------------
router.get("/apis", async (_req: Request, res: Response) => {
	try {
		const apis = await blockchainService.getAllAPIs();
		res.json({ success: true, count: apis.length, apis });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /registry/api/:id
// Marketplace/:id — single API detail + recent payment activity
// ---------------------------------------------------------------------------
router.get("/api/:id", async (req: Request, res: Response) => {
	try {
		const id  = param(req.params.id);
		const api = await blockchainService.getAPI(id);
		if (!api) {
			return res.status(404).json({ success: false, error: "API not found" });
		}

		const recentPayments = ledgerService.byApiId(id).slice(0, 20);

		res.json({
			success: true,
			api,
			activity: {
				recentPayments,
				totalCalls: ledgerService.byApiId(id).length,
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /registry/provider/:address
// Provider portal — all APIs owned by this wallet
// ---------------------------------------------------------------------------
router.get("/provider/:address", async (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);
		const apis    = await blockchainService.getProviderAPIs(address);

		res.json({
			success:  true,
			provider: address,
			count:    apis.length,
			apis,
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /registry/stats
// Dashboard header stats
// ---------------------------------------------------------------------------
router.get("/stats", async (_req: Request, res: Response) => {
	try {
		const total = await blockchainService.totalAPIs();
		res.json({
			success:       true,
			totalAPIs:     total,
			chainConnected: blockchainService.isReady(),
			network:       process.env.CHAIN_NAME || "morph_hoodi",
			explorer:      "https://explorer-hoodi.morphl2.io",
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// POST /registry/register
// Permissionless API registration — provider portal "Register API" form
//
// Body: { name, endpoint, pricePerCall }
//   name         — human-readable API name
//   endpoint     — full URL of the API
//   pricePerCall — price in USDC raw units (6 decimals), e.g. 1000 = $0.001
//
// Note: The gateway wallet signs the tx on-chain. In production each provider
// would sign with their own wallet via a frontend wallet connection.
// For the prototype the gateway registers on their behalf.
// ---------------------------------------------------------------------------
router.post("/register", async (req: Request, res: Response) => {
	try {
		const { name, endpoint, pricePerCall } = req.body;

		if (!name || !endpoint || pricePerCall === undefined) {
			return res.status(400).json({
				success: false,
				error:   "Required fields: name, endpoint, pricePerCall",
			});
		}

		if (typeof name !== "string" || name.trim().length === 0) {
			return res.status(400).json({ success: false, error: "name must be a non-empty string" });
		}

		if (typeof endpoint !== "string" || !endpoint.startsWith("http")) {
			return res.status(400).json({ success: false, error: "endpoint must be a valid URL" });
		}

		const price = BigInt(pricePerCall);
		if (price < 0n) {
			return res.status(400).json({ success: false, error: "pricePerCall must be >= 0" });
		}

		const result = await blockchainService.registerAPI(name.trim(), endpoint.trim(), price);

		if (!result) {
			return res.status(500).json({ success: false, error: "On-chain registration failed" });
		}

		res.status(201).json({
			success:     true,
			apiId:       result.apiId,
			txHash:      result.txHash,
			explorerUrl: `https://explorer-hoodi.morphl2.io/tx/${result.txHash}`,
			api: {
				name:         name.trim(),
				endpoint:     endpoint.trim(),
				pricePerCall: price.toString(),
				priceUsd:     (Number(price) / 1_000_000).toFixed(6),
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// PUT /registry/api/:id
// Provider portal — update price or toggle active status
//
// Body: { pricePerCall?, active? }
// Only the registered provider (GATEWAY_PRIVATE_KEY wallet) can update.
// ---------------------------------------------------------------------------
router.put("/api/:id", async (req: Request, res: Response) => {
	try {
		const { pricePerCall, active } = req.body;

		if (pricePerCall === undefined && active === undefined) {
			return res.status(400).json({
				success: false,
				error:   "Provide at least one of: pricePerCall, active",
			});
		}

		// Fetch current state to fill in unchanged fields
		const id      = param(req.params.id);
		const current = await blockchainService.getAPI(id);
		if (!current) {
			return res.status(404).json({ success: false, error: "API not found" });
		}

		const newPrice  = pricePerCall !== undefined ? BigInt(pricePerCall) : BigInt(current.pricePerCall);
		const newActive = active       !== undefined ? Boolean(active)      : current.active;

		const result = await blockchainService.updateAPI(id, newPrice, newActive);

		if (!result) {
			return res.status(500).json({ success: false, error: "On-chain update failed" });
		}

		res.json({
			success:     true,
			txHash:      result.txHash,
			explorerUrl: `https://explorer-hoodi.morphl2.io/tx/${result.txHash}`,
			updated: {
				apiId:        id,
				pricePerCall: newPrice.toString(),
				priceUsd:     (Number(newPrice) / 1_000_000).toFixed(6),
				active:       newActive,
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

export default router;
