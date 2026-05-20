/**
 * x402AgentPayer
 * Powered by Google Gemini
 *
 * Usage:
 *     node index.mjs
 *     node index.mjs "What is the current BTC price and is gas cheap?"
 */

import { ethers } from "ethers";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

// Load .env Robustly
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
const GEMINI_KEY = env.GEMINI_API_KEY;
const AGENT_KEY = env.AGENT_PRIVATE_KEY;
const FACILITATOR = env.FACILITATOR_ADDRESS;
const TASK = process.argv[2] || env.AGENT_TASK || "Perform a crypto market analysis";

if (!GEMINI_KEY || GEMINI_KEY === "your_gemini_api_key_here") {
	console.error(`${C.red}[FAIL] GEMINI_API_KEY unassigned.${C.reset}`);
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
	};

	const prefix = sysTags[tag] || `[${tag.toUpperCase().padEnd(4)}]`;
	let finalColor = C.reset;
	if (tag === "error" || tag === "warn" || tag === "error ") finalColor = C.red;
	if (tag === "status" || tag === "balance") finalColor = C.green;

	console.log(`${C.dim} │ ${C.reset}${finalColor}${prefix}${C.reset} ${color}${msg}${C.reset}`);
};

const executeTask = async (msg, taskFn) => {
	const frames = ["---", "#--", "##-", "###", "-##", "--#"];
	let idx = 0;

	const interval = setInterval(() => {
		const progress = frames[idx % frames.length];
		process.stdout.write(
			`\r ${C.dim}│${C.reset} ${C.cyan}[${progress}]${C.reset} [TASK] ${msg}...`
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

// x402 payment helpers
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
		const res = await fetch(`${GATEWAY}/payment/nonce`);
		return res.json();
	});

	const signature = await executeTask("Signing off-chain payment voucher", async () => {
		return signPayment(provider, amount, nonce, deadline);
	});

	const xPayment = buildXPayment(provider, amount, nonce, deadline, signature);
	const fullUrl = callUrl.startsWith("http") ? callUrl : `${GATEWAY}${callUrl}`;

	const hasArgs = Object.keys(args).filter((k) => k !== "_call").length > 0;
	const fetchOptions = {
		headers: { "X-Payment": xPayment },
	};

	let targetUrl = fullUrl;
	if (hasArgs) {
		fetchOptions.method = "POST";
		fetchOptions.headers["Content-Type"] = "application/json";
		const cleanedArgs = { ...args };
		delete cleanedArgs._call;
		fetchOptions.body = JSON.stringify(cleanedArgs);
	}

	return executeTask("Sending payment signature to API endpoint", async () => {
		const res = await fetch(targetUrl, fetchOptions);
		const body = await res.json();
		return { status: res.status, body, nonce };
	});
}

// Gemini tool definitions — dynamic schema handling
function catalogToGeminiTools(catalog) {
	return catalog.map((api) => {
		const cleanedSchemaProps = {};
		if (api.parameters && api.parameters.properties) {
			Object.assign(cleanedSchemaProps, api.parameters.properties);
		}

		cleanedSchemaProps._call = {
			type: "string",
			description: "Set to 'execute' to run the targeted api function.",
			enum: ["execute"],
		};

		return {
			name: api.key.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, ""),
			description: `${api.description || api.name}. Costs $${api.priceUsd} USDC per call. Provider: ${api.provider}`,
			parameters: {
				type: "object",
				properties: cleanedSchemaProps,
				required: ["_call"],
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

// Main execution frame
console.clear();
console.log(`${C.reverse}${C.bold} x402AgentPayer ${C.reset}\n`);

phase("AGENT SETUP PROFILE");
print("wallet", AGENT_ADDR, C.bold);
print("model", "gemini-2.0-flash");
print("gateway", GATEWAY);

await pause();

// Phase 1 — Discover catalog
phase("01 / SERVICE REGISTRY DISCOVERY");

const catalogResData = await executeTask("Fetching marketplace catalog", async () => {
	const res = await fetch(`${GATEWAY}/api/v1/catalog`);
	if (!res.ok) throw new Error();
	return res.json();
}).catch(() => {
	console.log("");
	print("error", "Gateway response failed. Make sure the backend app is running.");
	process.exit(1);
});

const { catalog, payment: meta } = catalogResData;

print("status", `${catalog.length} services found in network registry`);
print("chain", `Facilitator routing contract: ${meta.facilitator}`);

console.log(` ${C.dim}│${C.reset}`);
console.log(` ${C.dim}├───[ MARKETPLACE PRICE MENU ]${C.reset}`);
for (const api of catalog) {
	console.log(
		` ${C.dim}│${C.reset}     :: ${api.name.padEnd(28)} -> ${C.green}${parseFloat(api.priceUsd).toFixed(4)} USDC/Call${C.reset}`
	);
}

await pause();

// Phase 2 — Self-onboarding: mint + approve if needed
phase("02 / ACCOUNT WALLET CHECK");

const balanceData = await executeTask("Checking wallet USDC balance", async () => {
	const res = await fetch(`${GATEWAY}/payment/balance/${AGENT_ADDR}`);
	return res.json();
});
const { usdcBalance } = balanceData;
print("balance", `${usdcBalance} USDC`);

if (parseFloat(usdcBalance) === 0) {
	print("action", "USDC balance is empty. Triggering network faucet request.");

	const mintBody = await executeTask("Requesting test tokens from faucet", async () => {
		const res = await fetch(`${GATEWAY}/faucet/mint`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ address: AGENT_ADDR }),
		});
		return res.json();
	});

	if (mintBody.txHash) {
		print("status", "USDC tokens added to wallet successfully");
		print("amount", `${mintBody.amount} USDC allocated`);
		print("txHash", mintBody.txHash);
	} else {
		console.log("");
		print("warn", "Faucet transaction rejected or timed out.");
		print("note", "Continuing execution. Errors might show up during calls.");
	}
}

const rpcProvider = new ethers.JsonRpcProvider(env.RPC_URL || "https://rpc-hoodi.morphl2.io");
const agentSigner = agentWallet.connect(rpcProvider);

const usdcAbi = [
	"function allowance(address,address) view returns (uint256)",
	"function approve(address,uint256) returns (bool)",
	"function balanceOf(address) view returns (uint256)",
];
const usdcAddress = env.USDC_ADDRESS;

if (usdcAddress && !usdcAddress.startsWith("<")) {
	const usdc = new ethers.Contract(usdcAddress, usdcAbi, agentSigner);

	const allowance = await executeTask("Checking platform spending allowance", async () => {
		return usdc.allowance(AGENT_ADDR, FACILITATOR);
	});

	if (allowance === 0n) {
		print("action", "No spending allowance. Submitting blockchain approval transaction.");

		try {
			const approveTx = await executeTask(
				"Sending ERC-20 infinite approval payload",
				async () => {
					const tx = await usdc.approve(FACILITATOR, ethers.MaxUint256);
					await tx.wait();
					return tx;
				}
			);
			print("status", "Marketplace allowance approved successfully");
			print("txHash", approveTx.hash);
		} catch (err) {
			console.log("");
			print("warn", `Blockchain transaction failed: ${err.message}`);
			print("note", "Check your gas tokens or run an manual allowance fix.");
		}
	} else {
		print("status", "Verified: Marketplace contract has permission to spend USDC");
	}
} else {
	print("warn", "USDC_ADDRESS missing or configured incorrectly. Skipping check.");
}

await pause();

// Phase 3 — Give Gemini the task + catalog context
phase("03 / AGENT ROUTING & PLANNING");
console.log(` ${C.dim}│${C.reset} [JOB ] Assigned Objective:`);
console.log(` ${C.dim}│${C.reset}        "${C.bold}${TASK}${C.reset}"\n`);

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({
	model: "gemini-2.0-flash",
	systemInstruction: `You are an autonomous agent backend core built on Morph L2.
You consume paid tools from the registry. Every task execution is handled on-chain via the x402 protocol.
Execution Flow:
1. Review the user's objective text.
2. Select valid functions matching available tools.
3. Call tools passing the right arguments.
4. Output your results clearly without small talk or excessive explanations.`,
});

const tools = catalogToGeminiTools(catalog);
const toolMap = Object.fromEntries(tools.map((t) => [t.name, t._meta]));

const chat = model.startChat({
	tools: [{ functionDeclarations: tools.map(({ _meta, ...t }) => t) }],
});

const responseData = await executeTask("Sending available tools context to AI engine", async () => {
	return chat.sendMessage(TASK);
});
let response = responseData;

print("status", "AI session initialization complete");

// Phase 4 — Agentic loop: execute tool calls until Gemini is done
const results = {};
let totalSpent = 0n;
let callNum = 1;
let loopCount = 0;
const MAX_LOOPS = 10;

while (loopCount < MAX_LOOPS) {
	loopCount++;
	const candidate = response.response.candidates?.[0];
	if (!candidate) break;

	const parts = candidate.content?.parts ?? [];
	const functionCalls = parts.filter((p) => p.functionCall);

	if (functionCalls.length === 0) break;

	const toolResults = [];

	for (const part of functionCalls) {
		const { name, args } = part.functionCall;
		const meta = toolMap[name];

		if (!meta) {
			toolResults.push({
				functionResponse: {
					name,
					response: { error: "Target API endpoint could not be found" },
				},
			});
			continue;
		}

		console.log(` ${C.dim}│${C.reset}`);
		console.log(
			` ${C.dim}├───[ SERVICE DISPATCH LOG #${callNum} ]─────────────────────────────────${C.reset}`
		);
		print("intent", `Calling Tool: ${C.bold}${meta.name}${C.reset}`);
		print("price", `${(Number(meta.pricePerCall) / 1_000_000).toFixed(6)} USDC`, C.green);
		if (Object.keys(args || {}).length > 1) {
			print("args", JSON.stringify(args));
		}

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
				print("status", `API Approved [Response Status Code: ${status}]`, C.green);
				print("nonce", nonce);
				print("data", JSON.stringify(body.data || body));
				print("settle", "Payment captured successfully");

				toolResults.push({
					functionResponse: {
						name,
						response: { data: body.data || body, success: true },
					},
				});
			} else {
				print("status", `API Request Refused [Response Status Code: ${status}]`, C.red);
				print(
					"error",
					String(body.error || "The endpoint returned an error status message")
				);

				toolResults.push({
					functionResponse: {
						name,
						response: {
							error: body.error || "API Authorization issue encountered",
							status,
						},
					},
				});
			}
		} catch (err) {
			console.log("");
			print("error", err.message);
			toolResults.push({
				functionResponse: { name, response: { error: err.message } },
			});
		}

		callNum++;
		await pause();
	}

	console.log(` ${C.dim}│${C.reset}`);
	response = await executeTask("Returning data outputs back to AI engine", async () => {
		return chat.sendMessage(toolResults);
	});
}

