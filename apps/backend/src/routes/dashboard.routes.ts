/**
 * dashboard.routes.ts
 *
 * Wallet-level analytics for the /dashboard frontend page.
 *
 * GET /dashboard/:address          — full dashboard for a wallet
 * GET /dashboard/:address/history  — paginated call history
 * GET /dashboard/:address/spend    — spend summary
 */

import { Router, Request, Response } from "express";
import { blockchainService } from "../services/blockchain.service";
import { ledgerService } from "../services/ledger.service";

const router = Router();
const param = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// GET /dashboard/:address
// Full dashboard — call history, total spend, USDC balance, active nonces
// ---------------------------------------------------------------------------
router.get("/:address", async (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);

		const [usdcBalance, history] = await Promise.all([
			blockchainService.getUSDCBalance(address),
			Promise.resolve(ledgerService.byPayer(address)),
		]);

		const totalSpend  = ledgerService.totalSpend(address);
		const callCount   = history.length;
		const recentCalls = history.slice(0, 20);

		// Unique APIs this wallet has called
		const uniqueApis = [...new Set(history.map((e) => e.apiId).filter(Boolean))];

		res.json({
			success: true,
			address,
			wallet: {
				usdcBalance,
				totalSpendUsd: totalSpend,
				callCount,
				uniqueApisUsed: uniqueApis.length,
			},
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
// GET /dashboard/:address/history?page=1&limit=20
// Paginated call history for the activity table
// ---------------------------------------------------------------------------
router.get("/:address/history", (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);
		const page    = Math.max(1, Number(req.query.page)  || 1);
		const limit   = Math.min(100, Number(req.query.limit) || 20);
		const offset  = (page - 1) * limit;

		const all    = ledgerService.byPayer(address);
		const slice  = all.slice(offset, offset + limit);

		res.json({
			success: true,
			address,
			pagination: {
				page,
				limit,
				total: all.length,
				pages: Math.ceil(all.length / limit),
			},
			history: slice,
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// ---------------------------------------------------------------------------
// GET /dashboard/:address/spend
// Spend summary — total, per-API breakdown
// ---------------------------------------------------------------------------
router.get("/:address/spend", (req: Request, res: Response) => {
	try {
		const address = param(req.params.address);
		const history = ledgerService.byPayer(address);

		// Per-API spend breakdown
		const byApi: Record<string, { apiName: string; calls: number; totalUsd: string }> = {};
		for (const entry of history) {
			const key = entry.apiId || entry.apiName;
			if (!byApi[key]) {
				byApi[key] = { apiName: entry.apiName, calls: 0, totalUsd: "0" };
			}
			byApi[key].calls++;
			byApi[key].totalUsd = (
				parseFloat(byApi[key].totalUsd) + parseFloat(entry.amountUsd)
			).toFixed(6);
		}

		res.json({
			success:       true,
			address,
			totalSpendUsd: ledgerService.totalSpend(address),
			totalCalls:    history.length,
			breakdown:     Object.values(byApi),
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

export default router;
