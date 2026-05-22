/**
 * @fileoverview x402AgentMesh SDK – Autonomous AI agent for paid APIs on Morph L2.
 * @author De-Finitely Broke
 * @version 1.0.0
 *
 * @example
 * import { createX402Agent } from '@x402/agent-sdk';
 * const agent = createX402Agent();
 * const result = await agent.run("What is the current BTC price?");
 * console.log(result.answer, result.metrics);
 */

import { ethers } from "ethers";
import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────────────────
// ANSI Terminal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** @namespace ANSI */
const C = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	gray: "\x1b[90m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	brightCyan: "\x1b[96m",
	brightWhite: "\x1b[97m",
};

const BOX_WIDTH = 110;

// ─────────────────────────────────────────────────────────────────────────────
// Terminal UI Logger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Industrial‑strength terminal logger with box drawing, spinner, and debug modes.
 * @private
 */
class TuiLogger {
	/**
	 * @param {boolean} [debugMode=false] - Enable verbose debug output.
	 */
	constructor(debugMode = false) {
		this.debugMode = debugMode;
		this.spinnerInterval = null;
		this.frames = ["|", "/", "-", "\\"];
	}

	/**
	 * Draws a header box.
	 * @param {string} title - Section title.
	 * @param {string} [color=C.brightCyan] - ANSI color code.
	 */
	header(title, color = C.brightCyan) {
		const cleanTitle = title.toUpperCase();
		const padLen = Math.max(0, BOX_WIDTH - 4 - cleanTitle.length);
		const pad = "─".repeat(padLen);
		console.log(
			`\n${C.dim}┌─ ${C.bold}${color}${cleanTitle}${C.reset}${C.dim} ${pad}${C.reset}`
		);
	}

	/** Draws a footer line. */
	footer() {
		console.log(`${C.dim}└${"─".repeat(BOX_WIDTH - 1)}${C.reset}`);
	}

	/**
	 * Prints a key‑value info line.
	 * @param {string} key - Label (left side).
	 * @param {string} value - Value.
	 * @param {string} [valColor=C.brightWhite] - ANSI color for value.
	 */
	info(key, value, valColor = C.brightWhite) {
		console.log(`${C.dim}│${C.reset} ${key.padEnd(18)} : ${valColor}${value}${C.reset}`);
	}

	/**
	 * Prints a tree‑like bullet point.
	 * @param {string} msg - Message.
	 * @param {number} [depth=0] - Indentation level (0 = root).
	 */
	tree(msg, depth = 0) {
		const prefix = depth === 0 ? "  " : "  ".repeat(depth) + "└─";
		console.log(`${C.dim}│${C.reset} ${C.dim}${prefix}${C.reset} ${msg}`);
	}

	/**
	 * Debug message (shown only when debug mode is enabled).
	 * @param {string} msg - Message.
	 * @param {number} [depth=0] - Indentation level.
	 */
	debug(msg, depth = 0) {
		const prefix = depth === 0 ? "  " : "  ".repeat(depth) + "└─";
		console.log(`${C.dim}│${C.reset} ${C.gray}${prefix}[ DEBUG ] ${msg}${C.reset}`);
	}

