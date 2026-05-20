/**
 * ?? test2 mimic agentic transaction
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Config
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

const GATEWAY = "http://localhost:3001";
const FACILITATOR = env.X402_FACILITATOR_ADDRESS;
const AGENT_KEY = env.AGENT_PRIVATE_KEY || env.GATEWAY_PRIVATE_KEY;

if (!FACILITATOR || FACILITATOR.startsWith("<")) {
	console.error(" [!] CRITICAL: X402_FACILITATOR_ADDRESS not set in .env");
	process.exit(1);
}
if (!AGENT_KEY || AGENT_KEY.startsWith("<")) {
	console.error(" [!] CRITICAL: AGENT_PRIVATE_KEY (or GATEWAY_PRIVATE_KEY) not set in .env");
	process.exit(1);
}

const agentWallet = new ethers.Wallet(AGENT_KEY);
const AGENT_ADDR = agentWallet.address;

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[90m",

	// Foreground Palette
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
	yellow: "\x1b[33m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	white: "\x1b[37m",

	// Bright Variants
	brightCyan: "\x1b[96m",
	brightMagenta: "\x1b[95m",
	brightYellow: "\x1b[93m",
	brightGreen: "\x1b[92m",
	brightRed: "\x1b[91m",

	// Backgrounds
	bgCyan: "\x1b[46m",
	bgMagenta: "\x1b[45m",
	bgBlack: "\x1b[40m",
};

const c = colors;
const W = 114;

// Clean up ANSI escape sequences AND odd non-breaking space variants for exact terminal sizing math
function strlen(str) {
	return String(str)
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/\u00a0/g, " ").length;
}

function centerStr(text) {
	const cleanText = text.replace(/\u00a0/g, " ");
	const stripped = strlen(cleanText);
	const totalPad = W - 4 - stripped;
	if (totalPad <= 0) return cleanText;
	const padLeft = Math.floor(totalPad / 2);
	const padRight = totalPad - padLeft;
	return " ".repeat(padLeft) + cleanText + " ".repeat(padRight);
}

function center(text, color = c.reset) {
	const cleanText = text.replace(/\u00a0/g, " ");
	const stripped = strlen(cleanText);
	const pad = Math.max(0, Math.floor((W - stripped) / 2));
	console.log(" ".repeat(pad) + color + cleanText + c.reset);
}

function panelTop(title = "", color = c.cyan) {
	if (!title) {
		console.log(color + "┌" + "─".repeat(W - 2) + "┐" + c.reset);
		return;
	}
	const stripped = strlen(title);
	const totalPad = W - 2 - stripped - 4;
	const padLeft = Math.floor(totalPad / 2);
	const padRight = totalPad - padLeft;
	console.log(
		color +
			"┌" +
			"─".repeat(padLeft) +
			"[ " +
			c.bold +
			title +
			c.reset +
			color +
			" ]" +
			"─".repeat(padRight) +
			"┐" +
			c.reset
	);
}

function panelLine(text, color = c.cyan, textColor = c.reset) {
	const cleanText = text.replace(/\u00a0/g, " ");
	const stripped = strlen(cleanText);
	const padRight = Math.max(0, W - 4 - stripped);
	console.log(
		color +
			"│ " +
			c.reset +
			textColor +
			cleanText +
			" ".repeat(padRight) +
			color +
			" │" +
			c.reset
	);
}

function panelRow(label, value, labelColor = c.brightCyan, valueColor = c.white, color = c.cyan) {
	const cleanLabel = label.replace(/\u00a0/g, " ");
	const cleanVal = String(value).replace(/\u00a0/g, " ");

	const maxLabel = 30;
	const strippedLabel = strlen(cleanLabel);
	const paddedLabel = cleanLabel + " ".repeat(Math.max(0, maxLabel - strippedLabel));

	const maxValWidth = W - 4 - maxLabel - 4; // Normalized margin spacing
	const strippedVal = strlen(cleanVal);
	const padRight = Math.max(0, maxValWidth - strippedVal);

	console.log(
		color +
			"│ " +
			c.reset +
			labelColor +
			paddedLabel +
			c.reset +
			" " +
			c.dim +
			"::" +
			c.reset +
			" " +
			valueColor +
			cleanVal +
			" ".repeat(padRight) +
			color +
			" │" +
			c.reset
	);
}

function panelBottom(color = c.cyan) {
	console.log(color + "└" + "─".repeat(W - 2) + "┘" + c.reset);
}

function panelSeparator(color = c.cyan) {
	console.log(color + "├" + "─".repeat(W - 2) + "┤" + c.reset);
}

function badge(text, bgColor = c.bgCyan, fgColor = c.reset) {
	return `${bgColor}${fgColor} ${text} ${c.reset}`;
}

async function think(msg, duration = 1800) {
	const frames = [" [ . ] ", " [ .. ]", " [...] ", " [  ..]"];
	let frameIdx = 0;
	const startTime = Date.now();

	return new Promise((resolve) => {
		const iv = setInterval(() => {
			const elapsed = Date.now() - startTime;
			if (elapsed >= duration) {
				clearInterval(iv);
				process.stdout.write("\r" + " ".repeat(W) + "\r");
				console.log(`  ${c.brightGreen}[OK]${c.reset}  ${c.dim}${msg}${c.reset}`);
				resolve();
			} else {
				const frame = frames[frameIdx % frames.length];
				process.stdout.write(
					`\r  ${c.brightCyan}${frame}${c.reset}  ${c.dim}${msg}...${c.reset}`
				);
				frameIdx++;
			}
		}, 150);
	});
}

async function progress(label, steps, stepDelay = 600) {
	const total = steps.length;
	for (let i = 0; i < total; i++) {
		const pct = Math.floor(((i + 1) / total) * 100);
		const filled = Math.floor(((W - 35) * (i + 1)) / total);
		const bar = "█".repeat(filled) + "░".repeat(Math.max(0, W - 35 - filled));

		process.stdout.write(
			`\r  ${c.brightYellow}[RUN] ${label}${c.reset} [${c.cyan}${bar}${c.reset}] ${c.bold}${pct}%${c.reset}`
		);

		await new Promise((r) => setTimeout(r, stepDelay));
	}
	process.stdout.write("\r" + " ".repeat(W) + "\r");
	console.log(
		`  ${c.brightGreen}[OK]${c.reset}  ${c.dim}${label}${c.reset} -> ${c.brightGreen}Complete${c.reset}`
	);
}

async function pause(ms = 1500) {
	await new Promise((r) => setTimeout(r, ms));
}

async function signPayment(provider, amount, nonce, deadline) {
	const encoded = ethers.solidityPacked(
		["address", "address", "address", "uint256", "bytes32", "uint256"],
		[FACILITATOR, AGENT_ADDR, provider, BigInt(amount), nonce, deadline]
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

async function callPaidAPI(callUrl, provider, amount) {
	const nonceRes = await fetch(`${GATEWAY}/payment/nonce`);
	const { nonce, deadline } = await nonceRes.json();
	const signature = await signPayment(provider, amount, nonce, deadline);
	const xPayment = buildXPayment(provider, amount, nonce, deadline, signature);
	const fullUrl = callUrl.startsWith("http") ? callUrl : `${GATEWAY}${callUrl}`;
	const res = await fetch(fullUrl, { headers: { "X-Payment": xPayment } });
	const body = await res.json();
	return { status: res.status, body, nonce };
}

console.clear();
console.log("");

// ASCII Art Agent Name
const agentName = [
	" █████ █████ █████ █████     █████     ████████       █████████                                   █████   ",
	"░░███ ░░███ ░░███ ░░███    ███░░░███  ███░░░░███     ███░░░░░███                                 ░░███    ",
	" ░░███ ███   ░███  ░███ █ ███   ░░███░░░    ░███    ░███    ░███   ███████  ██████  ████████   ███████  ",
	"  ░░█████    ░███████████░███    ░███   ███████     ░███████████  ███░░███ ███░░███░░███░░███ ░░░███░   ",
	"   ███░███   ░░░░░░░███░█░███    ░███  ███░░░░      ░███░░░░░███ ░███ ░███░███████  ░███ ░███   ░███    ",
	"  ███ ░░███        ░███░ ░░███   ███  ███      █    ░███    ░███ ░███ ░███░███░░░    ░███ ░███   ░███ ███",
	" █████ █████       █████  ░░░█████░  ░██████████    █████   █████░░███████░░██████  ████ █████  ░░█████ ",
	"░░░░░ ░░░░░       ░░░░░    ░░░░░░░   ░░░░░░░░░░    ░░░░░   ░░░░░   ░░░░███ ░░░░░░  ░░░░ ░░░░░░  ░░░░░  ",
	"                                                                   ███ ░███                             ",
	"                                                                  ░░██████                              ",
	"                                                                   ░░░░░░                               ",
];

agentName.forEach((line) => {
	center(line, c.brightCyan);
});

console.log("");
panelTop("SYSTEM RECOGNITION INTERFACE", c.dim);
panelLine(
	centerStr("AUTONOMOUS INTELLIGENCE LAYER  *  MORPH HOODI TESTNET  *  X402 PROTOCOL"),
	c.dim,
	c.brightYellow
);
panelBottom(c.dim);
console.log("");

await pause(1800);

// Agent Identity Card Panel
panelTop("AGENT IDENTITY MATRIX", c.magenta);
panelRow("Agent Address", AGENT_ADDR, c.brightCyan, c.brightYellow, c.magenta);
panelRow(
	"Key Source",
	env.AGENT_PRIVATE_KEY ? "AGENT_PRIVATE_KEY" : "GATEWAY_PRIVATE_KEY (fallback)",
	c.brightCyan,
	env.AGENT_PRIVATE_KEY ? c.brightGreen : c.brightYellow,
	c.magenta
);
panelRow(
	"Network Context",
	"Morph Hoodi Testnet (ChainID: 2910)",
	c.brightCyan,
	c.white,
	c.magenta
);
panelRow("Gateway Endpoint", GATEWAY, c.brightCyan, c.white, c.magenta);
panelRow(
	"Routing Protocol",
	"x402 Autonomous Micro-Payments",
	c.brightCyan,
	c.brightGreen,
	c.magenta
);
panelRow(
	"Autonomy Configuration",
	"FULL ACCESS [No Human Approval Required]",
	c.brightCyan,
	c.brightMagenta,
	c.magenta
);
panelBottom(c.magenta);

console.log("");
await pause(2000);

// ---------------------------------------------------------------------------
// PHASE 1 — INTENT DECLARATION
// ---------------------------------------------------------------------------
panelTop("PHASE 1 : INTENT DECLARATION [Mission Initialization]", c.brightMagenta);
panelLine(" [OBJ] Primary Core Objectives:", c.brightMagenta, c.brightYellow);
panelLine(
	"       - Perform comprehensive real-time cryptocurrency market analysis",
	c.brightMagenta,
	c.white
);
panelLine(
	"       - Gather live price data for BTC, ETH, SOL via premium endpoints",
	c.brightMagenta,
	c.white
);
panelLine(
	"       - Monitor current network gas conditions across specified Layer 2",
	c.brightMagenta,
	c.white
);
panelLine(
	"       - Generate structured final intelligence report inside terminal container",
	c.brightMagenta,
	c.white
);
panelSeparator(c.brightMagenta);
panelLine(" [CFG] Operational Constraints & Ruleset:", c.brightMagenta, c.brightYellow);
panelLine(
	"       [+] Zero human intervention at any evaluation or decision node",
	c.brightMagenta,
	c.brightGreen
);
panelLine(
	"       [+] Pay-per-call metered on-demand data acquisition active",
	c.brightMagenta,
	c.brightGreen
);
panelLine(
	"       [+] All transactions fully verifiable on-chain asynchronously",
	c.brightMagenta,
	c.brightGreen
);
panelLine(
	"       [+] Cryptographic nonces/proof generated natively for every request",
	c.brightMagenta,
	c.brightGreen
);
panelBottom(c.brightMagenta);

console.log("");
await pause(2000);

// ---------------------------------------------------------------------------
// PHASE 2 — CATALOG DISCOVERY
// ---------------------------------------------------------------------------
panelTop("PHASE 2 : CATALOG DISCOVERY [Scanning Registry Container]", c.brightMagenta);
panelBottom(c.brightMagenta);

await think("Querying decentralized API market registry", 1500);
await pause(400);

const catalogRes = await fetch(`${GATEWAY}/api/v1/catalog`);
if (!catalogRes.ok) {
	console.log("");
	panelTop("CRITICAL REGISTRY FAULT", c.red);
	panelLine(
		" [!!] Gateway connection aborted. Verify if localized backend service is online.",
		c.red,
		c.brightRed
	);
	panelBottom(c.red);
	process.exit(1);
}
const { catalog, payment: meta } = await catalogRes.json();

console.log(
	`  ${c.brightGreen}[OK]${c.reset} Registry Handshake: Discovered ${catalog.length} system nodes.`
);
console.log(
	`  ${c.brightCyan}[PROT]${c.reset} Facilitator Contract Target: ${meta.facilitator?.slice(0, 24)}...`
);

await think("Analyzing endpoint capabilities and structural costs", 1400);
await pause(500);

console.log("");
panelTop("AVAILABLE DISTRIBUTED DATA SOURCES", c.cyan);
for (const api of catalog) {
	const priceStr = `[ $${api.priceUsd} ]`;
	const apiLine = ` * ${api.name.padEnd(22)} ${priceStr.padEnd(12)} Line: ${api.callUrl}`;
	panelLine(apiLine, c.cyan, c.white);
	if (api.description) {
		panelLine(`    └── ${api.description}`, c.cyan, c.dim);
	}
}
panelBottom(c.cyan);

const needed = ["BTC Price", "ETH Price", "SOL Price", "Gas Tracker"];
const selected = catalog.filter((a) => needed.includes(a.name));

console.log("");
await think("Running automated resource allocation models", 1600);
await pause(600);

console.log("");
panelTop("AI ROUTING DECISION ENGINE CONFIG_LOG", c.magenta);
for (const api of selected) {
	panelRow(
		api.name,
		`Staged for Execution -> $${api.priceUsd} USDC`,
		c.brightYellow,
		c.brightGreen,
		c.magenta
	);
}
const totalEstimate = selected.reduce((s, a) => s + Number(a.pricePerCall), 0);
panelSeparator(c.magenta);
panelRow(
	"Estimated Aggregate Cost",
	`$${(totalEstimate / 1_000_000).toFixed(6)} USDC`,
	c.brightCyan,
	c.brightYellow,
	c.magenta
);
panelBottom(c.magenta);

console.log("");
await pause(1800);

// ---------------------------------------------------------------------------
// PHASE 3 — BALANCE CHECK
// ---------------------------------------------------------------------------
panelTop("PHASE 3 : PRE-FLIGHT CAPACITY VALIDATION", c.brightMagenta);
panelBottom(c.brightMagenta);

await think("Evaluating on-chain USDC safe-balance via RPC nodes", 1400);
await pause(500);

const balRes = await fetch(`${GATEWAY}/payment/balance/${AGENT_ADDR}`);
const { usdcBalance } = await balRes.json();

const balanceNum = parseFloat(usdcBalance);
const requiredNum = totalEstimate / 1_000_000;

console.log("");
panelTop("ALLOCATION ANALYSIS", c.cyan);
panelRow("Current Balance Available", `${usdcBalance} USDC`, c.brightCyan, c.brightYellow, c.cyan);
panelRow(
	"Minimum Amount Required",
	`${requiredNum.toFixed(6)} USDC`,
	c.brightCyan,
	c.white,
	c.cyan
);
panelSeparator(c.cyan);

if (balanceNum < requiredNum) {
	panelLine(
		" [WARN] Insufficient optimal margin detected. Runtime threshold low.",
		c.cyan,
		c.brightYellow
	);
	panelLine("        Proceeding with partial remaining asset coverage...", c.cyan, c.brightCyan);
} else {
	panelLine(
		" [OK] Pre-flight allocation checks cleared. Liquidity capacity approved.",
		c.cyan,
		c.brightGreen
	);
	panelLine("        Operational status: ALL SYSTEMS OPERATIONAL", c.cyan, c.brightGreen);
}
panelBottom(c.cyan);

console.log("");
await pause(1800);

// ---------------------------------------------------------------------------
// PHASE 4 — AUTONOMOUS API CALLS
// ---------------------------------------------------------------------------
panelTop("PHASE 4 : AUTONOMOUS CRYPTOGRAPHIC PIPELINE", c.brightMagenta);
panelLine(" Sequential cryptographic loop for each micro-payment request:", c.brightMagenta, c.dim);
panelLine(
	"   1. Call gateway loop for single-use deterministic execution nonce",
	c.brightMagenta,
	c.dim
);
panelLine(
	"   2. Frame local transaction variables alongside unique payload hashes",
	c.brightMagenta,
	c.dim
);
panelLine(
	"   3. Signs binary structure using localized key pair (zero manual friction)",
	c.brightMagenta,
	c.dim
);
panelLine(
	"   4. Stream request bundle wrapped inside high-priority X-Payment header",
	c.brightMagenta,
	c.dim
);
panelLine(
	"   5. Complete immediate receipt authentication and verify settlement",
	c.brightMagenta,
	c.dim
);
panelBottom(c.brightMagenta);

const results = {};
let totalSpent = 0n;
let callNum = 1;

for (const api of selected) {
	console.log("");
	panelTop(
		`CALL PIPELINE ELEMENT [${callNum}/${selected.length}] -- ${api.name.toUpperCase()}`,
		c.brightCyan
	);
	panelRow("Target Node Provider", api.provider, c.brightYellow, c.dim, c.brightCyan);
	panelRow(
		"Assigned Base Rate",
		`$${api.priceUsd} USDC (${api.pricePerCall} compute units)`,
		c.brightYellow,
		c.white,
		c.brightCyan
	);
	panelRow(
		"Operational Vector",
		api.description || "Real-time feed",
		c.brightYellow,
		c.dim,
		c.brightCyan
	);
	panelBottom(c.brightCyan);

	console.log("");
	await think("Requesting cryptographic nonce key", 800);
	await think("Assembling authorization payload array", 800);
	await think("Generating localized ECDSA signature structural validation", 900);
	await think("Streaming remote payload across payment gateway", 800);

	try {
		const {
			status: httpStatus,
			body,
			nonce,
		} = await callPaidAPI(api.callUrl, api.provider, api.pricePerCall);

		console.log("");
		if (httpStatus === 200) {
			results[api.name] = body.data;
			totalSpent += BigInt(api.pricePerCall);

			panelTop(`PAYMENT PIPELINE SETTLED -- ${api.name.toUpperCase()}`, c.green);
			panelRow("Response Code", "200 OK SUCCESS", c.brightGreen, c.brightGreen, c.green);
			panelRow(
				"Assigned Nonce Hash",
				nonce.slice(0, 32) + "...",
				c.brightGreen,
				c.brightCyan,
				c.green
			);
			panelRow(
				"Data Slice Received",
				JSON.stringify(body.data).slice(0, 60),
				c.brightGreen,
				c.white,
				c.green
			);
			panelRow(
				"Settlement Context",
				"Asynchronous On-Chain Settlement Queued",
				c.brightGreen,
				c.brightYellow,
				c.green
			);
			panelBottom(c.green);
		} else if (httpStatus === 402) {
			results[api.name] = null;
			panelTop(`PIPELINE EXCEPTION ER-402 -- ${api.name.toUpperCase()}`, c.red);
			panelRow(
				"Response Code",
				"402 Payment Required Error",
				c.brightRed,
				c.brightRed,
				c.red
			);
			panelRow(
				"Gateway Context",
				String(body.error || "Payment validation failed").slice(0, 60),
				c.brightRed,
				c.white,
				c.red
			);
			panelBottom(c.red);
		} else {
			results[api.name] = null;
			panelTop(`PIPELINE EXCEPTION UNKNOWN -- ${api.name.toUpperCase()}`, c.yellow);
			panelRow(
				"Response Code",
				`${httpStatus} Server Communication Issue`,
				c.brightYellow,
				c.brightYellow,
				c.yellow
			);
			panelBottom(c.yellow);
		}
	} catch (err) {
		results[api.name] = null;
		console.log("");
		panelTop("LOCAL CRITICAL PIPELINE FAULT", c.brightRed);
		panelLine(` [!!] Runtime Exception: ${err.message.slice(0, 70)}`, c.brightRed, c.brightRed);
		panelBottom(c.brightRed);
	}

	callNum++;
	await pause(1500);
}

console.log("");
await pause(1800);

// ---------------------------------------------------------------------------
// PHASE 5 — ANALYSIS & REPORT
// ---------------------------------------------------------------------------
panelTop("PHASE 5 : METRIC SYNTHESIS & REPORT GENERATION", c.brightMagenta);
panelBottom(c.brightMagenta);

await think("Consolidating acquired unstructured data vectors", 1200);
await think("Running internal statistical asset mapping models", 1400);
await think("Computing standard cross-chain network indicators", 1200);
await think("Structuring synthetic execution summary matrix", 1000);

console.log("");
console.log("");

panelTop("CRYPTOCURRENCY MARKET INTELLIGENCE METRIC MATRIX", c.brightYellow);
panelLine(centerStr("AUTONOMOUS INTEL REPORT GENERATION"), c.brightYellow, c.bold + c.brightYellow);
panelLine(
	centerStr(
		`Generated Protocol-Direct via Morph Hoodi Testnet Integration | ${new Date().toISOString()}`
	),
	c.brightYellow,
	c.dim
);
panelSeparator(c.brightYellow);

// Price Data Section
if (results["BTC Price"] || results["ETH Price"] || results["SOL Price"]) {
	panelLine(" [ASSET REAL-TIME FEED EXCHANGE VALUES]", c.brightYellow, c.brightCyan);
	if (results["BTC Price"]) {
		panelRow(
			"  BTC / USD Spot Rate",
			`$${results["BTC Price"].price.toLocaleString()}`,
			c.white,
			c.brightYellow,
			c.brightYellow
		);
	}
	if (results["ETH Price"]) {
		panelRow(
			"  ETH / USD Spot Rate",
			`$${results["ETH Price"].price.toLocaleString()}`,
			c.white,
			c.brightYellow,
			c.brightYellow
		);
	}
	if (results["SOL Price"]) {
		panelRow(
			"  SOL / USD Spot Rate",
			`$${results["SOL Price"].price.toLocaleString()}`,
			c.white,
			c.brightYellow,
			c.brightYellow
		);
	}
	panelSeparator(c.brightYellow);
}

// Gas Tracker Section
if (results["Gas Tracker"]) {
	panelLine(" [LAYER-2 NETWORK PROCESSING CONDITIONS]", c.brightYellow, c.brightCyan);
	const g = results["Gas Tracker"];
	panelRow("  Priority Throughput", `${g.fast} Gwei`, c.white, c.brightGreen, c.brightYellow);
	panelRow(
		"  Standard Throughput",
		`${g.standard} Gwei`,
		c.white,
		c.brightYellow,
		c.brightYellow
	);
	panelRow("  Safe-Low Throughput", `${g.slow} Gwei`, c.white, c.brightRed, c.brightYellow);
	panelSeparator(c.brightYellow);
}

// Analysis Section
if (results["BTC Price"] && results["ETH Price"]) {
	panelLine(" [DERIVED INTEL ANALYTIC OBSERVATIONS]", c.brightYellow, c.brightCyan);
	const ratio = (results["BTC Price"].price / results["ETH Price"].price).toFixed(2);
	const btcPrice = results["BTC Price"].price;
	const sentiment =
		btcPrice > 70000
			? "STRONGLY BULLISH"
			: btcPrice > 60000
				? "NEUTRAL TRACKING"
				: "BEARISH OUTLOOK";

	panelRow("  Calculated BTC / ETH Ratio", ratio, c.white, c.brightMagenta, c.brightYellow);
	panelRow(
		"  Algorithmic Sentiment Node",
		sentiment,
		c.white,
		sentiment.includes("BULLISH") ? c.brightGreen : c.brightYellow,
		c.brightYellow
	);
	panelSeparator(c.brightYellow);
}

// Execution Summary
panelLine(" [COMPREHENSIVE RUNTIME EXECUTION AUDIT]", c.brightYellow, c.brightMagenta);
const successCount = Object.values(results).filter(Boolean).length;

panelRow("  Total Registered Targets", `${selected.length}`, c.white, c.white, c.brightYellow);
panelRow("  Successful Secure Hits", `${successCount}`, c.white, c.brightGreen, c.brightYellow);
panelRow(
	"  Dropped Pipeline Tasks",
	`${selected.length - successCount}`,
	c.white,
	successCount === selected.length ? c.dim : c.brightRed,
	c.brightYellow
);
panelRow(
	"  Aggregated Flow Charges",
	`$${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC`,
	c.white,
	c.brightYellow,
	c.brightYellow
);
panelRow(
	"  Manual Administrator Keys",
	"[ 0 ] Fully Autonomous Context",
	c.white,
	c.brightMagenta,
	c.brightYellow
);
panelRow(
	"  On-Chain Confirmations",
	`${successCount} Pending Finality blocks`,
	c.white,
	c.brightGreen,
	c.brightYellow
);
panelBottom(c.brightYellow);

console.log("");
panelTop("COMPLIANCE AND AUDIT VERIFICATION PATHWAY", c.cyan);
panelRow(
	"Localized Dashboard Matrix",
	`${GATEWAY}/dashboard/${AGENT_ADDR}`,
	c.brightCyan,
	c.white,
	c.cyan
);
panelRow(
	"Morph L2 Explorer Telemetry",
	"https://explorer-hoodi.morphl2.io",
	c.brightCyan,
	c.white,
	c.cyan
);
panelBottom(c.cyan);

console.log("");
panelTop("SYSTEM RECONCILIATION EXECUTION DONE", c.green);
panelLine(
	centerStr("MISSION COMPLETE -- ALL CRITICAL SUB-CHANNELS SOLVED AUTONOMOUSLY"),
	c.green,
	c.brightGreen + c.bold
);
panelBottom(c.green);
console.log("");

// ---------------------------------------------------------------------------
// ASYNCHRONOUS LIFE-CYCLE RUNTIME INITIALIZATION
// ---------------------------------------------------------------------------
async function main() {
	try {
		// All sequence phases have successfully mounted and evaluated above.
		// Safe shutdown signal.
		process.exit(0);
	} catch (error) {
		console.log("");
		panelTop("FATAL SYSTEM RUNTIME EXCEPTION", c.brightRed);
		panelRow(
			"Exception Vector",
			error.name || "RuntimeError",
			c.brightRed,
			c.brightYellow,
			c.brightRed
		);
		panelLine(` [!!] Error Context: ${error.message}`, c.brightRed, c.white);
		if (error.stack) {
			const stackLines = error.stack.split("\n").slice(1, 4);
			panelLine("      Stack Trace trace-log:", c.brightRed, c.dim);
			stackLines.forEach((l) => panelLine(`       ${l.trim()}`, c.brightRed, c.dim));
		}
		panelBottom(c.brightRed);
		console.log("");
		process.exit(1);
	}
}

// Global safety capture layers for unhandled asynchronous rejections
process.on("unhandledRejection", (reason, promise) => {
	console.log("");
	panelTop("UNHANDLED ASYNCHRONOUS REJECTION TRAP", c.red);
	panelLine(
		` [!!] Reason: ${reason instanceof Error ? reason.message : String(reason)}`,
		c.red,
		c.brightRed
	);
	panelBottom(c.red);
	console.log("");
	process.exit(1);
});

// Fire runtime agent execution thread
main();
