/**
 * provider.routes.ts
 *
 * Provider portal backend endpoints.
 *
 * GET /provider/:address           — provider overview (earnings, APIs, call count)
 * GET /provider/:address/earnings  — earnings breakdown per API
 * GET /provider/:address/calls     — paginated incoming call history
 */

import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";
import { ledgerService } from "../services/ledger.service";

const router = Router();
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// GET /provider/:address
// Provider portal overview — earnings, API list, call stats
// ---------------------------------------------------------------------------
router.get("/:address", async (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);

		const [apis, usdcBalance] = await Promise.all([
			blockchainService.getProviderAPIs(address),
			blockchainService.getUSDCBalance(address),
		]);

		const totalEarnings = ledgerService.totalEarnings(address);
		const totalCalls    = ledgerService.callCount(address);
		const recentCalls   = ledgerService.byProvider(address).slice(0, 20);

		res.json({
			success: true,
			address,
			provider: {
				usdcBalance,
				totalEarningsUsd: totalEarnings,
				totalCalls,
				activeApis:  apis.filter((a) => a.active).length,
				totalApis:   apis.length,
			},
			apis,
			recentCalls,
			network: {
				name:     process.env.CHAIN_NAME || "morph_hoodi",
				explorer: "https://explorer-hoodi.morphl2.io",
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /provider/:address/earnings
// Earnings breakdown per API — for the provider portal earnings chart
// ---------------------------------------------------------------------------
router.get("/:address/earnings", (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);
		const history = ledgerService.byProvider(address);

		// Per-API earnings breakdown
		const byApi: Record<string, { apiName: string; calls: number; earningsUsd: string }> = {};
		for (const entry of history) {
			const key = entry.apiId || entry.apiName;
			if (!byApi[key]) {
				byApi[key] = { apiName: entry.apiName, calls: 0, earningsUsd: "0" };
			}
			byApi[key].calls++;
			// Provider receives amount - fee
			const net = (parseFloat(entry.amountUsd) * 0.99);
			byApi[key].earningsUsd = (
				parseFloat(byApi[key].earningsUsd) + net
			).toFixed(6);
		}

		res.json({
			success:          true,
			address,
			totalEarningsUsd: ledgerService.totalEarnings(address),
			totalCalls:       history.length,
			breakdown:        Object.values(byApi),
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /provider/:address/calls?page=1&limit=20
// Paginated incoming call history — for the provider portal activity table
// ---------------------------------------------------------------------------
router.get("/:address/calls", (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);
		const page    = Math.max(1, Number(req.query.page)  || 1);
		const limit   = Math.min(100, Number(req.query.limit) || 20);
		const offset  = (page - 1) * limit;

		const all   = ledgerService.byProvider(address);
		const slice = all.slice(offset, offset + limit);

		res.json({
			success: true,
			address,
			pagination: {
				page,
				limit,
				total: all.length,
				pages: Math.ceil(all.length / limit),
			},
			calls: slice,
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

export default router;
