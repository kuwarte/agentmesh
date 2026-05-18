import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";

const router = Router();

/**
 * GET /registry/apis
 * Fetch all APIs from on-chain registry
 */
router.get("/apis", async (_req: Request, res: Response) => {
	try {
		const apis = await blockchainService.getAllAPIs();

		res.json({
			success: true,
			count: apis.length,
			apis,
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: err.message,
		});
	}
});

/**
 * GET /registry/api/:id
 * Fetch single API from registry
 */
router.get("/api/:id", async (req: Request, res: Response) => {
	try {
		const api = await blockchainService.getAPI(req.params.id as string);

		if (!api) {
			return res.status(404).json({
				success: false,
				error: "API not found",
			});
		}

		res.json({
			success: true,
			api,
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: err.message,
		});
	}
});

/**
 * GET /registry/provider/:address
 * Get all APIs owned by a provider
 */
router.get("/provider/:address", async (req: Request, res: Response) => {
	try {
		const apis = await blockchainService.getProviderAPIs(req.params.address);

		res.json({
			success: true,
			provider: req.params.address,
			count: apis.length,
			apis,
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: err.message,
		});
	}
});

/**
 * GET /registry/stats
 * Registry metadata (useful for dashboard)
 */
router.get("/stats", async (_req: Request, res: Response) => {
	try {
		const total = await blockchainService.totalAPIs();

		res.json({
			success: true,
			totalAPIs: total,
			chainConnected: blockchainService.isReady(),
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: err.message,
		});
	}
});

export default router;
