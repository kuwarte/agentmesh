/**
 * x402AgentPayer
 * Powered by Groq (Llama 3.3 70B) – Autonomous AI Agent
 *
 * Usage:
 *   node agent-groq.mjs
 *   node agent-groq.mjs "What is the current BTC price and is gas cheap?"
 *
 * Debug mode:
 *   Set DEBUG=true in your .env file to see every HTTP request and response.
 */

import { ethers } from "ethers";
import OpenAI from "openai";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
	reverse: "\x1b[7m",
};

// ---------- .env loading ----------
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, ".env");

if (!existsSync(envPath)) {
	console.error(`${C.red}[FAIL] .env setup file missing.${C.reset}`);
	process.exit(1);
}

const env = Object.fromEntries(
	readFileSync(envPath, "utf8")
		.split(/\r?\n/)
		.filter((l) => l.trim() && !l.startsWith("#"))
		.map((l) => {
			const match = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
			if (!match) return [];
			return [match[1], match[2] ? match[2].trim() : ""];
		})
		.filter(([k, v]) => k)
);

const GATEWAY = env.GATEWAY_URL || "http://localhost:3001";
const GROQ_KEY = env.GROQ_API_KEY;
const AGENT_KEY = env.AGENT_PRIVATE_KEY || env.GATEWAY_PRIVATE_KEY;
const FACILITATOR = env.FACILITATOR_ADDRESS || env.X402_FACILITATOR_ADDRESS;
const TASK = process.argv[2] || env.AGENT_TASK || "Perform a crypto market analysis";
const DEBUG = env.DEBUG === "true"; // 👈 enable debug logging

if (!GROQ_KEY || GROQ_KEY === "your_groq_api_key_here") {
	console.error(`${C.red}[FAIL] GROQ_API_KEY unassigned.${C.reset}`);
	process.exit(1);
}
if (!AGENT_KEY || AGENT_KEY.startsWith("your_")) {
	console.error(`${C.red}[FAIL] AGENT_PRIVATE_KEY unassigned.${C.reset}`);
	process.exit(1);
}
if (!FACILITATOR || FACILITATOR.startsWith("your_")) {
	console.error(`${C.red}[FAIL] FACILITATOR_ADDRESS unassigned.${C.reset}`);
	process.exit(1);
}

const agentWallet = new ethers.Wallet(AGENT_KEY);
const AGENT_ADDR = agentWallet.address;

// ---------- TUI helpers ----------
const phase = (title) => {
	console.log(
		`\n${C.bold}${C.cyan}[#]========================================================================[ ${title} ]${C.reset}`
	);
};

const print = (tag, msg, color = C.reset) => {
	const sysTags = {
		wallet: `[ADDR]`,
		model: `[CORE]`,
		gateway: `[GATE]`,
		status: `[ OK ]`,
		chain: `[NETW]`,
		balance: `[ BAL ]`,
		action: `[EXEC]`,
		txHash: `[HASH]`,
		amount: `[AMNT]`,
		warn: `[WARN]`,
		note: `[NOTE]`,
		intent: `[INTN]`,
		price: `[COST]`,
		args: `[ARGS]`,
		nonce: `[NONC]`,
		data: `[DATA]`,
		settle: `[SETL]`,
		error: `[FAIL]`,
		debug: `[DEBG]`,
	};
	const prefix = sysTags[tag] || `[${tag.toUpperCase().padEnd(4)}]`;
	let finalColor = C.reset;
	if (tag === "error" || tag === "warn") finalColor = C.red;
	if (tag === "status" || tag === "balance") finalColor = C.green;
	if (tag === "debug") finalColor = C.dim; // dim for debug lines
	console.log(`${C.dim} │ ${C.reset}${finalColor}${prefix}${C.reset} ${color}${msg}${C.reset}`);
};

