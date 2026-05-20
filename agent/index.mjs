/**
 * AgentMesh Autonomous Agent
 * Powered by Google Gemini
 *
 * Usage:
 *     node index.mjs
 *     node index.mjs "What is the current BTC price and is gas cheap?"
 *
 * Setup:
 *     1. cp .env.example .env
 *     2. Fill in GEMINI_API_KEY, AGENT_PRIVATE_KEY, FACILITATOR_ADDRESS
 *     3. npm install
 *     4. Make sure the AgentMesh backend is running (pnpm dev in apps/backend)
 */

import { ethers } from "ethers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// ANSI Terminal Styling Colors
// ---------------------------------------------------------------------------
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    bgCyan: "\x1b[46m\x1b[30m",
    bgMagenta: "\x1b[45m\x1b[30m",
};

// ---------------------------------------------------------------------------
// Load .env Robustly
// ---------------------------------------------------------------------------
const __dir   = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, ".env");

if (!existsSync(envPath)) {
    console.error(`${C.red}● [error] .env not found. Copy .env.example to .env and fill in values.${C.reset}`);
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

const GATEWAY      = env.GATEWAY_URL      || "http://localhost:3001";
const GEMINI_KEY   = env.GEMINI_API_KEY;
const AGENT_KEY    = env.AGENT_PRIVATE_KEY;
const FACILITATOR  = env.FACILITATOR_ADDRESS;
const TASK         = process.argv[2] || env.AGENT_TASK || "Perform a crypto market analysis";

if (!GEMINI_KEY || GEMINI_KEY === "your_gemini_api_key_here") {
    console.error(`${C.red}● [error] GEMINI_API_KEY not set in .env${C.reset}`);
    process.exit(1);
}
if (!AGENT_KEY || AGENT_KEY.startsWith("your_")) {
    console.error(`${C.red}● [error] AGENT_PRIVATE_KEY not set in .env${C.reset}`);
    process.exit(1);
}
if (!FACILITATOR || FACILITATOR.startsWith("your_")) {
    console.error(`${C.red}● [error] FACILITATOR_ADDRESS not set in .env${C.reset}`);
    process.exit(1);
}

const agentWallet = new ethers.Wallet(AGENT_KEY);
const AGENT_ADDR  = agentWallet.address;

// ---------------------------------------------------------------------------
// Modern UI Display Helpers
// ---------------------------------------------------------------------------
const phase = (title) => {
    console.log(`\n${C.bold}${C.cyan}═══ ${title} ═══${C.reset}`);
};

const print = (tag, msg, color = C.reset) => {
    const labels = {
        wallet:   `${C.cyan}wallet${C.reset}`,
        model:    `${C.magenta}model${C.reset}`,
        gateway:  `${C.dim}gateway${C.reset}`,
        status:   `${C.green}status${C.reset}`,
        chain:    `${C.dim}chain${C.reset}`,
        balance:  `${C.green}balance${C.reset}`,
        action:   `${C.yellow}action${C.reset}`,
        txHash:   `${C.dim}txHash${C.reset}`,
        amount:   `${C.green}amount${C.reset}`,
        warn:     `${C.yellow}warning${C.reset}`,
        note:     `${C.dim}note${C.reset}`,
        intent:   `${C.cyan}intent${C.reset}`,
        price:    `${C.green}price${C.reset}`,
        args:     `${C.dim}args${C.reset}`,
        nonce:    `${C.dim}nonce${C.reset}`,
        data:     `${C.reset}data${C.reset}`,
        settle:   `${C.dim}settle${C.reset}`,
        error:    `${C.red}error${C.reset}`
    };
    const label = labels[tag] || tag;
    console.log(`  ${C.dim}│${C.reset} ${label.padEnd(20)} ${C.dim}→${C.reset} ${color}${msg}${C.reset}`);
};

const think = (msg) => new Promise((resolve) => {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    const iv = setInterval(() => {
        process.stdout.write(`\r  ${C.cyan}${frames[i % frames.length]}${C.reset} ${msg}...`);
        i++;
    }, 80);

    setTimeout(() => {
        clearInterval(iv);
        process.stdout.write(`\r  ${C.green}✔${C.reset} ${msg}\n`);
        resolve();
    }, 1200);
});

const pause = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// x402 payment helpers
// ---------------------------------------------------------------------------
async function signPayment(provider, amount, nonce, deadline) {
    const encoded = ethers.solidityPacked(
        ["address", "address", "address", "uint256", "bytes32", "uint256"],
        [FACILITATOR, AGENT_ADDR, provider, BigInt(amount), nonce, deadline]
    );
    const hash = ethers.keccak256(encoded);
    return agentWallet.signMessage(ethers.getBytes(hash));
}

function buildXPayment(provider, amount, nonce, deadline, signature) {
    return Buffer.from(JSON.stringify({
        payer: AGENT_ADDR, provider,
        amount: String(amount), nonce, deadline, signature,
    })).toString("base64");
}

async function callPaidAPI(callUrl, provider, amount, args = {}) {
    const nonceRes            = await fetch(`${GATEWAY}/payment/nonce`);
    const { nonce, deadline } = await nonceRes.json();
    const signature           = await signPayment(provider, amount, nonce, deadline);
    const xPayment            = buildXPayment(provider, amount, nonce, deadline, signature);
    const fullUrl             = callUrl.startsWith("http") ? callUrl : `${GATEWAY}${callUrl}`;
    
    const hasArgs = Object.keys(args).filter(k => k !== "_call").length > 0;
    const fetchOptions = {
        headers: { "X-Payment": xPayment }
    };

    let targetUrl = fullUrl;
    if (hasArgs) {
        fetchOptions.method = "POST";
        fetchOptions.headers["Content-Type"] = "application/json";
        const cleanedArgs = { ...args };
        delete cleanedArgs._call;
        fetchOptions.body = JSON.stringify(cleanedArgs);
    }

    const res  = await fetch(targetUrl, fetchOptions);
    const body = await res.json();
    return { status: res.status, body, nonce };
}

// ---------------------------------------------------------------------------
// Gemini tool definitions — dynamic schema handling
// ---------------------------------------------------------------------------
function catalogToGeminiTools(catalog) {
    return catalog.map((api) => {
        const cleanedSchemaProps = {};
        if (api.parameters && api.parameters.properties) {
            Object.assign(cleanedSchemaProps, api.parameters.properties);
        }

        cleanedSchemaProps._call = {
            type: "string",
            description: "Set to 'execute' to trigger call optimization routines.",
            enum: ["execute"],
        };

        return {
            name:        api.key.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, ""),
            description: `${api.description || api.name}. Costs $${api.priceUsd} USDC per call. Provider: ${api.provider}`,
            parameters: {
                type: "object",
                properties: cleanedSchemaProps,
                required: ["_call"],
            },
            _meta: {
                callUrl:      api.callUrl,
                provider:      api.provider,
                pricePerCall: api.pricePerCall,
                name:          api.name,
            },
        };
    });
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------
console.clear();
console.log(`\n ${C.bgCyan} AGENTMESH AUTONOMOUS WORKER ${C.reset} ${C.dim}v2.0 // x402 Engine${C.reset}`);

phase("AGENT IDENTITY");
print("wallet",  AGENT_ADDR, C.bold);
print("model",   "gemini-2.0-flash");
print("gateway", GATEWAY);

await pause(400);

// ---------------------------------------------------------------------------
// Phase 1 — Discover catalog
// ---------------------------------------------------------------------------
phase("PHASE 1 : CATALOG DISCOVERY");
await think("Syncing active marketplace catalog registry");

const catalogRes = await fetch(`${GATEWAY}/api/v1/catalog`);
if (!catalogRes.ok) {
    print("error", "Cannot reach gateway server sync. Is the app backend running?");
    process.exit(1);
}
const { catalog, payment: meta } = await catalogRes.json();

print("status",  `${catalog.length} available service endpoints configured`);
print("chain",   `facilitator managed contract @ ${meta.facilitator}`);

console.log(`\n  ${C.bold}Available Protocol Services:${C.reset}`);
for (const api of catalog) {
    console.log(`    ${C.dim}•${C.reset} ${api.name.padEnd(28)} ${C.green}$${parseFloat(api.priceUsd).toFixed(4)} USDC${C.reset}`);
}

await pause(400);

// ---------------------------------------------------------------------------
// Phase 2 — Self-onboarding: mint + approve if needed
// ---------------------------------------------------------------------------
phase("PHASE 2 : ACCOUNT ONBOARDING & TRUST");
await think("Verifying network programmatic liquidity asset positions");

const balRes          = await fetch(`${GATEWAY}/payment/balance/${AGENT_ADDR}`);
const { usdcBalance } = await balRes.json();
print("balance", `${usdcBalance} USDC`);

if (parseFloat(usdcBalance) === 0) {
    console.log("");
    print("action", "No balance native asset pool detected. Requesting faucet dispatch.");
    await think("Executing POST request to faucet mint core address");

    const mintRes  = await fetch(`${GATEWAY}/faucet/mint`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ address: AGENT_ADDR }),
    });
    const mintBody = await mintRes.json();

    if (mintRes.ok) {
        print("status",  "Faucet mint call processed successfully");
        print("amount",  `${mintBody.amount} USDC added into allocation pool`);
        print("txHash",  mintBody.txHash);
    } else {
        print("warn",    mintBody.error || "Faucet drop failed");
        print("note",    "Attempting loop migration. Logic execution may fail downstream.");
    }
}

