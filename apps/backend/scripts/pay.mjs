/**
 * pay.mjs — end-to-end x402 payment test
 *
 * Usage:
 *   node scripts/pay.mjs
 *
 * Reads all config from apps/backend/.env
 * Requires the backend to be running: pnpm dev
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env manually (no dotenv dep needed in a script)
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
const env = Object.fromEntries(
	readFileSync(envPath, "utf8")
		.split("\n")
		.filter((l) => l.trim() && !l.startsWith("#"))
		.map((l) => l.split("=").map((s) => s.trim()))
		.filter(([k, v]) => k && v)
);

const GATEWAY         = "http://localhost:3001";
const FACILITATOR     = env.X402_FACILITATOR_ADDRESS;
const PROVIDER        = env.PROVIDER_ADDRESS;
const AGENT_KEY       = env.GATEWAY_PRIVATE_KEY; // reuse anvil key as agent for testing

if (!FACILITATOR || FACILITATOR.startsWith("<")) {
	console.error("ERROR: X402_FACILITATOR_ADDRESS not set in .env");
	process.exit(1);
}
if (!PROVIDER || PROVIDER.startsWith("<")) {
	console.error("ERROR: PROVIDER_ADDRESS not set in .env");
	process.exit(1);
}
if (!AGENT_KEY || AGENT_KEY.startsWith("<")) {
	console.error("ERROR: GATEWAY_PRIVATE_KEY not set in .env");
	process.exit(1);
}

const wallet = new ethers.Wallet(AGENT_KEY);
const PAYER  = wallet.address;
const AMOUNT = 1000n; // 0.001 USDC (6 decimals)

console.log("=== AgentMesh x402 payment test ===");
console.log("Facilitator :", FACILITATOR);
console.log("Provider    :", PROVIDER);
console.log("Payer       :", PAYER);
console.log("");

// ---------------------------------------------------------------------------
// Step 1 — get nonce + deadline from gateway
// ---------------------------------------------------------------------------
console.log("1. Fetching nonce from gateway...");
const nonceRes = await fetch(`${GATEWAY}/payment/nonce`);
if (!nonceRes.ok) {
	console.error("ERROR: Could not reach gateway. Is `pnpm dev` running?");
	process.exit(1);
}
const { nonce, deadline } = await nonceRes.json();
console.log("   nonce   :", nonce);
console.log("   deadline:", deadline, `(expires in ~${Math.round((deadline - Date.now()/1000)/60)} min)`);
console.log("");

// ---------------------------------------------------------------------------
// Step 2 — sign the payment message
// Must match exactly what X402Facilitator.settle() reconstructs:
// keccak256(abi.encodePacked(facilitator, payer, provider, amount, nonce, deadline))
// ---------------------------------------------------------------------------
console.log("2. Signing payment...");
const encoded = ethers.solidityPacked(
	["address", "address", "address", "uint256", "bytes32", "uint256"],
	[FACILITATOR, PAYER, PROVIDER, AMOUNT, nonce, deadline]
);
const hash      = ethers.keccak256(encoded);
const signature = await wallet.signMessage(ethers.getBytes(hash));
console.log("   signature:", signature);
console.log("");

// ---------------------------------------------------------------------------
// Step 3 — optional pre-flight verify
// ---------------------------------------------------------------------------
console.log("3. Pre-flight verify...");
const verifyRes = await fetch(`${GATEWAY}/payment/verify`, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		payer:     PAYER,
		provider:  PROVIDER,
		amount:    AMOUNT.toString(),
		nonce,
		deadline,
		signature,
	}),
});
const verifyBody = await verifyRes.json();
if (!verifyBody.valid) {
	console.error("ERROR: Pre-flight failed:", verifyBody);
	process.exit(1);
}
console.log("   valid:", verifyBody.valid);
console.log("");

// ---------------------------------------------------------------------------
// Step 4 — call the paid endpoint
// ---------------------------------------------------------------------------
console.log("4. Calling paid endpoint GET /api/v1/btc ...");
const apiRes = await fetch(`${GATEWAY}/api/v1/btc`, {
	headers: {
		"x-payment-payer":     PAYER,
		"x-payment-provider":  PROVIDER,
		"x-payment-amount":    AMOUNT.toString(),
		"x-payment-nonce":     nonce,
		"x-payment-deadline":  deadline.toString(),
		"x-payment-signature": signature,
	},
});

const apiBody = await apiRes.json();
console.log("   HTTP status:", apiRes.status);
console.log("   Response   :", JSON.stringify(apiBody, null, 2));

if (apiRes.status === 200) {
	console.log("\nPayment accepted. Settlement is processing on-chain in the background.");
} else {
	console.log("\nPayment rejected. See response above for reason.");
}
