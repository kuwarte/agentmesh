import { ethers } from "ethers";
import APIRegistry from "../abis/APIRegistry.json";
import X402Facilitator from "../abis/X402Facilitator.json";
import { nonceService } from "./nonce.service";

/**
 * blockchain.service.ts
 *
 * Single interface to all on-chain interactions:
 *   - Signature verification (off-chain, before serving response)
 *   - Payment settlement via X402Facilitator.settle(payer, ...)
 *   - APIRegistry read/write (getAllAPIs, getAPI, registerAPI, updateAPI)
 *   - USDC balance queries
 *
 * The gateway signer (GATEWAY_PRIVATE_KEY) is used only for write operations
 * (registerAPI, updateAPI, settlePayment). Read operations use the provider directly.
 */

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

const provider = new ethers.JsonRpcProvider(RPC_URL);

// gateway signer — used for settlePayment, registerAPI, updateAPI
const signer = new ethers.Wallet(process.env.GATEWAY_PRIVATE_KEY!, provider);

// contracts
const registry = new ethers.Contract(process.env.API_REGISTRY_ADDRESS!, APIRegistry.abi, provider);

const facilitator = new ethers.Contract(
	process.env.X402_FACILITATOR_ADDRESS!,
	X402Facilitator.abi,
	signer
);

// types
export interface PaymentPayload {
	payer: string;
	provider: string;
	amount: bigint;
	nonce: string;
	deadline: number;
	signature: string;
	apiId?: string; // bytes32 hex — passed to settle() and emitted in PaymentSettled
}

// service
class BlockchainService {
	private ready = false;
	private chainId: number = 2910; // default to Morph Hoodi

	async init() {
		try {
			const network = await provider.getNetwork();
			this.chainId = Number(network.chainId);
			console.log(`[blockchain] connected chainId=${this.chainId}`);
			this.ready = true;
		} catch (err) {
			console.warn("[blockchain] RPC not available");
			this.ready = false;
		}
	}

	isReady() {
		return this.ready;
	}

	getChainId(): number {
		return this.chainId;
	}

	// Verify the agent's payment signature off-chain before serving the response.
	// Must reconstruct the exact same message hash the contract uses in settle():
	//   keccak256(abi.encodePacked(facilitator, payer, provider, amount, nonce, deadline))
	// The signature is verified against `payer`, not the gateway (msg.sender).
	verifyPayment(payload: PaymentPayload) {
		try {
			const facilitatorAddress = process.env.X402_FACILITATOR_ADDRESS!;

			if (payload.deadline < Math.floor(Date.now() / 1000)) {
				return { valid: false, reason: "Expired signature" };
			}

			const encoded = ethers.solidityPacked(
				["address", "address", "address", "uint256", "bytes32", "uint256"],
				[
					facilitatorAddress,
					payload.payer, // msg.sender in the contract (the agent)
					payload.provider,
					payload.amount,
					payload.nonce,
					payload.deadline,
				]
			);

			const hash = ethers.keccak256(encoded);
			const ethSignedHash = ethers.hashMessage(ethers.getBytes(hash));

			const recovered = ethers.recoverAddress(ethSignedHash, payload.signature);

			if (recovered.toLowerCase() !== payload.payer.toLowerCase()) {
				return { valid: false, reason: "Signature does not match payer" };
			}

			return { valid: true, signer: recovered };
		} catch (err: any) {
			return { valid: false, reason: err.message };
		}
	}