await think("Validating marketplace facilitator protocol allowance levels");

const rpcProvider = new ethers.JsonRpcProvider(
    env.RPC_URL || "https://rpc-hoodi.morphl2.io"
);
const agentSigner = agentWallet.connect(rpcProvider);

const usdcAbi = [
    "function allowance(address,address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
];
const usdcAddress = env.USDC_ADDRESS;

if (usdcAddress && !usdcAddress.startsWith("<")) {
    const usdc      = new ethers.Contract(usdcAddress, usdcAbi, agentSigner);
    const allowance = await usdc.allowance(AGENT_ADDR, FACILITATOR);

    if (allowance === 0n) {
        console.log("");
        print("action", "Allowance empty. Submitting infinite marketplace facilitator spending approval.");
        await think("Broadcasting live contract ERC-20 approve() transaction");

        try {
            const approveTx = await usdc.approve(FACILITATOR, ethers.MaxUint256);
            await approveTx.wait();
            print("status", "System successfully approved (Max Allowance Configured)");
            print("txHash", approveTx.hash);
        } catch (err) {
            print("warn",   `Approval lifecycle crash: ${err.message}`);
            print("note",   "Manual contract configuration required to proceed safely.");
        }
    } else {
        print("status", "Facilitator trust limits clear. Ready for execution lifecycle.");
    }
} else {
    print("warn", "USDC_ADDRESS invalid or missing. Skipping runtime allowance confirmation.");
}

