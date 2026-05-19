/**
 * ledger.service.ts
 *
 * In-memory ledger for payment history.
 * Tracks every settled payment for dashboard and provider portal queries.
 * Resets on server restart — acceptable for a prototype/demo.
 *
 * Frontend pages served by this:
 *   /dashboard  — wallet call history, total spend, active nonces
 *   /provider   — earnings per API, call counts
 */

export interface LedgerEntry {
	txHash: string;
	apiId: string;
	apiName: string;
	payer: string;
	provider: string;
	amount: string;       // raw USDC units (6 decimals)
	amountUsd: string;    // human-readable e.g. "0.001000"
	fee: string;          // 1% platform fee in raw units
	nonce: string;
	timestamp: number;    // unix ms
	explorerUrl: string;
}

class LedgerService {
	private entries: LedgerEntry[] = [];

	record(entry: LedgerEntry) {
		this.entries.unshift(entry); // newest first
		// cap at 1000 entries to avoid unbounded memory
		if (this.entries.length > 1000) {
			this.entries = this.entries.slice(0, 1000);
		}
	}

	// All entries, newest first
	all(): LedgerEntry[] {
		return this.entries;
	}

	// Entries where payer === address (dashboard view)
	byPayer(address: string): LedgerEntry[] {
		const lower = address.toLowerCase();
		return this.entries.filter((e) => e.payer.toLowerCase() === lower);
	}

	// Entries where provider === address (provider portal view)
	byProvider(address: string): LedgerEntry[] {
		const lower = address.toLowerCase();
		return this.entries.filter((e) => e.provider.toLowerCase() === lower);
	}

	// Entries for a specific API (marketplace/:id view)
	byApiId(apiId: string): LedgerEntry[] {
		return this.entries.filter((e) => e.apiId === apiId);
	}

	// Aggregate spend for a payer address
	totalSpend(address: string): string {
		const lower = address.toLowerCase();
		const total = this.entries
			.filter((e) => e.payer.toLowerCase() === lower)
			.reduce((sum, e) => sum + BigInt(e.amount), 0n);
		return (Number(total) / 1_000_000).toFixed(6);
	}

	// Aggregate earnings for a provider address (after fee)
	totalEarnings(address: string): string {
		const lower = address.toLowerCase();
		const total = this.entries
			.filter((e) => e.provider.toLowerCase() === lower)
			.reduce((sum, e) => {
				const amount = BigInt(e.amount);
				const fee = BigInt(e.fee);
				return sum + (amount - fee);
			}, 0n);
		return (Number(total) / 1_000_000).toFixed(6);
	}

	// Call count for a provider
	callCount(address: string): number {
		const lower = address.toLowerCase();
		return this.entries.filter((e) => e.provider.toLowerCase() === lower).length;
	}
}

export const ledgerService = new LedgerService();
