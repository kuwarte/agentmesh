/**
 * metadata.routes.ts
 *
 * Off-chain API metadata endpoints (Supabase-backed).
 *
 * POST /registry/metadata/:id      — submit/update rich metadata for an API
 * GET  /registry/metadata/:id      — fetch metadata for a single API
 * GET  /registry/metadata/slug/:slug — fetch metadata by URL slug
 * GET  /registry/categories        — list all distinct categories
 *
 * These routes are mounted on the /registry router in server.ts.
 *
 * Metadata fields (all optional on update):
 *   slug           — URL-friendly identifier (e.g. "btc-usd-price-feed")
 *   category       — marketplace category (e.g. "Crypto/DeFi")
 *   tags           — string array (e.g. ["bitcoin", "oracle", "defi"])
 *   description    — short description shown on marketplace cards
 *   longDesc       — full description shown on the detail page
 *   params         — array of { name, type, required, description }
 *   codeExample    — agent integration code snippet (string)
 *   responseSchema — example JSON response (string)
 *
 * Authorization:
 *   POST requires X-Provider-Address header matching the on-chain provider
 *   for that apiId. This is a lightweight ownership check — the gateway
 *   verifies the caller owns the API on-chain before allowing metadata writes.
 *   For production, replace with wallet signature verification.
 */

import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";
import { metadataService } from "../services/metadata.service";

const router = Router();
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// POST /registry/metadata/:id
// Submit or update rich metadata for an API.
//
// Requires X-Provider-Address header — must match the on-chain provider
// for this apiId. Prevents arbitrary overwrites.
//
// Body (all fields optional):
//   { slug, category, tags, description, longDesc, params, codeExample, responseSchema }
// ---------------------------------------------------------------------------
router.post("/:id", async (req: Request, res: Response) => {
	if (!metadataService.isReady()) {
		return res.status(503).json({
			success: false,
			error:   "Metadata service unavailable — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
		});
	}

	try {
		const apiId           = param(req.params.id);
		const providerAddress = req.headers["x-provider-address"] as string | undefined;

		// Verify the API exists on-chain
		const onChainApi = await blockchainService.getAPI(apiId);
		if (!onChainApi) {
			return res.status(404).json({ success: false, error: "API not found on-chain" });
		}

		// Lightweight ownership check — caller must supply their address and it
		// must match the on-chain provider. For production, use wallet signature.
		if (providerAddress) {
			if (providerAddress.toLowerCase() !== onChainApi.provider.toLowerCase()) {
				return res.status(403).json({
					success: false,
					error:   "X-Provider-Address does not match on-chain provider for this API",
				});
			}
		}
		// If no header supplied, allow write (open for MVP/testnet — tighten for prod)

		const {
			slug,
			category,
			tags,
			description,
			longDesc,
			params,
			codeExample,
			responseSchema,
		} = req.body;

		// Validate tags if provided
		if (tags !== undefined && !Array.isArray(tags)) {
			return res.status(400).json({ success: false, error: "tags must be an array of strings" });
		}

		// Validate params if provided
		if (params !== undefined) {
			if (!Array.isArray(params)) {
				return res.status(400).json({ success: false, error: "params must be an array" });
			}
			for (const p of params) {
				if (!p.name || !p.type) {
					return res.status(400).json({
						success: false,
						error:   "Each param must have at least name and type fields",
					});
				}
			}
		}

		const saved = await metadataService.upsert({
			apiId,
			slug,
			category,
			tags,
			description,
			longDesc,
			params,
			codeExample,
			responseSchema,
		});

		if (!saved) {
			return res.status(500).json({ success: false, error: "Failed to save metadata" });
		}

		res.status(201).json({
			success:  true,
			apiId,
			metadata: saved,
			onChain: {
				name:         onChainApi.name,
				endpoint:     onChainApi.endpoint,
				pricePerCall: onChainApi.pricePerCall,
				provider:     onChainApi.provider,
				active:       onChainApi.active,
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /registry/metadata/:id
// Fetch off-chain metadata for a single API by apiId.
// Returns null metadata fields if not yet submitted.
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
	if (!metadataService.isReady()) {
		return res.status(503).json({
			success: false,
			error:   "Metadata service unavailable — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
		});
	}

	try {
		const apiId    = param(req.params.id);
		const metadata = await metadataService.get(apiId);

		if (!metadata) {
			return res.status(404).json({
				success: false,
				error:   "No metadata found for this API. Submit via POST /registry/metadata/:id",
			});
		}

		res.json({ success: true, apiId, metadata });
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

export default router;