	async settlePayment(payload: PaymentPayload) {
		try {
			const feeData = await provider.getFeeData();
			const gasOverrides = feeData.maxFeePerGas
				? {
						maxFeePerGas: feeData.maxFeePerGas * 2n,
						maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas ?? 1000000000n) * 2n,
					}
				: {
						gasPrice: (feeData.gasPrice ?? 1000000000n) * 2n,
					};

			const tx = await facilitator.settle(
				payload.payer,
				payload.provider,
				payload.amount,
				payload.nonce,
				payload.deadline,
				payload.apiId ?? ethers.ZeroHash,
				payload.signature,
				gasOverrides
			);

			const receipt = await tx.wait();

			return {
				success: true,
				txHash: receipt.hash,
			};
		} catch (err: any) {
			return {
				success: false,
				error: err.reason || err.message,
			};
		}
	}

	// registry read
	async getAllAPIs() {
		try {
			const ids = await registry.getAllAPIs();

			const results = await Promise.allSettled(
				ids.map(async (id: string) => {
					const api = await registry.getAPI(id);

					return {
						apiId: id,
						provider: api.provider,
						name: api.name,
						endpoint: api.endpoint,
						pricePerCall: api.pricePerCall,
						active: api.active,
					};
				})
			);

			return results
				.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
				.map((r) => r.value)
				.map((api) => ({
					apiId: api.apiId,
					provider: api.provider,
					name: api.name,
					endpoint: api.endpoint,
					pricePerCall: api.pricePerCall?.toString?.() ?? api.pricePerCall,
					active: api.active,
				}));
		} catch (err) {
			console.error("[registry] failed:", err);
			return [];
		}
	}

	async getAPI(apiId: string) {
		try {
			const api = await registry.getAPI(apiId);

			return {
				apiId,
				provider: api.provider,
				name: api.name,
				endpoint: api.endpoint,
				pricePerCall: api.pricePerCall?.toString?.() ?? api.pricePerCall,
				active: api.active,
			};
		} catch {
			return null;
		}
	}

	async getProviderAPIs(providerAddress: string) {
		try {
			const ids: string[] = await registry.getProviderAPIs(providerAddress);

			const results = await Promise.all(
				ids.map(async (id) => {
					const api = await registry.getAPI(id);
					return {
						apiId: id,
						provider: api.provider,
						name: api.name,
						endpoint: api.endpoint,
						pricePerCall: api.pricePerCall.toString(),
						active: api.active,
					};
				})
			);

			return results;
		} catch (err) {
			console.error("[registry] getProviderAPIs failed:", err);
			return [];
		}
	}

	async totalAPIs(): Promise<number> {
		try {
			const total = await registry.totalAPIs();
			return Number(total);
		} catch (err) {
			console.error("[registry] totalAPIs failed:", err);
			return 0;
		}
	}

	// Register a new API on-chain (called by provider via backend)
	async registerAPI(
		name: string,
		endpoint: string,
		pricePerCall: bigint
	): Promise<{ apiId: string; txHash: string } | null> {
		try {
			const registryWithSigner = registry.connect(signer) as typeof registry;
			const tx = await registryWithSigner.registerAPI(name, endpoint, pricePerCall);
			const receipt = await tx.wait();

			// Extract apiId from APIRegistered event
			const iface = registry.interface;
			let apiId = "";
			for (const log of receipt.logs) {
				try {
					const parsed = iface.parseLog(log);
					if (parsed && parsed.name === "APIRegistered") {
						apiId = parsed.args.apiId;
						break;
					}
				} catch {}
			}

			return { apiId, txHash: receipt.hash };
		} catch (err: any) {
			console.error("[registry] registerAPI failed:", err);
			return null;
		}
	}

	// Update API price / active status on-chain (provider only)
	async updateAPI(
		apiId: string,
		newPrice: bigint,
		active: boolean
	): Promise<{ txHash: string } | null> {
		try {
			const registryWithSigner = registry.connect(signer) as typeof registry;
			const tx = await registryWithSigner.updateAPI(apiId, newPrice, active);
			const receipt = await tx.wait();
			return { txHash: receipt.hash };
		} catch (err: any) {
			console.error("[registry] updateAPI failed:", err);
			return null;
		}
	}

	// Replay PaymentSettled events from X402Facilitator to rebuild the ledger
	// after a server restart. The chain is the source of truth.
	// Paginates in 5000-block chunks to respect Morph Hoodi RPC limits.
	async replayLedgerFromChain(ledger: import("./ledger.service").LedgerService): Promise<void> {
		try {
			console.log("[ledger] Replaying PaymentSettled events from chain...");

			const CHUNK = 5000;
			const latest = await provider.getBlockNumber();
			const EXPLORER = "https://explorer-hoodi.morphl2.io/tx";
			const deployBlock = Number(process.env.FACILITATOR_DEPLOY_BLOCK ?? 5520000);

			// Build a name lookup from the registry for provider address → API name
			const allAPIs = await this.getAllAPIs();

			let allEvents: ethers.EventLog[] = [];

			// Paginate from deployBlock to latest in 5000-block chunks
			let chunksScanned = 0;
			for (let from = deployBlock; from <= latest; from += CHUNK) {
				const to = Math.min(from + CHUNK - 1, latest);
				try {
					const filter = facilitator.filters.PaymentSettled();
					const chunk = await facilitator.queryFilter(filter, from, to);
					allEvents = allEvents.concat(chunk as ethers.EventLog[]);
				} catch {
					// Skip chunks that fail — non-fatal
				}
				chunksScanned++;
				// Log progress every 5 chunks (25000 blocks)
				if (chunksScanned % 5 === 0) {
					const scanned = from - deployBlock;
					const total = latest - deployBlock;
					const pct = total > 0 ? Math.round((scanned / total) * 100) : 100;
					console.log(
						`[ledger] Scanning... block ${from}/${latest} (${pct}%) — ${allEvents.length} events found`
					);
				}
			}

			if (!allEvents.length) {
				console.log("[ledger] No past events found");
				return;
			}

			for (const e of allEvents) {
				if (!e.args) continue;

				const payer = e.args[0] as string;
				const prov = e.args[1] as string;
				const amount = e.args[2] as bigint;
				const fee = e.args[3] as bigint;
				const nonce = e.args[4] as string;
				const apiId = e.args[5] as string; // bytes32 — added in v2 contract
				const txHash = e.transactionHash;

				// Resolve apiId → apiName from registry
				let resolvedApiId = apiId && apiId !== ethers.ZeroHash ? apiId : "";
				let resolvedApiName = "";

				if (resolvedApiId) {
					const matched = allAPIs.find((a) => a.apiId === resolvedApiId);
					resolvedApiName = matched?.name ?? "";
				}

				// Fallback for old events (pre-v2 contract) that have no apiId
				if (!resolvedApiName) {
					const nonceMeta = nonceService.getMeta(nonce);
					if (nonceMeta?.apiName) {
						resolvedApiId = nonceMeta.apiId;
						resolvedApiName = nonceMeta.apiName;
					}
				}

				if (!resolvedApiName) {
					resolvedApiName = `API (provider: ${prov.slice(0, 10)}...)`;
				}

				const block = await provider.getBlock(e.blockNumber);
				const timestamp = block ? block.timestamp * 1000 : Date.now();

				ledger.record({
					txHash,
					apiId: resolvedApiId,
					apiName: resolvedApiName,
					payer,
					provider: prov,
					amount: amount.toString(),
					amountUsd: (Number(amount) / 1_000_000).toFixed(6),
					fee: fee.toString(),
					nonce,
					timestamp,
					explorerUrl: `${EXPLORER}/${txHash}`,
				});
			}

			console.log(`[ledger] Replayed ${allEvents.length} past payment(s) from chain`);
		} catch (err: any) {
			console.warn("[ledger] Replay failed (non-fatal):", err.message);
		}
	}

	// USDC bal
	async getUSDCBalance(address: string) {
		try {
			const usdc = new ethers.Contract(
				process.env.USDC_ADDRESS!,
				[
					"function balanceOf(address) view returns (uint256)",
					"function decimals() view returns (uint8)",
				],
				provider
			);

			const [balance, decimals] = await Promise.all([
				usdc.balanceOf(address),
				usdc.decimals(),
			]);

			return ethers.formatUnits(balance, decimals);
		} catch {
			return "0";
		}
	}
}

export const blockchainService = new BlockchainService();