const executeTask = async (msg, taskFn) => {
	const frames = ["---", "#--", "##-", "###", "-##", "--#"];
	let idx = 0;
	const interval = setInterval(() => {
		process.stdout.write(
			`\r ${C.dim}│${C.reset} ${C.cyan}[${frames[idx % frames.length]}]${C.reset} [TASK] ${msg}...`
		);
		idx++;
	}, 100);
	try {
		const result = await taskFn();
		clearInterval(interval);
		process.stdout.write(
			`\r ${C.dim}│${C.reset} ${C.green}[ OK ]${C.reset} [TASK] ${msg}... Done.\n`
		);
		return result;
	} catch (error) {
		clearInterval(interval);
		process.stdout.write(
			`\r ${C.dim}│${C.reset} ${C.red}[FAIL]${C.reset} [TASK] ${msg}... Error encountered.\n`
		);
		throw error;
	}
};

const pause = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

// ---------- Debug HTTP wrapper ----------
async function debugFetch(url, options = {}) {
	const method = options.method || "GET";
	if (DEBUG) {
		print("debug", `${method} ${url}`, C.dim);
	}
	const res = await fetch(url, options);
	if (DEBUG) {
		const statusColor = res.ok ? C.green : C.red;
		print("debug", `→ ${res.status} ${res.statusText}`, statusColor);
	}
	return res;
}

// ---------- x402 payment helpers ----------
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

async function callPaidAPI(callUrl, provider, amount, args = {}) {
	const { nonce, deadline } = await executeTask("Requesting secure network nonce", async () => {
		const res = await debugFetch(`${GATEWAY}/payment/nonce`);
		return res.json();
	});
	const signature = await executeTask("Signing off-chain payment voucher", () =>
		signPayment(provider, amount, nonce, deadline)
	);
	const xPayment = buildXPayment(provider, amount, nonce, deadline, signature);
	const fullUrl = callUrl.startsWith("http") ? callUrl : `${GATEWAY}${callUrl}`;

	const hasArgs = Object.keys(args).filter((k) => k !== "_call").length > 0;
	const fetchOptions = { headers: { "X-Payment": xPayment } };
	if (hasArgs) {
		fetchOptions.method = "POST";
		fetchOptions.headers["Content-Type"] = "application/json";
		const cleanedArgs = { ...args };
		delete cleanedArgs._call;
		fetchOptions.body = JSON.stringify(cleanedArgs);
	}
	return executeTask("Sending payment signature to API endpoint", async () => {
		const res = await debugFetch(fullUrl, fetchOptions);
		const body = await res.json();
		return { status: res.status, body, nonce };
	});
}

// ---------- Tool conversion ----------
function catalogToTools(catalog) {
	return catalog.map((api) => {
		const props = api.parameters?.properties ? { ...api.parameters.properties } : {};

		let desc = api.description || api.name;
		const nameLower = api.name.toLowerCase();
		if (nameLower.includes("cat fact"))
			desc = "Returns a random cat fact. Costs $" + api.priceUsd;
		else if (nameLower.includes("dog fact"))
			desc = "Returns a random dog fact. Costs $" + api.priceUsd;
		else if (nameLower.includes("joke")) desc = "Returns a random joke. Costs $" + api.priceUsd;
		else desc = `${api.description || api.name}. Costs $${api.priceUsd} USDC per call.`;

		return {
			type: "function",
			function: {
				name: (() => {
					let n = api.key.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "");
					if (/^\d/.test(n)) n = "fn_" + n;
					return n;
				})(),
				description: desc,
				parameters: {
					type: "object",
					properties: props,
					required: Object.keys(props),
				},
			},
			_meta: {
				callUrl: api.callUrl,
				provider: api.provider,
				pricePerCall: api.pricePerCall,
				name: api.name,
			},
		};
	});
}

