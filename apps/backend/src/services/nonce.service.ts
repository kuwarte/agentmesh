type NonceEntry = {
	usedAt: number;
	provider: string;
	amount: string;
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
