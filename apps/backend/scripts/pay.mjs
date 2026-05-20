/**
 * pay.mjs — end-to-end x402 payment test
 *
 * Usage:
 *   node scripts/pay.mjs
 *
 * Reads all config from apps/backend/.env
 * Requires the backend to be running: pnpm dev
 *
 * Uses the standard single X-Payment header (base64-encoded JSON).
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const __dir   = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
const env     = Object.fromEntries(
	readFileSync(envPath, "utf8")
		.split("\n")
		.filter((l) => l.trim() && !l.startsWith("#"))
		.map((l) => {
			const idx = l.indexOf("=");
			return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
		})
		.filter(([k, v]) => k && v)
);

const GATEWAY     = "http://localhost:3001";
const FACILITATOR = env.X402_FACILITATOR_ADDRESS;
const PROVIDER    = env.PROVIDER_ADDRESS;
const AGENT_KEY   = env.GATEWAY_PRIVATE_KEY;

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
console.log("1. Fetching nonce...");
const nonceRes = await fetch(`${GATEWAY}/payment/nonce`);
if (!nonceRes.ok) {
	console.error("ERROR: Could not reach gateway. Is `pnpm dev` running?");
	process.exit(1);
}
const { nonce, deadline } = await nonceRes.json();
console.log("   nonce   :", nonce);
console.log("   deadline:", deadline, `(~${Math.round((deadline - Date.now() / 1000) / 60)} min)`);
console.log("");

// ---------------------------------------------------------------------------
// Step 2 — sign the payment message
// keccak256(abi.encodePacked(facilitator, payer, provider, amount, nonce, deadline))
// ---------------------------------------------------------------------------
console.log("2. Signing payment...");
const encoded   = ethers.solidityPacked(
	["address", "address", "address", "uint256", "bytes32", "uint256"],
	[FACILITATOR, PAYER, PROVIDER, AMOUNT, nonce, deadline]
);
const hash      = ethers.keccak256(encoded);
const signature = await wallet.signMessage(ethers.getBytes(hash));
console.log("   signature:", signature.slice(0, 20) + "...");
console.log("");

// ---------------------------------------------------------------------------
// Step 3 — build the single X-Payment header (base64-encoded JSON)
// ---------------------------------------------------------------------------
const paymentPayload = {
	payer:     PAYER,
	provider:  PROVIDER,
	amount:    AMOUNT.toString(),
	nonce,
	deadline,
	signature,
};
const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
console.log("3. X-Payment header built (base64 JSON)");
console.log("   payload:", JSON.stringify(paymentPayload, null, 2));
console.log("");

// ---------------------------------------------------------------------------
// Step 4 — pre-flight verify
// ---------------------------------------------------------------------------
console.log("4. Pre-flight verify...");
const verifyRes = await fetch(`${GATEWAY}/payment/verify`, {
	method:  "POST",
	headers: { "Content-Type": "application/json" },
	body:    JSON.stringify(paymentPayload),
});
const verifyBody = await verifyRes.json();
if (!verifyBody.valid) {
	console.error("ERROR: Pre-flight failed:", verifyBody);
	process.exit(1);
}
console.log("   valid:", verifyBody.valid);
console.log("");

// ---------------------------------------------------------------------------
// Step 5 — call the paid endpoint with single X-Payment header
// ---------------------------------------------------------------------------
console.log("5. Calling GET /api/v1/btc with X-Payment header...");
const apiRes = await fetch(`${GATEWAY}/api/v1/call/0xd0241e382a4fe68a0f61a74d98b2f58065624cc423dcfa31505f2e8e55119015`, {
	headers: {
		"X-Payment": xPaymentHeader,
	},
});

const apiBody = await apiRes.json();
console.log("   HTTP status:", apiRes.status);
console.log("   Response   :", JSON.stringify(apiBody, null, 2));

if (apiRes.status === 200) {
	console.log("\nPayment accepted. Settlement processing on-chain.");
	console.log("Check /dashboard/" + PAYER + " for tx history.");
} else {
	console.log("\nPayment rejected. See response above.");
}