// ---------- Groq client ----------
const groq = new OpenAI({
	baseURL: "https://api.groq.com/openai/v1",
	apiKey: GROQ_KEY,
});
const MODEL = "llama-3.3-70b-versatile";
const SYSTEM_PROMPT = `You are an autonomous agent on Morph L2.
Your only job is to map the user's request to the most relevant tool from the provided list.
- Examine every tool’s **name** and **description** carefully.
- Choose the tool that matches the user’s keywords exactly.
- Example: if the user says "cat facts", pick the tool whose name or description contains "cat" or "cat fact".
- If no tool matches, say so – but you must look at **all** tools before giving up.
- Call the chosen tool with an empty object {} if it requires no arguments.
- Never invent tools. Never pick a random tool.`;

// ====================== MAIN ======================
console.clear();
console.log(`${C.reverse}${C.bold} x402AgentPayer ${C.reset}\n`);

phase("AGENT SETUP PROFILE");
print("wallet", AGENT_ADDR, C.bold);
print("model", MODEL + " (via Groq)");
print("gateway", GATEWAY);
if (DEBUG) print("debug", "Debug logging ENABLED", C.yellow);
await pause();

// Phase 1 – Catalog
phase("01 / SERVICE REGISTRY DISCOVERY");
const catalogResData = await executeTask("Fetching marketplace catalog", async () => {
	const res = await debugFetch(`${GATEWAY}/api/v1/catalog`);
	if (!res.ok) throw new Error();
	return res.json();
}).catch(() => {
	console.log("");
	print("error", "Gateway response failed. Make sure the backend app is running.");
	process.exit(1);
});
const { catalog, payment: meta } = catalogResData;
print("status", `${catalog.length} services found`);
print("chain", `Facilitator: ${meta.facilitator}`);
console.log(` ${C.dim}│`);
console.log(` ${C.dim}├───[ MARKETPLACE PRICE MENU ]`);
for (const api of catalog) {
	console.log(
		` ${C.dim}│     :: ${api.name.padEnd(28)} -> ${C.green}${parseFloat(api.priceUsd).toFixed(4)} USDC/Call${C.reset}`
	);
}
await pause();

// Phase 2 – Wallet balance
phase("02 / ACCOUNT WALLET CHECK");
const balanceData = await executeTask("Checking wallet USDC balance", async () => {
	const res = await debugFetch(`${GATEWAY}/payment/balance/${AGENT_ADDR}`);
	return res.json();
});
const { usdcBalance } = balanceData;
print("balance", `${usdcBalance} USDC`);

if (parseFloat(usdcBalance) === 0) {
	print("action", "USDC balance empty. Triggering faucet...");
	const mintBody = await executeTask("Requesting test tokens from faucet", async () => {
		const res = await debugFetch(`${GATEWAY}/faucet/mint`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ address: AGENT_ADDR }),
		});
		return res.json();
	});
	if (mintBody.txHash) {
		print("status", "Tokens added");
		print("amount", `${mintBody.amount} USDC`);
		print("txHash", mintBody.txHash);
	} else {
		print("warn", "Faucet rejected or timed out – continuing anyway");
	}
}
await pause();

// Phase 3 – AI planning
phase("03 / AGENT ROUTING & PLANNING");
console.log(` ${C.dim}│ [JOB ] Assigned Objective:`);
console.log(` ${C.dim}│        "${C.bold}${TASK}${C.reset}"\n`);

const tools = catalogToTools(catalog);
const toolMap = Object.fromEntries(tools.map((t) => [t.function.name, t._meta]));

const messages = [
	{ role: "system", content: SYSTEM_PROMPT },
	{ role: "user", content: TASK },
];

let response = await executeTask("Sending tools context to AI engine", async () => {
	if (DEBUG)
		print(
			"debug",
			`POST https://api.groq.com/openai/v1/chat/completions (model: ${MODEL})`,
			C.dim
		);
	return groq.chat.completions.create({
		model: MODEL,
		messages,
		tools: tools.map(({ _meta, ...t }) => t),
		tool_choice: "auto",
		temperature: 0.0,
	});
});
if (DEBUG) print("debug", `AI response received (status: 200)`, C.green);
print("status", "AI session initialized");

