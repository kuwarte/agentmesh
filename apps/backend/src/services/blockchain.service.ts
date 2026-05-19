import { ethers } from "ethers";
import APIRegistry from "../../../../packages/contracts/out/APIRegistry.sol/APIRegistry.json";
import X402Facilitator from "../../../../packages/contracts/out/X402Facilitator.sol/X402Facilitator.json";

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
			// Option B: gateway calls settle(payer, ...) on behalf of the agent.
			// The contract verifies the signature matches payer, not msg.sender,
			// enabling fully autonomous gateway-mediated settlement.
			const tx = await facilitator.settle(
				payload.payer,
				payload.provider,
				payload.amount,
				payload.nonce,
				payload.deadline,
				payload.signature
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

			const results = await Promise.all(
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

			return results.map((api) => ({
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
	async registerAPI(name: string, endpoint: string, pricePerCall: bigint): Promise<{ apiId: string; txHash: string } | null> {
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
	async updateAPI(apiId: string, newPrice: bigint, active: boolean): Promise<{ txHash: string } | null> {
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
