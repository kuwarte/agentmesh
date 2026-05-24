/**
 * registry.routes.ts
 *
 * On-chain API registry endpoints.
 *
 * GET  /registry/apis              — list all registered APIs (marketplace, merged with metadata)
 * GET  /registry/api/:id           — single API detail (marketplace/:id, merged with metadata)
 * GET  /registry/provider/:address — all APIs by a provider (provider portal)
 * GET  /registry/stats             — total count + chain status
 * GET  /registry/categories        — distinct categories from metadata (marketplace filter bar)
 * GET  /registry/slug/:slug        — resolve a slug to full API detail
 * POST /registry/register          — register a new API on-chain
 * PUT  /registry/api/:id           — update price / active status (provider portal)
 *
 * Metadata routes (POST/GET /registry/metadata/:id) are in metadata.routes.ts
 * and mounted here via metadataRouter.
 */

import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";
import { ledgerService } from "../services/ledger.service";
import { metadataService } from "../services/metadata.service";
import metadataRouter from "./metadata.routes";

const router = Router();

// Express 5 types req.params values as string | string[] — this narrows to string
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// Mount metadata sub-router at /registry/metadata/:id
router.use("/metadata", metadataRouter);

// ---------------------------------------------------------------------------
// GET /registry/apis
// Marketplace — list all APIs merged with off-chain metadata.
// On-chain fields: provider, name, endpoint, pricePerCall, active
// Metadata fields: category, tags, description, slug (null if not submitted)
//
// Query params:
//   ?category=Crypto/DeFi  — filter by category
//   ?active=true           — filter by active status (default: all)
// ---------------------------------------------------------------------------
router.get("/apis", async (req: Request, res: Response) => {
	try {
		const onChainApis = await blockchainService.getAllAPIs();

		// Optional filters
		const categoryFilter = req.query.category as string | undefined;
		const activeFilter   = req.query.active as string | undefined;

		// Batch-fetch all metadata in one Supabase query
		const apiIds      = onChainApis.map((a) => a.apiId);
		const metadataMap = await metadataService.getBatch(apiIds);

		// Merge on-chain + metadata
		let merged = onChainApis.map((api) => {
			const meta = metadataMap.get(api.apiId) ?? null;
			return {
				// On-chain (source of truth)
				apiId:        api.apiId,
				provider:     api.provider,
				name:         api.name,
				endpoint:     api.endpoint,
				pricePerCall: api.pricePerCall,
				priceUsd:     (Number(api.pricePerCall) / 1_000_000).toFixed(6),
				active:       api.active,
				// Off-chain metadata (null if not submitted)
				slug:         meta?.slug        ?? null,
				category:     meta?.category    ?? null,
				tags:         meta?.tags        ?? [],
				description:  meta?.description ?? null,
			};
		});

		// Apply filters
		if (activeFilter !== undefined) {
			const wantActive = activeFilter !== "false";
			merged = merged.filter((a) => a.active === wantActive);
		}
		if (categoryFilter) {
			merged = merged.filter(
				(a) => a.category?.toLowerCase() === categoryFilter.toLowerCase()
			);
		}

		res.json({
			success:          true,
			count:            merged.length,
			metadataEnabled:  metadataService.isReady(),
			apis:             merged,
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /registry/api/:id
// Marketplace/:id — single API detail merged with metadata + recent activity
// ---------------------------------------------------------------------------
router.get("/api/:id", async (req: Request, res: Response) => {
	try {
		const id  = param(req.params.id);
		const api = await blockchainService.getAPI(id);
		if (!api) {
			return res.status(404).json({ success: false, error: "API not found" });
		}

		// Fetch off-chain metadata (null if not yet submitted)
		const metadata = await metadataService.get(id);

		const recentPayments = ledgerService.byApiId(id).slice(0, 20);
		const totalCalls     = ledgerService.byApiId(id).length;

		res.json({
			success: true,
			api: {
				// On-chain fields
				apiId:        api.apiId,
				provider:     api.provider,
				name:         api.name,
				endpoint:     api.endpoint,
				pricePerCall: api.pricePerCall,
				priceUsd:     (Number(api.pricePerCall) / 1_000_000).toFixed(6),
				active:       api.active,
				// Off-chain metadata (null if not submitted)
				slug:           metadata?.slug           ?? null,
				category:       metadata?.category       ?? null,
				tags:           metadata?.tags           ?? [],
				description:    metadata?.description    ?? null,
				longDesc:       metadata?.longDesc       ?? null,
				params:         metadata?.params         ?? [],
				codeExample:    metadata?.codeExample    ?? null,
				responseSchema: metadata?.responseSchema ?? null,
			},
			activity: {
				recentPayments,
				totalCalls,
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /registry/slug/:slug
// Resolve a URL slug to full API detail (for frontend /marketplace/:slug routing)
// ---------------------------------------------------------------------------
router.get("/slug/:slug", async (req: Request, res: Response) => {
	if (!metadataService.isReady()) {
		return res.status(503).json({
			success: false,
			error:   "Metadata service unavailable",
		});
	}

	try {
		const slug     = param(req.params.slug);
		const metadata = await metadataService.getBySlug(slug);

		if (!metadata) {
			return res.status(404).json({ success: false, error: `No API found with slug: ${slug}` });
		}

		const api = await blockchainService.getAPI(metadata.apiId);
		if (!api) {
			return res.status(404).json({ success: false, error: "On-chain API not found for this slug" });
		}

		const totalCalls     = ledgerService.byApiId(metadata.apiId).length;
		const recentPayments = ledgerService.byApiId(metadata.apiId).slice(0, 20);

		res.json({
			success: true,
			api: {
				apiId:          api.apiId,
				provider:       api.provider,
				name:           api.name,
				endpoint:       api.endpoint,
				pricePerCall:   api.pricePerCall,
				priceUsd:       (Number(api.pricePerCall) / 1_000_000).toFixed(6),
				active:         api.active,
				slug:           metadata.slug,
				category:       metadata.category,
				tags:           metadata.tags,
				description:    metadata.description,
				longDesc:       metadata.longDesc,
				params:         metadata.params,
				codeExample:    metadata.codeExample,
				responseSchema: metadata.responseSchema,
			},
			activity: {
				recentPayments,
				totalCalls,
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
// GET /registry/categories
// Returns all distinct categories from metadata — used by the marketplace
// filter bar. Falls back to an empty array if metadata service is down.
// ---------------------------------------------------------------------------
router.get("/categories", async (_req: Request, res: Response) => {
	try {
		const categories = await metadataService.getCategories();
		res.json({ success: true, categories });
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
// Register a new API on-chain.
//
// TWO MODES:
//
// Mode 1 — Gateway-signed (for testing, agents, CLI):
//   Body: { name, endpoint, pricePerCall }
//   Gateway wallet signs the tx. Gateway becomes on-chain owner.
//   Payments route to PROVIDER_ADDRESS in .env.
//
// Mode 2 — Provider-specified (for multi-provider support):
//   Body: { name, endpoint, pricePerCall, providerAddress }
//   Gateway still signs the tx (on-chain owner = gateway),
//   but providerAddress is stored and used for payment routing.
//   This is the backend workaround until frontend MetaMask signing is live.
//
// Mode 3 — Frontend MetaMask (recommended for production):
//   Provider calls APIRegistry.registerAPI() directly via Wagmi.
//   No backend involvement. Provider is on-chain owner.
//   ABI: packages/contracts/out/APIRegistry.sol/APIRegistry.json
//   Function: registerAPI(name, endpoint, pricePerCall)
// ---------------------------------------------------------------------------
router.post("/register", async (req: Request, res: Response) => {
	try {
		const { name, endpoint, pricePerCall, providerAddress } = req.body;

		if (!name || !endpoint || pricePerCall === undefined) {
			return res.status(400).json({
				success: false,
				error:   "Required fields: name, endpoint, pricePerCall",
				optional: "providerAddress — wallet that receives payments (defaults to gateway)",
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

		// Validate providerAddress if supplied
		const { ethers } = await import("ethers");
		if (providerAddress && !ethers.isAddress(providerAddress)) {
			return res.status(400).json({ success: false, error: "providerAddress must be a valid Ethereum address" });
		}

		const result = await blockchainService.registerAPI(name.trim(), endpoint.trim(), price);

		if (!result) {
			return res.status(500).json({ success: false, error: "On-chain registration failed" });
		}

		res.status(201).json({
			success:         true,
			apiId:           result.apiId,
			txHash:          result.txHash,
			explorerUrl:     `https://explorer-hoodi.morphl2.io/tx/${result.txHash}`,
			onChainOwner:    "gateway (GATEWAY_PRIVATE_KEY wallet)",
			paymentReceiver: providerAddress || process.env.PROVIDER_ADDRESS || "gateway",
			note:            providerAddress
				? "Payments will route to providerAddress. For full ownership, register via MetaMask on the frontend."
				: "Gateway is on-chain owner. Use providerAddress field or frontend MetaMask for provider-owned APIs.",
			api: {
				name:         name.trim(),
				endpoint:     endpoint.trim(),
				pricePerCall: price.toString(),
				priceUsd:     (Number(price) / 1_000_000).toFixed(6),
				provider:     providerAddress || process.env.PROVIDER_ADDRESS,
			},
			frontend: {
				note:     "For true provider ownership, call registerAPI() directly via Wagmi",
				contract: process.env.API_REGISTRY_ADDRESS,
				function: "registerAPI(string name, string endpoint, uint256 pricePerCall)",
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
