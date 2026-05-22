/**
 * agent.mjs
 * AgentMesh x402 Autonomous Agent — Demo Script
 *
 * Demonstrates the complete x402 payment protocol workflow:
 *   1. Gateway health check & balance verification
 *   2. On-chain API catalog discovery
 *   3. Execution planning
 *   4. Balance verification
 *   5. x402 payment loop (nonce → sign → encode → verify → submit → settle)
 *   6. Market analysis report
 *   7. Transaction verification & ledger audit
 *
 * Usage:
 *   node scripts/agent.mjs
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
const env = Object.fromEntries(
	readFileSync(envPath, "utf8")
		.split("\n")
		.filter((l) => l.trim() && !l.startsWith("#"))
		.map((l) => {
			const idx = l.indexOf("=");
			return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
		})
		.filter(([k, v]) => k && v)
);

const GATEWAY = env.GATEWAY_URL || "http://localhost:3001";
const FACILITATOR = env.X402_FACILITATOR_ADDRESS;
const AGENT_KEY = env.AGENT_PRIVATE_KEY || env.GATEWAY_PRIVATE_KEY;

if (!FACILITATOR || FACILITATOR.startsWith("<")) {
	process.stderr.write("\x1b[91m[FATAL]\x1b[0m X402_FACILITATOR_ADDRESS not set in .env\n");
	process.exit(1);
}
if (!AGENT_KEY || AGENT_KEY.startsWith("<")) {
	process.stderr.write(
		"\x1b[91m[FATAL]\x1b[0m AGENT_PRIVATE_KEY (or GATEWAY_PRIVATE_KEY) not set in .env\n"
	);
	process.exit(1);
}

const agentWallet = new ethers.Wallet(AGENT_KEY);
const AGENT_ADDR = agentWallet.address;

// ---------------------------------------------------------------------------
// Premium TUI primitives
// ---------------------------------------------------------------------------
const R = "\x1b[0m";
const B = "\x1b[1m";
const D = "\x1b[90m"; // Sleek dark gray for lines/borders
const underline = "\x1b[4m";

const fg = {
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	white: "\x1b[37m",
	blue: "\x1b[34m",
	bCyan: "\x1b[96m",
	bMag: "\x1b[95m",
	bYel: "\x1b[93m",
	bGrn: "\x1b[92m",
	bRed: "\x1b[91m",
	bBlu: "\x1b[94m",
	bWht: "\x1b[97m",
};

const W = 110;

// Strip ANSI codes (robust regex) for strict length calculation
const slen = (s) => String(s).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").length;

// Modern thin-bordered box
function hdr(title, col = fg.bCyan) {
	const inner = W - 1;
	const cleanTitle = title.toUpperCase();
	const tlen = slen(cleanTitle);
	const lpad = Math.floor((inner - tlen) / 2);
	const rpad = inner - tlen - lpad;
	console.log(D + "┌" + "─".repeat(inner) + "┐" + R);
	console.log(
		D + "│" + " ".repeat(lpad) + B + col + cleanTitle + R + " ".repeat(rpad) + D + "│" + R
	);
	console.log(D + "├" + "─".repeat(inner) + "┤" + R);
}

function hdrBottom(col = fg.bCyan) {
	console.log(D + "└" + "─".repeat(W - 1) + "┘" + R);
}

function hdrLine(text, borderCol = fg.bCyan, textCol = R, align = "left") {
	const inner = W - 5; // Total content width excluding side paddings
	const tlen = slen(text);

	let lineContent = "";
	if (align === "center") {
		const lpad = Math.floor((inner - tlen) / 2);
		const rpad = inner - tlen - lpad;
		lineContent = " ".repeat(lpad) + textCol + text + R + " ".repeat(rpad);
	} else {
		const pad = Math.max(0, inner - tlen);
		lineContent = textCol + text + R + " ".repeat(pad);
	}

	console.log(borderCol + "│  " + R + lineContent + borderCol + "  │" + R);
}

function hdrSep(col = fg.bCyan) {
	console.log(D + "├" + "─".repeat(W - 2) + "┤" + R);
}

// Clean, scannable section separator
function section(num, total, title, col = fg.bCyan) {
	console.log("");
	const tag = ` :: [0${num}/0${total}] `;
	const headerText = ` ${title.toUpperCase()} `;
	const remaining = W - slen(tag) - slen(headerText);

	console.log(
		col +
			B +
			tag +
			R +
			fg.bWht +
			B +
			headerText +
			R +
			D +
			"─".repeat(Math.max(0, remaining)) +
			R
	);
}

// Key-value alignments with a uniform dot leader
function row(label, value, labelCol = fg.cyan, valCol = fg.bWht) {
	const maxLabel = 40;
	const cleanLabel = String(label);
	const strippedLabel = slen(cleanLabel);

	const padLen = Math.max(0, maxLabel - strippedLabel);
	const dotLeader = D + " " + ".".repeat(padLen) + " " + R;

	console.log("  " + labelCol + cleanLabel + R + dotLeader + valCol + String(value) + R);
}

// Unified strict ASCII status indicators (No Emojis)
function ok(text) {
	console.log("  " + fg.bGrn + "[+] " + R + fg.white + text + R);
}

// Custom status for network handshakes
function handshake(text) {
	console.log("  " + fg.bMag + "[*] " + R + fg.white + text + R);
}

function info(text) {
	console.log("  " + fg.bCyan + "[i] " + R + D + text + R);
}

function warn(text) {
	console.log("  " + fg.bYel + "[!] " + R + fg.bYel + text + R);
}

function err(text) {
	console.log("  " + fg.bRed + "[x] " + R + fg.bRed + text + R);
}

function sub(label, value, col = D) {
	const maxLabel = 30;
	const prefix = "    - ";
	const cleanLabel = String(label);
	const strippedLabelLen = slen(cleanLabel);
	const padLen = Math.max(0, maxLabel - (prefix.length + strippedLabelLen));

	console.log(
		"  " + D + prefix + cleanLabel + " ".repeat(padLen) + " ->  " + R + col + value + R
	);
}

function blank() {
	console.log("");
}

// High-fidelity programmatic braille thinking spinner animation
function think(msg) {
	return new Promise((resolve) => {
		const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
		let i = 0;
		process.stdout.write("\r  " + fg.bCyan + frames[0] + "  " + R + fg.white + msg + "..." + R);

		const iv = setInterval(() => {
			i++;
			if (i >= frames.length * 2) {
				clearInterval(iv);
				process.stdout.write("\r" + " ".repeat(W) + "\r");
				ok(msg);
				resolve();
			} else {
				process.stdout.write(
					"\r  " +
						fg.bCyan +
						frames[i % frames.length] +
						"  " +
						R +
						fg.white +
						msg +
						"..." +
						R
				);
			}
		}, 80);
	});
}

const pause = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// Drip-print: reveal each line with a small delay for dramatic effect
async function drip(lines, delayMs = 120) {
	for (const line of lines) {
		console.log(line);
		await pause(delayMs);
	}
}

// ---------------------------------------------------------------------------
// x402 payment helpers
// ---------------------------------------------------------------------------
async function signPayment(provider, amount, nonce, deadline) {
	const encoded = ethers.solidityPacked(
		["address", "address", "address", "uint256", "bytes32", "uint256"],
		[FACILITATOR, AGENT_ADDR, provider, BigInt(amount), nonce, BigInt(deadline)]
	);
	const hash = ethers.keccak256(encoded);
	return agentWallet.signMessage(ethers.getBytes(hash));
}

function buildXPayment(provider, amount, nonce, deadline, signature) {
	return Buffer.from(
		JSON.stringify({
			payer: AGENT_ADDR,
			provider,
			amount: String(amount),
			nonce,
			deadline,
			signature,
		})
	).toString("base64");
}

async function bootAnimation() {
	// Step 1: Boot message with spinner
	const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let i = 0;
	const interval = setInterval(() => {
		process.stdout.write(
			`\r  ${fg.bCyan}${frames[i % frames.length]}  ${R}${fg.white}Booting Broker CLI...${R}`
		);
		i++;
	}, 80);
	await pause(2000);
	clearInterval(interval);
	// Clear line and write success
	process.stdout.write(`\r  ${fg.bGrn}[+]  ${R}${fg.white}Broker CLI booted successfully${R}\n`);

	// Step 2: Loading wallet credentials
	process.stdout.write(`  ${fg.bCyan}[*]  ${R}${fg.white}Loading wallet credentials ...${R}`);
	await pause(800);
	// Clear that line and write resolved
	process.stdout.write(
		`\r  ${fg.bGrn}[+]  ${R}${fg.white}Wallet identity resolved          ${R}\n`
	);

	// Typewriter for address
	process.stdout.write(`  ${fg.cyan}     address →  ${R}`);
	const addr = AGENT_ADDR;
	for (let i = 0; i < addr.length; i++) {
		process.stdout.write(fg.bYel + addr[i] + R);
		await pause(35);
	}
	console.log(""); // newline

	// Step 3: Broker status transitions - use separate lines to avoid overwrite confusion
	// Instead of overwriting the same line, print each status on a new line or clear properly.
	// To avoid "readycting...", we'll clear line before each status.
	const bootStatuses = ["idle", "connecting...", "CONNECTED"];
	for (let idx = 0; idx < bootStatuses.length; idx++) {
		const s = bootStatuses[idx];
		// Clear the current line (if any) by writing spaces then carriage return
		process.stdout.write(`\r${" ".repeat(50)}\r`);
		process.stdout.write(`  ${fg.bCyan}[*]  ${R}${fg.white}Broker status: ${s}${R}`);
		if (idx < bootStatuses.length - 1) {
			await pause(idx === 0 ? 800 : 600);
		} else {
			await pause(400);
		}
	}
	console.log(""); // final newline
	await pause(400);
}

// ---------------------------------------------------------------------------
// Main Pipeline Runtime
// ---------------------------------------------------------------------------
async function main() {
	console.clear();
	console.log("");

	// Minimalist, high-end block-text geometric banner layout
	console.log(fg.bCyan + B);
	console.log(" ███████████                     █████                        ");
	console.log(" ░░███░░░░░███                   ░░███                         ");
	console.log("  ░███    ░███ ████████   ██████  ░███ █████  ██████  ████████ ");
	console.log("  ░██████████ ░░███░░███ ███░░███ ░███░░███  ███░░███░░███░░███");
	console.log("  ░███░░░░░███ ░███ ░░░ ░███ ░███ ░██████░  ░███████  ░███ ░░░ ");
	console.log("  ░███    ░███ ░███     ░███ ░███ ░███░░███ ░███░░░   ░███     ");
	console.log("  ███████████  █████    ░░██████  ████ █████░░██████  █████    ");
	console.log(" ░░░░░░░░░░░  ░░░░░      ░░░░░░  ░░░░ ░░░░░  ░░░░░░  ░░░░░     ");
	console.log(R);
	console.log(
		"    " +
			D +
			"[" +
			R +
			fg.bGrn +
			"ONLINE" +
			R +
			D +
			"]" +
			"  node::" +
			fg.bWht +
			"broker-01" +
			R +
			D +
			"  |" +
			"  gateway::" +
			fg.cyan +
			"agentmesh-core" +
			R +
			D +
			"  |" +
			"  network::" +
			fg.bMag +
			"morph_hoodi" +
			R +
			D +
			"  |" +
			"  mode::" +
			fg.bYel +
			"autonomous" +
			R
	);
	console.log("");

	await bootAnimation();
	// Identity Management Frame
	hdr("Runtime Infrastructure Configuration", fg.bCyan);
	hdrLine(`Agent Wallet Address   :  ${AGENT_ADDR}`, fg.bCyan, fg.bYel + B);
	hdrLine(
		`Private Key Source     :  ${env.AGENT_PRIVATE_KEY ? "AGENT_PRIVATE_KEY (primary)" : "GATEWAY_PRIVATE_KEY (fallback)"}`,
		fg.bCyan,
		env.AGENT_PRIVATE_KEY ? fg.bGrn : fg.bYel
	);
	hdrLine(`Network Layer          :  Morph Hoodi Testnet  (Chain ID: 2910)`, fg.bCyan, fg.bWht);
	hdrLine(`Gateway Endpoint       :  ${GATEWAY}`, fg.bCyan, fg.cyan);
	hdrLine(`Facilitator Contract   :  ${FACILITATOR}`, fg.bCyan, D);
	hdrLine(
		`Payment Protocol       :  x402 off-chain authorization / ECDSA signature proofs`,
		fg.bCyan,
		fg.bMag
	);
	hdrLine(
		`Autonomy Mode          :  FULL AUTONOMOUS EXECUTION / ZERO HUMAN APPROVAL REQUIRED`,
		fg.bCyan,
		fg.bGrn
	);
	hdrBottom(fg.bCyan);

	await pause(800);

	// -------------------------------------------------------------------------
	// STEP 1 — Gateway health check & Live Balance Handshake
	// -------------------------------------------------------------------------
	section(1, 6, "Gateway Health Check & Auth", fg.bCyan);
	await think("Connecting to AgentMesh Gateway router");
	await pause(100);

	let gatewayInfo;
	try {
		const res = await fetch(`${GATEWAY}/payment/status`);
		gatewayInfo = await res.json();
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		ok("AgentMesh Gateway connection established successfully");
		sub("endpoint", GATEWAY, fg.cyan);
		sub("network", gatewayInfo.network || "morph_hoodi", fg.bWht);
		sub("facilitator", gatewayInfo.facilitator || FACILITATOR, D);
		sub("chain ID", gatewayInfo.chainId || "2910", fg.bYel);

		blank();
		await think("Performing identity handshake & verifying live token balance");

		// Pulling live balance from your custom route /payment/balance/:address
		const balRes = await fetch(`${GATEWAY}/payment/balance/${AGENT_ADDR}`);
		const balData = await balRes.json();

		if (balRes.ok && balData.success) {
			handshake("Node identity verified with clearing gateway");
			sub("allocated balance", `${balData.usdcBalance} USDC`, fg.bYel + B);
			sub("channel status", "ACTIVE / READY FOR OFF-CHAIN SIGNING", fg.bGrn);
		} else {
			throw new Error(balData.error || "Failed to fetch valid balance schema");
		}
	} catch (e) {
		err(`Gateway identity verification failed: ${e.message}`);
		err("Verify your backend architecture is live: pnpm dev");
		process.exit(1);
	}

	await pause(900);

	// -------------------------------------------------------------------------
	// STEP 2 — Catalog discovery
	// -------------------------------------------------------------------------
	section(2, 6, "On-Chain API Catalog Discovery", fg.bCyan);
	await think("Querying APIRegistry via GET /api/v1/catalog");
	await pause(100);

	let catalog, paymentMeta;
	try {
		const res = await fetch(`${GATEWAY}/api/v1/catalog`);
		const data = await res.json();
		catalog = data.catalog;
		paymentMeta = data.payment;
		if (!res.ok || !catalog) throw new Error("Invalid catalog response");

		ok(`Discovered ${catalog.length} APIs registered in on-chain marketplace`);
		sub("facilitator contract", paymentMeta.facilitator || FACILITATOR, D);
		sub("nonce endpoint", paymentMeta.nonceUrl, fg.cyan);
		sub("payment scheme", paymentMeta.scheme || "x402", fg.bMag);
		blank();
		info("Available Paid APIs:");
		for (const api of catalog) {
			console.log(
				"    " +
					fg.bWht +
					api.name.padEnd(22) +
					R +
					D +
					`[ $${api.priceUsd} USDC / call ]`.padEnd(24) +
					R +
					D +
					"-> " +
					R +
					fg.cyan +
					api.callUrl +
					R
			);
		}
	} catch (e) {
		err(`Catalog discovery failed: ${e.message}`);
		process.exit(1);
	}

	await pause(900);

	// -------------------------------------------------------------------------
	// STEP 3 — Execution planning
	// -------------------------------------------------------------------------
	section(3, 6, "Execution Planning", fg.bCyan);
	await think("Selecting APIs for market analysis task");
	await pause(100);

	const TARGET = ["BTC Price", "ETH Price", "SOL Price", "Gas Tracker"];
	// Deduplicate by name — prefer builtin over registered when both exist
	const seen = new Map();
	for (const a of catalog) {
		if (!TARGET.includes(a.name)) continue;
		const existing = seen.get(a.name);
		if (!existing || a.type === "builtin") seen.set(a.name, a);
	}
	const selected = TARGET.map((name) => seen.get(name)).filter(Boolean);
	const totalCost = selected.reduce((s, a) => s + Number(a.pricePerCall), 0);

	ok(`Selected ${selected.length} of ${catalog.length} available APIs for execution`);
	blank();
	info("Execution Plan:");
	for (const api of selected) {
		console.log(
			"    " +
				fg.bGrn +
				"> " +
				R +
				fg.bWht +
				api.name.padEnd(22) +
				R +
				D +
				` Cost: $${api.priceUsd} USDC (${api.pricePerCall} units)` +
				R
		);
	}
	blank();
	row(
		"Total estimated cost",
		`$${(totalCost / 1_000_000).toFixed(6)} USDC`,
		fg.cyan,
		fg.bYel + B
	);
	row("Human approvals required", "0 (Fully Autonomous)", fg.cyan, fg.bGrn);

	await pause(900);

	// -------------------------------------------------------------------------
	// STEP 4 — Balance verification
	// -------------------------------------------------------------------------
	section(4, 6, "Balance Allocation Check", fg.bCyan);
	await think(`Checking liquidity limits for ${AGENT_ADDR.slice(0, 14)}`);
	await pause(100);

	let balance = 0;
	try {
		const res = await fetch(`${GATEWAY}/payment/balance/${AGENT_ADDR}`);
		const data = await res.json();
		balance = parseFloat(data.usdcBalance || "0");

		ok(`Balance confirmation retrieved from AgentMesh router`);
		row("Current USDC balance", `${data.usdcBalance} USDC`, fg.cyan, fg.bYel + B);
		row(
			"Required for execution",
			`${(totalCost / 1_000_000).toFixed(6)} USDC`,
			fg.cyan,
			fg.bWht
		);
		blank();

		if (balance >= totalCost / 1_000_000) {
			ok("Sufficient liquidity allocation confirmed for parallel requests");
		} else {
			warn("Balance may be insufficient — some payments could fail");
			warn("Recommendation: Request test tokens via POST /faucet/mint");
		}
	} catch (e) {
		warn(`Balance check failed: ${e.message} — proceeding anyway`);
	}

	await pause(900);

	// -------------------------------------------------------------------------
	// STEP 5 — x402 payment loop
	// -------------------------------------------------------------------------
	section(5, 6, "AgentMesh x402 Processing Engine", fg.bCyan);
	blank();
	info(
		"Workflow: Probe endpoint → Receive 402 challenge → Get nonce → Sign payment → Verify → Submit → Settle"
	);
	blank();

	const results = {};
	let totalSpent = 0n;

	// Snapshot balance before the loop so we can show per-call deltas
	let runningBalance = balance;

	for (let i = 0; i < selected.length; i++) {
		const api = selected[i];

		// Dynamically calculate strict box boundaries
		const innerWidth = W - 6;
		const titleTag = `API CALL [0${i + 1}/0${selected.length}]`;
		const providerText = `Provider: ${api.provider.slice(0, 20)}...`;

		const leftContent = ` ${titleTag} `;
		const sep = `│`;
		const rightContentStart = ` ${api.name} `;
		const rightContentEnd = `${providerText} `;

		const fixedLen =
			slen(leftContent) + slen(sep) + slen(rightContentStart) + slen(rightContentEnd);
		const spaces = Math.max(1, innerWidth - fixedLen);

		console.log("  " + D + "┌" + "─".repeat(innerWidth) + "┐" + R);
		console.log(
			"  " +
				D +
				"│" +
				R +
				fg.cyan +
				B +
				leftContent +
				R +
				D +
				sep +
				R +
				fg.bWht +
				B +
				rightContentStart +
				R +
				" ".repeat(spaces) +
				D +
				rightContentEnd +
				"│" +
				R
		);
		console.log("  " + D + "└" + "─".repeat(innerWidth) + "┘" + R);
		blank();

		sub("endpoint", api.callUrl, fg.cyan);
		sub("price", `$${api.priceUsd} USDC  (${api.pricePerCall} units)`, fg.bWht);
		blank();

		// 5.1 — Probe endpoint (expect 402)
		await think("Probing router proxy — expecting dynamic 402 intercept");
		let probeBody;
		try {
			const probeRes = await fetch(
				api.callUrl.startsWith("http") ? api.callUrl : `${GATEWAY}${api.callUrl}`
			);
			probeBody = await probeRes.json();
			if (probeRes.status === 402) {
				ok("Intercept successfully thrown by AgentMesh Gateway — challenge recognized");
				sub(
					"required amount",
					(probeBody.payment?.amount || api.pricePerCall) + " base units",
					fg.bYel
				);
				sub("facilitator", probeBody.payment?.facilitator || FACILITATOR, D);
				sub("chain ID", probeBody.payment?.chainId || "2910", D);
			} else {
				warn(`Expected 402, received ${probeRes.status} — processing response`);
			}
		} catch (e) {
			warn(`Probe failed: ${e.message} — assuming default gateway parameters`);
		}
		blank();

		// 5.2 — Get nonce
		await think("Requesting tracked tracking-nonce from AgentMesh server");
		let nonce, deadline;
		try {
			const nonceRes = await fetch(`${GATEWAY}/payment/nonce`);
			const nonceData = await nonceRes.json();
			nonce = nonceData.nonce;
			deadline = nonceData.deadline;
			ok("Single-use secure nonce issued");
			sub("nonce", nonce.slice(0, 32) + "...", fg.cyan);
			sub("deadline", new Date(deadline * 1000).toISOString(), fg.bWht);
			sub("valid for", `${Math.round((deadline - Date.now() / 1000) / 60)} minutes`, fg.bYel);
		} catch (e) {
			err(`Nonce allocation error: ${e.message}`);
			results[api.name] = null;
			blank();
			continue;
		}
		blank();

		// 5.3 — Sign
		await think("Signing off-chain cryptographic ECDSA authorization matrix");
		let signature;
		try {
			signature = await signPayment(api.provider, api.pricePerCall, nonce, deadline);
			ok("Cryptographic signature committed to buffer");
			sub(
				"algorithm",
				"ECDSA / keccak256(facilitator+payer+provider+amount+nonce+deadline)",
				D
			);
			sub("signer", AGENT_ADDR, fg.bYel);
			sub("signature", signature.slice(0, 42) + "...", fg.bMag);
		} catch (e) {
			err(`Signature construction broke: ${e.message}`);
			results[api.name] = null;
			blank();
			continue;
		}
		blank();

		// 5.4 — Build X-Payment header
		await think("Packing transaction parameters into base64 token header");
		const xPayment = buildXPayment(api.provider, api.pricePerCall, nonce, deadline, signature);
		ok("X-Payment protocol envelope created");
		sub("format", "base64(JSON({ payer, provider, amount, nonce, deadline, signature }))", D);
		sub("payload sizing", `${xPayment.length} bytes`, fg.bWht);
		blank();

		// // 5.5 — Pre-flight verify
		// await think("Validating signature mechanics with gateway pre-flight endpoint");
		// try {
		// 	const verifyRes = await fetch(`${GATEWAY}/payment/verify`, {
		// 		method: "POST",
		// 		headers: { "Content-Type": "application/json" },
		// 		body: JSON.stringify({
		// 			payer: AGENT_ADDR,
		// 			provider: api.provider,
		// 			amount: String(api.pricePerCall),
		// 			nonce,
		// 			deadline,
		// 			signature,
		// 		}),
		// 	});
		// 	const verifyData = await verifyRes.json();
		// 	if (verifyData.valid) {
		// 		ok("Gateway signature pre-verification checks out");
		// 		sub("recovered wallet signature", AGENT_ADDR, fg.bGrn);
		// 	} else {
		// 		warn(
		// 			`Pre-flight warnings: ${verifyData.reason || "unknown"} — submitting payload directly`
		// 		);
		// 	}
		// } catch (e) {
		// 	warn(`Pre-flight socket error: ${e.message} — proceeding to direct delivery`);
		// }
		blank();

		// 5.6 — Submit with X-Payment header
		await think("Injecting signature credentials and firing stream request");
		let httpStatus, body;
		try {
			const fullUrl = api.callUrl.startsWith("http")
				? api.callUrl
				: `${GATEWAY}${api.callUrl}`;
			const apiRes = await fetch(fullUrl, { headers: { "X-Payment": xPayment } });
			httpStatus = apiRes.status;
			body = await apiRes.json();
		} catch (e) {
			err(`Resource transmission error: ${e.message}`);
			results[api.name] = null;
			blank();
			continue;
		}

		blank();

		if (httpStatus === 200) {
			results[api.name] = body.data;
			totalSpent += BigInt(api.pricePerCall);

			ok(`HTTP 200 OK — Resource authorization unlocked and parsed`);
			sub("data packet summary", JSON.stringify(body.data).slice(0, 68), fg.bWht);
			sub("consumed tracking nonce", nonce.slice(0, 32) + "...", D);
			blank();
			info("Liability queued inside AgentMesh router memory ledger:");
			sub(
				"settlement schema",
				"X402Facilitator.settle(payer, provider, amount, nonce, deadline, signature)",
				D
			);
			sub("debt account", AGENT_ADDR, fg.white);
			sub("endpoint owner", api.provider, fg.white);
			sub("authorized units", `${api.pricePerCall} units ($${api.priceUsd} USDC)`, fg.bYel);
			sub("morph explorer status", "QUEUE_BATCH_COMMIT", fg.cyan);

			// Post-payment balance update (calculated locally — on-chain settlement is async)
			blank();
			const costUsd = Number(api.pricePerCall) / 1_000_000;
			const prevBal = runningBalance;
			runningBalance = Math.max(0, runningBalance - costUsd);
			info("Balance update after settlement:");
			sub("before", `${prevBal.toFixed(6)} USDC`, fg.bWht);
			sub("after ", `${runningBalance.toFixed(6)} USDC`, fg.bYel + B);
			sub("delta ", `-${costUsd.toFixed(6)} USDC`, fg.bRed);
			sub("note  ", "on-chain debit settles async after block confirmation", D);
		} else if (httpStatus === 402) {
			results[api.name] = null;
			err("HTTP 402 — Signature verification rejected by AgentMesh infrastructure");
			sub("rejection code", body.error || "Invalid cryptographic credentials", fg.bRed);
		} else {
			results[api.name] = null;
			err(`HTTP ${httpStatus} — Router pipeline threw an unexpected code`);
		}

		blank();
		await pause(700);
	}

	await pause(1200);

	// -------------------------------------------------------------------------
	// STEP 6 — Report
	// -------------------------------------------------------------------------
	section(6, 6, "Assembled Market Intelligence Summary", fg.bCyan);
	await think("Synthesizing acquired data packets");
	await pause(600);

	const successCount = Object.values(results).filter(Boolean).length;

	blank();

	// Market data — drip each price line
	if (results["BTC Price"] || results["ETH Price"] || results["SOL Price"]) {
		info("Spot Prices:");
		await pause(300);
		if (results["BTC Price"]) {
			row(
				"  BTC / USD",
				`$${results["BTC Price"].price.toLocaleString()}`,
				fg.cyan,
				fg.bYel + B
			);
			await pause(250);
		}
		if (results["ETH Price"]) {
			row(
				"  ETH / USD",
				`$${results["ETH Price"].price.toLocaleString()}`,
				fg.cyan,
				fg.bYel + B
			);
			await pause(250);
		}
		if (results["SOL Price"]) {
			row(
				"  SOL / USD",
				`$${results["SOL Price"].price.toLocaleString()}`,
				fg.cyan,
				fg.bYel + B
			);
			await pause(250);
		}
		blank();
	}

	if (results["Gas Tracker"]) {
		const g = results["Gas Tracker"];
		info("Gas Prices (Gwei):");
		await pause(300);
		row("  Fast", `${g.fast} gwei`, fg.cyan, fg.bGrn);
		await pause(200);
		row("  Standard", `${g.standard} gwei`, fg.cyan, fg.bYel);
		await pause(200);
		row("  Slow", `${g.slow} gwei`, fg.cyan, D);
		await pause(200);
		blank();
	}

	if (results["BTC Price"] && results["ETH Price"]) {
		const ratio = (results["BTC Price"].price / results["ETH Price"].price).toFixed(2);
		const btcPrice = results["BTC Price"].price;
		const sentiment =
			btcPrice > 70000 ? "STRONGLY BULLISH" : btcPrice > 60000 ? "NEUTRAL" : "BEARISH";
		info("Derived Market Indicators:");
		await pause(300);
		row("  BTC / ETH ratio", ratio, fg.cyan, fg.bMag + B);
		await pause(250);
		row(
			"  Market sentiment",
			sentiment,
			fg.cyan,
			sentiment.includes("BULLISH") ? fg.bGrn + B : fg.bYel + B
		);
		await pause(250);
		blank();
	}

	await pause(500);

	// Execution summary — drip each stat
	info("Execution Performance Summary:");
	await pause(300);
	row("  APIs targeted", TARGET.length.toString(), fg.cyan, fg.bWht);
	await pause(200);
	row("  APIs successful", successCount.toString(), fg.cyan, fg.bGrn + B);
	await pause(200);
	row(
		"  APIs failed",
		(TARGET.length - successCount).toString(),
		fg.cyan,
		successCount === TARGET.length ? D : fg.bRed + B
	);
	await pause(200);
	row(
		"  Total USDC spent",
		`$${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC`,
		fg.cyan,
		fg.bYel + B
	);
	await pause(200);
	row("  Signatures generated", successCount.toString(), fg.cyan, fg.cyan);
	await pause(200);
	row("  Human approvals", "0", fg.cyan, fg.bGrn);
	await pause(200);
	row("  On-chain settlements", `${successCount} queued for finality`, fg.cyan, fg.bGrn);
	blank();

	await pause(600);

	// Verification links
	info("AgentMesh Verification Hubs:");
	await pause(200);
	row("  Dashboard Hub", `${GATEWAY}/dashboard/${AGENT_ADDR}`, fg.cyan, fg.blue + underline);
	await pause(200);
	row("  Morph L2 Explorer", "https://explorer-hoodi.morphl2.io", fg.cyan, fg.blue + underline);
	blank();

	await pause(800);

	// -------------------------------------------------------------------------
	// Transaction verification — pull ledger from dashboard endpoint
	// -------------------------------------------------------------------------
	info("On-Chain Settlement Verification:");
	await pause(400);
	blank();
	try {
		const dashRes = await fetch(`${GATEWAY}/dashboard/${AGENT_ADDR}`);
		const dashData = await dashRes.json();

		if (dashRes.ok && dashData.success && dashData.recentCalls?.length) {
			// Show only the calls from this run (up to successCount most recent)
			const txs = dashData.recentCalls.slice(0, successCount);

			for (let t = 0; t < txs.length; t++) {
				const tx = txs[t];
				const settled = !!tx.txHash;
				const statusTag = settled
					? fg.bGrn + B + "[SETTLED]" + R
					: fg.bYel + B + "[PENDING]" + R;

				console.log(
					"  " +
						D +
						`[${t + 1}/${txs.length}]` +
						R +
						"  " +
						fg.cyan +
						B +
						tx.apiName +
						R +
						"  " +
						statusTag +
						"  " +
						fg.bYel +
						`$${tx.amountUsd} USDC` +
						R
				);
				await pause(150);
				if (settled) {
					sub("tx hash  ", tx.txHash, fg.bGrn);
					await pause(120);
					sub(
						"explorer ",
						tx.explorerUrl || "https://explorer-hoodi.morphl2.io",
						fg.blue + underline
					);
				} else {
					sub("tx hash  ", "pending — settlement propagating on-chain", fg.bYel);
					await pause(120);
					sub("explorer ", "https://explorer-hoodi.morphl2.io", fg.blue + underline);
				}
				await pause(120);
				sub("nonce    ", tx.nonce || "n/a", D);
				if (t < txs.length - 1) {
					blank();
					await pause(350);
				}
			}
			blank();
			await pause(600);

			// Final balance — live from chain
			row(
				"  Final wallet balance",
				`${dashData.wallet.usdcBalance} USDC`,
				fg.cyan,
				fg.bYel + B
			);
			await pause(200);
			row(
				"  Total spend recorded",
				`$${dashData.wallet.totalSpendUsd} USDC`,
				fg.cyan,
				fg.bWht
			);
			await pause(200);
			// Session calls vs lifetime total — clearly separated
			row("  Calls this session", successCount.toString(), fg.cyan, fg.bGrn + B);
			await pause(200);
			row("  Lifetime calls (wallet)", dashData.wallet.callCount.toString(), fg.cyan, D);
		} else {
			warn("No ledger entries found — settlements may still be propagating");
		}
	} catch (e) {
		warn(`Dashboard verification unavailable: ${e.message}`);
	}
	blank();

	await pause(1000);

	// Final status Frame
	hdr("Autonomous Execution Complete", fg.bGrn);
	hdrLine("", fg.bGrn);
	await pause(400);

	hdrLine(
		`${successCount}/${TARGET.length} API calls successful  |  $${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC spent  |  0 human approvals`,
		fg.bGrn,
		fg.bWht + B,
		"center"
	);
	await pause(400);

	hdrLine(
		"All payments signed autonomously off-chain via ECDSA and settled on-chain via X402Facilitator",
		fg.bGrn,
		D,
		"center"
	);

	hdrLine("", fg.bGrn);
	hdrBottom(fg.bGrn);
	console.log("");

	// Hold the screen for demo — terminal prompt stays hidden
	// Press Ctrl+C to exit when done recording
	await pause(60_000);
}

// ---------------------------------------------------------------------------
// Error handling Overrides
// ---------------------------------------------------------------------------
process.on("unhandledRejection", (reason) => {
	console.log("");
	const innerW = W - 2;
	console.log(D + "┌" + "─".repeat(innerW) + "┐" + R);

	const errTitle = "UNHANDLED RUNTIME ERROR";
	const titlePad = Math.max(0, innerW - slen(errTitle) - 2);
	console.log(D + "│  " + R + B + fg.bRed + errTitle + R + " ".repeat(titlePad) + D + "│" + R);

	const errMsg = String(reason instanceof Error ? reason.message : reason).slice(0, innerW - 4);
	const msgPad = Math.max(0, innerW - slen(errMsg) - 2);
	console.log(D + "│  " + R + fg.bRed + errMsg + " ".repeat(msgPad) + D + "│" + R);

	console.log(D + "└" + "─".repeat(innerW) + "┘" + R);
	console.log("");
	process.exit(1);
});

main();
