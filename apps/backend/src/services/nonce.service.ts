/**
 * nonce.service.ts
 *
 * In-memory nonce store for replay attack prevention.
 * Acts as the first line of defense before on-chain settlement —
 * rejects duplicate nonces instantly without an RPC call.
 *
 * TTL: 24 hours (nonces expire after the on-chain deadline window).
 * The X402Facilitator contract's on-chain usedNonces mapping is the
 * permanent source of truth for replay protection.
 *
 * apiId is now emitted directly in the PaymentSettled event (v2 contract),
 * so no disk persistence is needed for ledger replay.
 */

type NonceEntry = {
	usedAt:  number;
	provider: string;
	amount:   string;
};

class NonceService {
	private store = new Map<string, NonceEntry>();

	private TTL = 24 * 60 * 60 * 1000;

	has(nonce: string): boolean {
		return this.store.has(nonce);
	}

	consume(nonce: string, provider: string, amount: string): boolean {
		if (this.store.has(nonce)) return false;

		this.store.set(nonce, {
			usedAt: Date.now(),
			provider,
			amount,
		});

		this.gc();
		return true;
	}

	// Keep getMeta for backward compat with old events during replay transition
	getMeta(_nonce: string): { apiId: string; apiName: string } | null {
		return null;
	}

	private gc() {
		const now = Date.now();
		for (const [nonce, entry] of this.store) {
			if (now - entry.usedAt > this.TTL) {
				this.store.delete(nonce);
			}
		}
	}

	size() {
		return this.store.size;
	}
}

export const nonceService = new NonceService();