await pause(400);

// ---------------------------------------------------------------------------
// Phase 3 — Give Gemini the task + catalog context
// ---------------------------------------------------------------------------
phase("PHASE 3 : STRATEGIC COGNITION PLANNING");
console.log(`  ${C.bold}Assigned Runtime Instruction Profile:${C.reset}`);
console.log(`  ${C.dim}“${C.reset}${TASK}${C.dim}”${C.reset}\n`);

await think("Feeding objective data payload into Gemini Core");

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are an autonomous AI agent connected to AgentMesh — a decentralized API marketplace on Morph L2 blockchain.
You have access to paid API tools. Each tool call costs a small amount of USDC (micropayment), paid automatically via the x402 protocol.
Your job:
1. Understand the user's task
2. Decide which APIs to call (you can call multiple)
3. Call them using the provided tools. Check arguments carefully.
4. Synthesize the results into a clear response.`,
});

const tools = catalogToGeminiTools(catalog);
const toolMap = Object.fromEntries(tools.map((t) => [t.name, t._meta]));

const chat = model.startChat({
    tools: [{ functionDeclarations: tools.map(({ _meta, ...t }) => t) }],
});

const initialResponse = await chat.sendMessage(TASK);
let response = initialResponse;

print("status", "Strategic orchestration context mapped successfully");

// ---------------------------------------------------------------------------
// Phase 4 — Agentic loop: execute tool calls until Gemini is done
// ---------------------------------------------------------------------------
const results    = {};
let totalSpent   = 0n;
let callNum      = 1;
let loopCount    = 0;
const MAX_LOOPS  = 10;

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
                functionResponse: { name, response: { error: "Tool not found" } },
            });
            continue;
        }

        console.log(`\n  ${C.bold}${C.bgMagenta} AGENT CALL OUTFLOW #${callNum} ${C.reset} ${C.magenta}${meta.name}${C.reset}`);
        print("intent",   `Requested Marketplace Function Call: ${meta.name}`);
        print("price",    `$${(Number(meta.pricePerCall) / 1_000_000).toFixed(6)} USDC`, C.green);
        if (Object.keys(args || {}).length > 1) {
            print("args",  JSON.stringify(args));
        }

        await think("Signing cryptographic secure off-chain settlement note");
        await think("Passing raw x402 authorization stream header packet");

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
                print("status",  "200 OK — Resource Provider signature accepted verification", C.green);
                print("nonce",   nonce);
                print("data",    JSON.stringify(body.data || body));
                print("settle",  "Settlement processing asynchronously down the main settlement wire");

                toolResults.push({
                    functionResponse: {
                        name,
                        response: { data: body.data || body, success: true },
                    },
                });
            } else {
                print("status",  `${status} — Resource Access Request Denied`, C.red);
                print("error",   String(body.error || "Execution error handle failed"));

                toolResults.push({
                    functionResponse: {
                        name,
                        response: { error: body.error || "Payment rejected", status },
                    },
                });
            }
        } catch (err) {
            print("error", err.message);
            toolResults.push({
                functionResponse: { name, response: { error: err.message } },
            });
        }

        callNum++;
        await pause(400);
    }

    console.log("");
    await think("Streaming processing values backwards into thinking state loop");
    response = await chat.sendMessage(toolResults);
}

// ---------------------------------------------------------------------------
// Phase 5 — Gemini's final analysis
// ---------------------------------------------------------------------------
phase("PHASE 5 : SYNTHESIZED INTELLECT OUTPUT");

let finalText = "No analytical response generation yielded by model.";
try {
    if (response.response && typeof response.response.text === "function") {
        finalText = response.response.text();
    }
} catch (e) {
    const parts = response.response.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => p.text);
    if (textPart) finalText = textPart.text;
}

// Output text naturally styled as raw markdown terminal blocks
console.log(`\n${finalText}\n`);

phase("EXECUTION LIFECYCLE SUMMARY");
print("APIs called",      `${callNum - 1}`, C.bold);
print("Total spent",      `$${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC`, C.green);
print("Human approvals",  "0 (Fully Autonomous Orchestration Mode Enabled)", C.cyan);
print("Model Engine",     "gemini-2.0-flash");

phase("PROVENANCE VERIFICATION NETWORKS");
print("dashboard",  `${GATEWAY}/dashboard/${AGENT_ADDR}`, C.cyan);
print("explorer",   "https://explorer-hoodi.morphl2.io", C.cyan);
console.log("");