// Phase 5 — Gemini's final analysis
phase("04 / TASK AGGREGATION & FINAL ANSWER");

let finalText = "No processing output string could be fetched from the engine.";
try {
	if (response.response && typeof response.response.text === "function") {
		finalText = response.response.text();
	}
} catch (e) {
	const parts = response.response.candidates?.[0]?.content?.parts || [];
	const textPart = parts.find((p) => p.text);
	if (textPart) finalText = textPart.text;
}

// Standard Output Text Frame (Stripping any left over visual debris)
console.log(
	`${C.dim}─[ OUTPUT STREAM ]─────────────────────────────────────────────────────────────${C.reset}`
);
console.log(finalText.trim());
console.log(
	`${C.dim}───────────────────────────────────────────────────────────────────────────────${C.reset}`
);

phase("RUN METRICS");
print("APIs called", `${callNum - 1}`, C.bold);
print("Total spent", `${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC`, C.green);
print("Human approvals", "0 (Autonomous Agent Mode)", C.cyan);
print("Model Engine", "gemini-2.0-flash");

phase("NETWORK VERIFICATION LINKS");
print("dashboard", `${GATEWAY}/dashboard/${AGENT_ADDR}`, C.cyan);
print("explorer", "https://explorer-hoodi.morphl2.io", C.cyan);
console.log("");