	/**
	 * Animated spinner for long‑running tasks.
	 * @param {string} msg - Task description.
	 * @param {boolean} [done=false] - Set to `true` to finish spinner.
	 */
	spinner(msg, done = false) {
		const border = `${C.dim}│${C.reset}   `;

		if (this.debugMode) {
			if (!done) console.log(`${border}${C.cyan}>>${C.reset} ${msg}...`);
			else console.log(`${border}${C.green}[ OK ]${C.reset} ${msg}`);
			return;
		}

		if (!done) {
			if (this.spinnerInterval) clearInterval(this.spinnerInterval);
			let i = 0;
			process.stdout.write(`\r\x1b[K${border}${C.cyan}${this.frames[0]}${C.reset} ${msg}...`);
			this.spinnerInterval = setInterval(() => {
				i = (i + 1) % this.frames.length;
				process.stdout.write(
					`\r\x1b[K${border}${C.cyan}${this.frames[i]}${C.reset} ${msg}...`
				);
			}, 80);
		} else {
			if (this.spinnerInterval) {
				clearInterval(this.spinnerInterval);
				this.spinnerInterval = null;
			}
			process.stdout.write(`\r\x1b[K${border}${C.green}[ OK ]${C.reset} ${msg}\n`);
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// X402Agent Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration object for `createX402Agent()`.
 * @typedef {Object} AgentConfig
 * @property {string} [gateway] - x402 gateway URL (default: `process.env.GATEWAY_URL` or `http://localhost:3001`).
 * @property {string} [privateKey] - Ethereum private key of the agent (default: `process.env.AGENT_PRIVATE_KEY`).
 * @property {string} [facilitator] - x402 facilitator contract address (default: `process.env.FACILITATOR_ADDRESS`).
 * @property {Object} [llm] - LLM provider configuration.
 * @property {string} [llm.provider="groq"] - `"groq"` or `"openai"`.
 * @property {string} [llm.apiKey] - API key for the LLM provider (default: `process.env.GROQ_API_KEY` or `process.env.OPENAI_API_KEY`).
 * @property {string} [llm.model] - Model name (default: `"llama-3.3-70b-versatile"` for Groq, `"gpt-4o"` for OpenAI).
 * @property {string} [usdcAddress] - USDC contract address (required for `autoApprove`).
 * @property {string} [rpcUrl] - JSON‑RPC URL for the blockchain (required for `autoApprove`).
 * @property {boolean} [autoApprove] - If `true`, automatically approves USDC spending (default: `process.env.AUTO_APPROVE === "true"`).
 * @property {boolean} [autoMint] - If `true`, requests test tokens when balance is zero (default: `process.env.AUTO_MINT === "true"`).
 * @property {string} [systemPrompt] - Custom system prompt for the LLM.
 * @property {number} [maxLoops=10] - Maximum number of tool‑execution loops.
 * @property {number} [temperature=0.0] - LLM temperature (0 = deterministic).
 * @property {boolean} [verbose=true] - Enable rich terminal UI (default: `process.env.VERBOSE !== "false"`).
 * @property {boolean} [debug=false] - Enable debug logging (default: `process.env.DEBUG === "true"`).
 * @property {number} [settleDelay=2000] - Milliseconds to wait after each paid call (avoids nonce conflicts).
 */

/**
 * Autonomous AI agent that discovers, pays for, and invokes paid APIs.
 * @class X402Agent
 */
class X402Agent {
	/**
	 * Creates a new x402 agent instance.
	 * @param {AgentConfig} [config={}] - Configuration object (all fields optional).
	 * @throws {Error} If required keys (`privateKey`, `facilitator`, LLM API key) are missing.
	 */
	constructor(config = {}) {
		const env = process.env;
		const {
			gateway = env.GATEWAY_URL || "http://localhost:3001",
			privateKey = env.AGENT_PRIVATE_KEY,
			facilitator = env.FACILITATOR_ADDRESS,
			llm = {
				provider: "groq",
				apiKey: env.GROQ_API_KEY,
				model: env.MODEL_NAME,
			},
			usdcAddress = env.USDC_ADDRESS,
			rpcUrl = env.RPC_URL,
			autoApprove = env.AUTO_APPROVE === "true",
			autoMint = env.AUTO_MINT === "true",
			systemPrompt,
			maxLoops = 10,
			temperature = 0.0,
			verbose = env.VERBOSE !== "false",
			debug = env.DEBUG === "true",
			settleDelay = 2000,
		} = config;

		/** @type {string} x402 gateway URL. */
		this.gateway = gateway;
		/** @type {string} Facilitator contract address. */
		this.facilitator = facilitator;
		/** @type {number} Maximum AI loops. */
		this.maxLoops = maxLoops;
		/** @type {number} LLM temperature. */
		this.temperature = temperature;
		/** @type {boolean} Enable verbose UI. */
		this.verbose = verbose;
		/** @type {boolean} Enable debug logs. */
		this.debug = debug;
		/** @type {string|undefined} USDC contract address. */
		this.usdcAddress = usdcAddress;
		/** @type {string|undefined} JSON‑RPC URL. */
		this.rpcUrl = rpcUrl;
		/** @type {boolean} Auto‑approve USDC spending. */
		this.autoApprove = autoApprove;
		/** @type {boolean} Auto‑mint test tokens. */
		this.autoMint = autoMint;
		/** @type {number} Delay after each payment (ms). */
		this.settleDelay = settleDelay;

		/** @type {TuiLogger|null} Terminal logger (only if `verbose`). */
		this.logger = verbose ? new TuiLogger(debug) : null;

		if (!privateKey) throw new Error("Missing AGENT_PRIVATE_KEY");
		/** @type {ethers.Wallet} Agent wallet. */
		this.wallet = new ethers.Wallet(privateKey);
		/** @type {string} Agent Ethereum address. */
		this.agentAddress = this.wallet.address;

		/** @type {ethers.JsonRpcProvider|null} Blockchain provider. */
		this.provider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;
		/** @type {ethers.Signer|null} Signer (connected wallet). */
		this.signer = this.provider ? this.wallet.connect(this.provider) : null;

		const provider = llm.provider || "groq";
		const apiKey = llm.apiKey;
		if (!apiKey) throw new Error(`Missing API key for ${provider}`);

		if (provider === "groq") {
			/** @type {OpenAI} LLM client (Groq). */
			this.llm = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey });
			/** @type {string} Model name. */
			this.model = llm.model || "llama-3.3-70b-versatile";
		} else if (provider === "openai") {
			this.llm = new OpenAI({ apiKey });
			this.model = llm.model || "gpt-4o";
		} else {
			this.llm = llm.client;
			this.model = llm.model;
		}

		/** @type {string} System prompt for the LLM. */
		this.systemPrompt =
			systemPrompt ||
			`You are an autonomous agent on Morph L2.
Your only job is to map the user's request to the most relevant tool from the provided list.
- Examine every tool’s **name** and **description** carefully.
- Choose the tool that matches the user’s keywords exactly.
- If no tool matches, say so – but you must look at **all** tools before giving up.
- Call the chosen tool with an empty object {} if it requires no arguments.
- Never invent tools. Never pick a random tool.`;

		/** @type {Array|null} Cached service catalog. */
		this.catalog = null;
		/** @type {Array|null} Tools in OpenAI format. */
		this.tools = null;
		/** @type {Object|null} Map from tool name to metadata. */
		this.toolMap = null;
	}

	/**
	 * Internal: Log debug message (if enabled).
	 * @private
	 * @param {string} msg - Debug message.
	 * @param {number} [depth=0] - Indentation.
	 */
	_debug(msg, depth = 0) {
		if (this.debug && this.logger) this.logger.debug(msg, depth);
	}

	/**
	 * Internal: Start a spinner.
	 * @private
	 * @param {string} msg - Task description.
	 */
	_spinner(msg) {
		if (this.logger) this.logger.spinner(msg);
	}

	/**
	 * Internal: Stop spinner with success.
	 * @private
	 * @param {string} msg - Completion message.
	 */
	_spinnerDone(msg) {
		if (this.logger) this.logger.spinner(msg, true);
	}

	/**
	 * Internal: Wrap text to fit inside a box of given width (preserves existing newlines).
	 * @private
	 * @param {string} text - Text to wrap.
	 * @param {number} width - Maximum line length.
	 * @returns {string[]} Array of wrapped lines.
	 */
	_wrapText(text, width) {
		const lines = [];
		const paragraphs = text.split(/\n/);
		for (const para of paragraphs) {
			if (para.trim() === "") {
				lines.push("");
				continue;
			}
			const words = para.split(/\s+/);
			let current = [];
			let currentLen = 0;
			for (const word of words) {
				if (currentLen + word.length + (current.length ? 1 : 0) <= width) {
					if (current.length) currentLen += 1;
					current.push(word);
					currentLen += word.length;
				} else {
					if (current.length) lines.push(current.join(" "));
					current = [word];
					currentLen = word.length;
				}
			}
			if (current.length) lines.push(current.join(" "));
		}
		return lines;
	}

	// ── x402 Payment Helpers ───────────────────────────────────────────────

	/**
	 * Signs an off‑chain payment voucher.
	 * @private
	 * @param {string} provider - Provider address (API owner).
	 * @param {bigint} amount - Payment amount in micro USDC (1 USDC = 1e6).
	 * @param {string|bigint} nonce - Unique nonce from gateway.
	 * @param {string|bigint} deadline - Expiration timestamp.
	 * @returns {Promise<string>} Ethereum signature (hex).
	 */
	async signPayment(provider, amount, nonce, deadline) {
		const encoded = ethers.solidityPacked(
			["address", "address", "address", "uint256", "bytes32", "uint256"],
			[this.facilitator, this.agentAddress, provider, BigInt(amount), nonce, BigInt(deadline)]
		);
		const hash = ethers.keccak256(encoded);
		return this.wallet.signMessage(ethers.getBytes(hash));
	}

	/**
	 * Builds the base64‑encoded x402 payment header.
	 * @private
	 * @param {string} provider - Provider address.
	 * @param {bigint} amount - Payment amount.
	 * @param {string|bigint} nonce - Nonce.
	 * @param {string|bigint} deadline - Deadline.
	 * @param {string} signature - Signed voucher.
	 * @returns {string} Base64 payment string.
	 */
	buildXPayment(provider, amount, nonce, deadline, signature) {
		return Buffer.from(
			JSON.stringify({
				payer: this.agentAddress,
				provider,
				amount: String(amount),
				nonce,
				deadline,
				signature,
			})
		).toString("base64");
	}

	/**
	 * Calls a paid API endpoint using the x402 protocol.
	 * @private
	 * @param {string} callUrl - API endpoint (absolute or relative to gateway).
	 * @param {string} provider - Provider address.
	 * @param {bigint} amount - Payment amount.
	 * @param {Object} [args={}] - Arguments to pass (if POST).
	 * @returns {Promise<{status: number, body: any, nonce: string}>}
	 */
	async callPaidAPI(callUrl, provider, amount, args = {}) {
		this._spinner("Requesting nonce");
		const nonceRes = await this._fetch(`${this.gateway}/payment/nonce`);
		const { nonce, deadline } = await nonceRes.json();
		this._spinnerDone("Nonce obtained");

		this._spinner("Signing payment voucher");
		const signature = await this.signPayment(provider, amount, nonce, deadline);
		this._spinnerDone("Voucher signed");

		const xPayment = this.buildXPayment(provider, amount, nonce, deadline, signature);
		const fullUrl = callUrl.startsWith("http") ? callUrl : `${this.gateway}${callUrl}`;

		const cleanedArgs = { ...args };
		delete cleanedArgs._call;
		const hasArgs = Object.keys(cleanedArgs).length > 0;

		const fetchOptions = { headers: { "X-Payment": xPayment } };
		if (hasArgs) {
			fetchOptions.method = "POST";
			fetchOptions.headers["Content-Type"] = "application/json";
			fetchOptions.body = JSON.stringify(cleanedArgs);
		}

		this._spinner("Sending payment");
		const apiRes = await this._fetch(fullUrl, fetchOptions);
		const body = await apiRes.json();
		this._spinnerDone("Payment sent");

		// Critical: delay to allow settlement transaction to be mined
		if (this.settleDelay > 0) {
			this._spinner(`Waiting ${this.settleDelay}ms for settlement`);
			await new Promise((resolve) => setTimeout(resolve, this.settleDelay));
			this._spinnerDone("Settlement delay finished");
		}

		return { status: apiRes.status, body, nonce };
	}

	// ── On‑chain USDC Handling ────────────────────────────────────────────

	/**
	 * Ensures the facilitator has sufficient USDC allowance (if `autoApprove` is true).
	 * @private
	 * @returns {Promise<void>}
	 */
	async _ensureAllowance() {
		if (!this.usdcAddress || !this.signer || !this.autoApprove) return;

		const usdc = new ethers.Contract(
			this.usdcAddress,
			[
				"function allowance(address,address) view returns (uint256)",
				"function approve(address,uint256) returns (bool)",
			],
			this.signer
		);

		this._spinner("Checking USDC allowance");
		const allowance = await usdc.allowance(this.agentAddress, this.facilitator);
		this._spinnerDone(`Allowance: ${ethers.formatUnits(allowance, 6)} USDC`);

		const MIN_ALLOWANCE = ethers.parseUnits("1000000", 6); // 1 million USDC
		if (allowance < MIN_ALLOWANCE) {
			this._spinner("Approving USDC spending (this may take a few seconds)");
			const tx = await usdc.approve(this.facilitator, ethers.MaxUint256);
			await tx.wait();
			this._spinnerDone("Approval confirmed");
		} else {
			this._spinnerDone("Allowance already sufficient, skipping approval");
		}
	}

	// ── Service Discovery ─────────────────────────────────────────────────

	/**
	 * Fetches the service catalog from the gateway.
	 * @returns {Promise<Object>} Catalog data (including `catalog` and `payment` fields).
	 * @throws {Error} If the gateway responds with a non‑OK status.
	 */
	async fetchCatalog() {
		const res = await this._fetch(`${this.gateway}/api/v1/catalog`);
		if (!res.ok) throw new Error("Catalog fetch failed");
		const data = await res.json();
		this.catalog = data.catalog;
		return data;
	}

	/**
	 * Converts the raw catalog into OpenAI function‑calling tools.
	 * @private
	 * @param {Array} catalog - Array of API definitions.
	 * @returns {Array} Tools array.
	 */
	_catalogToTools(catalog) {
		return catalog.map((api) => {
			const props = api.parameters?.properties ? { ...api.parameters.properties } : {};
			let desc = api.description || api.name;
			const n = api.name.toLowerCase();
			if (n.includes("cat fact")) desc = "Returns a random cat fact. Costs $" + api.priceUsd;
			else if (n.includes("dog fact"))
				desc = "Returns a random dog fact. Costs $" + api.priceUsd;
			else if (n.includes("joke")) desc = "Returns a random joke. Costs $" + api.priceUsd;
			else desc = `${desc}. Costs $${api.priceUsd} USDC per call.`;

			return {
				type: "function",
				function: {
					name: (() => {
						let fn = api.key.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+/, "");
						if (/^\d/.test(fn)) fn = "fn_" + fn;
						return fn;
					})(),
					description: desc,
					parameters: { type: "object", properties: props, required: Object.keys(props) },
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

	// ── Main Execution ────────────────────────────────────────────────────

	/**
	 * Executes the agent on a given user task.
	 * @param {string} task - Natural language task (e.g., "What is the BTC price?").
	 * @returns {Promise<{answer: string, metrics: {totalSpent: string, callsMade: number}}>}
	 * @example
	 * const result = await agent.run("Give me a dog fact and the current gas price.");
	 * console.log(result.answer);
	 * console.log(`Cost: ${result.metrics.totalSpent}`);
	 */
	async run(task) {
		if (this.logger) {
			console.log(
				C.bold +
					C.brightCyan +
					`
  ███████████                     █████                        
 ░░███░░░░░███                   ░░███                         
  ░███    ░███ ████████   ██████  ░███ █████  ██████  ████████ 
  ░██████████ ░░███░░███ ███░░███ ░███░░███  ███░░███░░███░░███
  ░███░░░░░███ ░███ ░░░ ░███ ░███ ░██████░  ░███████  ░███ ░░░ 
  ░███    ░███ ░███     ░███ ░███ ░███░░███ ░███░░░   ░███     
  ███████████  █████    ░░██████  ████ █████░░██████  █████    
 ░░░░░░░░░░░  ░░░░░      ░░░░░░  ░░░░ ░░░░░  ░░░░░░  ░░░░░     
                                                              ` +
					C.reset
			);
			console.log("  @author: De-Finitely Broke");
			console.log("  @broker: AgentMesh x402 Agent SDK");
			this.logger.header("SYSTEM CONFIGURATION");
			this.logger.info("WALLET ADDRESS", this.agentAddress);
			this.logger.info("CORE MODEL", this.model, C.brightCyan);
			this.logger.info("MESH GATEWAY", this.gateway, C.dim);
			this.logger.footer();
		}

		// 1. Catalog
		if (!this.catalog) {
			if (this.logger) this.logger.header("SERVICE CATALOG");
			this._spinner("Fetching tools from gateway");
			await this.fetchCatalog();
			this._spinnerDone(`${this.catalog.length} services found`);

			if (this.logger) {
				this.logger.tree("Available tools loaded:", 0);
				this.catalog.forEach((api) =>
					this.logger.tree(
						`${C.cyan}${api.name.padEnd(25)}${C.reset} │ COST: ${C.yellow}${api.priceUsd} USDC${C.reset}`,
						1
					)
				);
				this.logger.footer();
			}
			this.tools = this._catalogToTools(this.catalog);
			this.toolMap = Object.fromEntries(this.tools.map((t) => [t.function.name, t._meta]));
		}

		// 2. Wallet & auto‑mint
		if (this.logger) this.logger.header("ACCOUNT VERIFICATION");

		this._spinner("Checking wallet balance");
		const balRes = await this._fetch(`${this.gateway}/payment/balance/${this.agentAddress}`);
		const balData = await balRes.json();
		this._spinnerDone(`${balData.usdcBalance} USDC`);

		if (parseFloat(balData.usdcBalance) === 0 && this.autoMint) {
			this._spinner("Minting test tokens");
			await this._fetch(`${this.gateway}/faucet/mint`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ address: this.agentAddress }),
			});
			this._spinnerDone("Tokens minted successfully");
		}

		await this._ensureAllowance();
		if (this.logger) this.logger.footer();

		// 3. AI reasoning
		const messages = [
			{ role: "system", content: this.systemPrompt },
			{ role: "user", content: task },
		];

		if (this.logger) this.logger.header("AI PROCESSING");
		this._spinner("Analyzing prompt");
		let response = await this.llm.chat.completions.create({
			model: this.model,
			messages,
			tools: this.tools.map(({ _meta, ...t }) => t),
			tool_choice: "auto",
			temperature: this.temperature,
		});
		this._spinnerDone("Analysis complete");
		if (this.logger) this.logger.footer();

		const results = {};
		let totalSpent = 0n;
		let callCount = 0;

		for (let loop = 0; loop < this.maxLoops; loop++) {
			const message = response.choices[0].message;
			if (!message.tool_calls || message.tool_calls.length === 0) break;
			messages.push(message);

			if (this.logger) this.logger.header(`EXECUTION PROCESS`);

			const toolResults = [];
			for (const toolCall of message.tool_calls) {
				const {
					id,
					function: { name, arguments: argsStr },
				} = toolCall;
				let args = {};
				if (argsStr) {
					try {
						const parsed = JSON.parse(argsStr);
						if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
							args = parsed;
					} catch {}
				}

				const meta = this.toolMap[name];
				if (!meta) {
					toolResults.push({
						role: "tool",
						tool_call_id: id,
						content: JSON.stringify({ error: "Unknown tool" }),
					});
					continue;
				}

				if (this.logger) {
					this.logger.tree(` `);
					this.logger.tree(
						`[~] TARGET TOOL : ${C.bold}${meta.name}${C.reset} [COST: ${C.yellow}${(Number(meta.pricePerCall) / 1_000_000).toFixed(6)} USDC${C.reset}]`,
						0
					);
				}

				try {
					const { status, body, nonce } = await this.callPaidAPI(
						meta.callUrl,
						meta.provider,
						meta.pricePerCall,
						args
					);
					if (status === 200) {
						results[meta.name] = body.data;
						totalSpent += BigInt(meta.pricePerCall);
						callCount++;
						if (this.logger)
							this.logger.tree(`${C.green}[ OK ] Transaction success${C.reset}`, 1);
						toolResults.push({
							role: "tool",
							tool_call_id: id,
							content: JSON.stringify({ data: body.data || body, success: true }),
						});
					} else {
						if (this.logger)
							this.logger.tree(
								`${C.red}[ FAIL ] Execution error status ${status}${C.reset}`,
								1
							);
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
					if (this.logger)
						this.logger.tree(
							`${C.red}[ FAIL ] Execution error: ${err.message}${C.reset}`,
							1
						);
					toolResults.push({
						role: "tool",
						tool_call_id: id,
						content: JSON.stringify({ error: err.message }),
					});
				}
			}

			messages.push(...toolResults);
			this._spinner("Processing results");
			response = await this.llm.chat.completions.create({
				model: this.model,
				messages,
				tools: this.tools.map(({ _meta, ...t }) => t),
				tool_choice: "auto",
				temperature: this.temperature,
			});
			this._spinnerDone("Processing complete");
			if (this.logger) this.logger.footer();
		}

		let finalText = "No output.";
		try {
			if (response.choices?.[0]?.message?.content)
				finalText = response.choices[0].message.content;
		} catch {}

		if (this.logger) {
			this.logger.header("OUTPUT", C.cyan);
			// Wrap the text to fit inside the box (BOX_WIDTH - 4 for left/right borders + padding)
			const contentWidth = BOX_WIDTH - 4; // 2 spaces on each side of the text
			const wrappedLines = this._wrapText(finalText.trim(), contentWidth);
			console.log(C.dim + "│" + C.reset);
			for (const line of wrappedLines) {
				console.log(`${C.dim}│${C.reset}  ${C.brightWhite}${line}${C.reset}`);
			}
			console.log(C.dim + "│" + C.reset);
			this.logger.footer();

			// Final balance check
			let finalBalanceStr = "Unknown";
			try {
				const finalBalRes = await fetch(
					`${this.gateway}/payment/balance/${this.agentAddress}`
				);
				const finalBalData = await finalBalRes.json();
				finalBalanceStr = `${finalBalData.usdcBalance} USDC`;
			} catch (err) {
				this._debug("Could not fetch final balance");
			}

			this.logger.header("EXECUTION SUMMARY");
			this.logger.info("API CALLED", String(callCount));
			this.logger.info(
				"TOTAL COST",
				`${(Number(totalSpent) / 1_000_000).toFixed(6)} USDC`,
				C.yellow
			);
			this.logger.info("ACCOUNT STATUS", finalBalanceStr, C.green);
			this.logger.footer();
		}

		return {
			answer: finalText.trim(),
			metrics: {
				totalSpent: (Number(totalSpent) / 1_000_000).toFixed(6) + " USDC",
				callsMade: callCount,
			},
		};
	}

	/**
	 * Internal HTTP fetch with debug logging.
	 * @private
	 * @param {string} url - Request URL.
	 * @param {Object} [options={}] - Fetch options.
	 * @returns {Promise<Response>}
	 */
	async _fetch(url, options = {}) {
		const method = options.method || "GET";
		this._debug(`${method} ${url}`, 1);
		const res = await fetch(url, options);
		this._debug(`-> ${res.status} ${res.statusText}`, 2);
		return res;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new x402AgentMesh agent instance.
 * @param {AgentConfig} [config] - Configuration object (all fields optional).
 * @returns {X402Agent} Configured agent.
 * @example
 * const agent = createX402Agent({
 *   gateway: "http://localhost:3001",
 *   privateKey: "0x...",
 *   facilitator: "0x...",
 *   autoMint: true,
 *   verbose: true,
 * });
 * const result = await agent.run("Get me a random joke.");
 */
export function createX402Agent(config = {}) {
	return new X402Agent(config);
}