// Phase 4 – Tool execution loop
const results = {};
let totalSpent = 0n;
let callNum = 1;
let loopCount = 0;
const MAX_LOOPS = 10;

while (loopCount < MAX_LOOPS) {
	loopCount++;
	const message = response.choices[0].message;
	if (!message.tool_calls || message.tool_calls.length === 0) break;
	messages.push(message);

	const toolResults = [];
	for (const toolCall of message.tool_calls) {
		const {
			id,
			function: { name, arguments: argsStr },
		} = toolCall;
		const args = JSON.parse(argsStr);
		const meta = toolMap[name];

		if (!meta) {
			toolResults.push({
				role: "tool",
				tool_call_id: id,
				content: JSON.stringify({ error: "Unknown tool" }),
			});
			continue;
		}

		console.log(` ${C.dim}│`);
		console.log(` ${C.dim}├───[ SERVICE DISPATCH LOG #${callNum} ]───`);
		print("intent", `Calling Tool: ${C.bold}${meta.name}${C.reset}`);
		print("price", `${(Number(meta.pricePerCall) / 1_000_000).toFixed(6)} USDC`, C.green);
		if (Object.keys(args).length > 1) print("args", JSON.stringify(args));

		try {
			const { status, body, nonce } = await callPaidAPI(
				meta.callUrl,
				meta.provider,
				meta.pricePerCall,
				args
			);
			if (status === 200) {
				results[meta.name] = body.data;
				totalSpent += BigInt(meta.pricePerCall);
				print("status", `API Approved [${status}]`, C.green);
				print("nonce", nonce);
				print("data", JSON.stringify(body.data || body));
				print("settle", "Payment captured");
				toolResults.push({
					role: "tool",
					tool_call_id: id,
					content: JSON.stringify({ data: body.data || body, success: true }),
				});
			} else {
				print("status", `API Refused [${status}]`, C.red);
				print("error", String(body.error || "Error status"));
				toolResults.push({
					role: "tool",
					tool_call_id: id,
					content: JSON.stringify({
						error: body.error || "API Authorization issue",
						status,
					}),
				});
			}
		} catch (err) {
			console.log("");
			print("error", err.message);
			toolResults.push({
				role: "tool",
				tool_call_id: id,
				content: JSON.stringify({ error: err.message }),
			});
		}
		callNum++;
		await pause();
	}

	messages.push(...toolResults);
	console.log(` ${C.dim}│`);
	response = await executeTask("Returning data back to AI", async () => {
		if (DEBUG)
			print("debug", `POST https://api.groq.com/openai/v1/chat/completions (loop)`, C.dim);
		return groq.chat.completions.create({
			model: MODEL,
			messages,
			tools: tools.map(({ _meta, ...t }) => t),
			tool_choice: "auto",
			temperature: 0.0,
		});
	});
	if (DEBUG) print("debug", `AI response received (status: 200)`, C.green);
}

// Phase 5 – Final answer
phase("04 / TASK AGGREGATION & FINAL ANSWER");
let finalText = "No output.";
try {
	if (response.choices?.[0]?.message?.content) {
		finalText = response.choices[0].message.content;
	}
} catch {}
console.log(`${C.dim}─[ OUTPUT STREAM ]───`);
console.log(finalText.trim());
console.log(`${C.dim}───────────────────────`);

phase("RUN METRICS");
print("APIs called", `${callNum - 1}`, C.bold);
print("Total spent", `${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC`, C.green);
print("Human approvals", "0 (Autonomous)", C.cyan);
print("Model Engine", MODEL + " (Groq)");

phase("NETWORK VERIFICATION LINKS");
print("dashboard", `${GATEWAY}/dashboard/${AGENT_ADDR}`, C.cyan);
print("explorer", "https://explorer-hoodi.morphl2.io", C.cyan);
console.log("");
