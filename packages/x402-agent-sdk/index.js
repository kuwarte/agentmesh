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
 *
 * // With event hooks (for real AI framework integration):
 * const agent = createX402Agent({
 *   onEvent: (type, payload) => {
 *     if (type === 'payment:success') myLogger.log(payload);
 *   }
 * });
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, ".env") });
import { ethers } from "ethers";
import OpenAI from "openai";

// ANSI Terminal Helpers

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

// Terminal UI Logger

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

// X402Agent Class

/**
 * Configuration object for `createX402Agent()`.
 * @typedef {Object} AgentConfig
 * @property {string} [gateway] - x402 gateway URL (default: `process.env.GATEWAY_URL` or `http://localhost:3001`).
 * @property {string} [privateKey] - Ethereum private key of the agent (default: `process.env.AGENT_PRIVATE_KEY`).
 * @property {string} [facilitator] - x402 facilitator contract address (default: `process.env.X402_FACILITATOR_ADDRESS`).
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
 * @property {Function} [onEvent] - Optional callback `(type, payload) => void` for programmatic event hooks.
 *   Event types: `'catalog:loaded'`, `'balance:checked'`, `'payment:signing'`, `'payment:success'`,
 *   `'payment:failed'`, `'tool:called'`, `'tool:result'`, `'run:complete'`.
 * @property {number} [catalogTtl=0] - Milliseconds before catalog cache expires (0 = never refresh).
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
			// Accept both names — X402_FACILITATOR_ADDRESS matches backend .env
			facilitator = env.X402_FACILITATOR_ADDRESS || env.FACILITATOR_ADDRESS,
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
			onEvent = null,
			catalogTtl = 0,
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
		/** @type {number} Delay after each payment (ms). Minimum 300ms to allow on-chain settlement. */
		this.settleDelay = Math.max(300, settleDelay);
		/** @type {Function|null} Event callback for programmatic integration. */
		this.onEvent = typeof onEvent === "function" ? onEvent : null;
		/** @type {number} Catalog cache TTL in ms (0 = never expire). */
		this.catalogTtl = catalogTtl;
		/** @type {number} Timestamp of last catalog fetch. */
		this._catalogFetchedAt = 0;

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
	 * Internal: Emit a structured event to the onEvent callback.
	 * Allows real AI frameworks (LangChain, custom loops) to hook into
	 * payment and tool execution lifecycle without parsing terminal output.
	 * @private
	 * @param {string} type - Event type (e.g. 'payment:success', 'tool:called').
	 * @param {Object} payload - Event data.
	 */
	_emit(type, payload = {}) {
		if (this.onEvent) {
			try {
				this.onEvent(type, { type, timestamp: Date.now(), ...payload });
			} catch {}
		}
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
		this._emit("payment:signing", { callUrl, provider, amount: String(amount) });
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

		if (apiRes.status === 200) {
			this._emit("payment:success", {
				callUrl,
				provider,
				amount: String(amount),
				amountUsd: (Number(amount) / 1_000_000).toFixed(6),
				nonce,
				data: body.data ?? body,
			});
		} else {
			this._emit("payment:failed", {
				callUrl,
				provider,
				amount: String(amount),
				status: apiRes.status,
				error: body.error,
			});
		}

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
		// MaxUint256 approval shows as "Unlimited" instead of a 78-digit number
		const allowanceDisplay =
			allowance >= ethers.MaxUint256 / 2n
				? "Unlimited"
				: `${ethers.formatUnits(allowance, 6)} USDC`;
		this._spinnerDone(`Allowance: ${allowanceDisplay}`);

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
	 * Respects catalogTtl — if set and catalog is fresh, returns cached version.
	 * @returns {Promise<Object>} Catalog data (including `catalog` and `payment` fields).
	 * @throws {Error} If the gateway responds with a non‑OK status.
	 */
	async fetchCatalog() {
		const now = Date.now();
		const isStale = this.catalogTtl > 0 && now - this._catalogFetchedAt > this.catalogTtl;
		if (this.catalog && !isStale) return { catalog: this.catalog };

		const res = await this._fetch(`${this.gateway}/api/v1/catalog`);
		if (!res.ok) throw new Error("Catalog fetch failed");
		const data = await res.json();
		this.catalog = data.catalog;
		this._catalogFetchedAt = now;
		this._emit("catalog:loaded", { count: this.catalog.length, catalog: this.catalog });
		return data;
	}

	/**
	 * Converts the raw catalog into OpenAI function‑calling tools.
	 * Uses api.name to derive a stable function name (catalog no longer has a key field).
	 * Uses real metadata description from Supabase when available, falls back to name.
	 * @private
	 * @param {Array} catalog - Array of API definitions from /api/v1/catalog.
	 * @returns {Array} Tools array in OpenAI function-calling format.
	 */
	_catalogToTools(catalog) {
		return catalog.map((api) => {
			// Derive a valid JS identifier from the API name
			// e.g. "BTC Price" → "btc_price", "Dog Fact" → "dog_fact"
			const fnName = (() => {
				let fn = api.name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "_")
					.replace(/^_+|_+$/g, "");
				if (/^\d/.test(fn)) fn = "fn_" + fn;
				return fn || "api_" + api.apiId.slice(2, 10);
			})();

			// Use real metadata description if available, otherwise fall back to name
			const desc = api.description
				? `${api.description} Costs $${api.priceUsd} USDC per call.`
				: `${api.name}. Costs $${api.priceUsd} USDC per call.`;

			// Build parameter schema from metadata params if available
			const props = {};
			const required = [];
			if (Array.isArray(api.params)) {
				for (const p of api.params) {
					props[p.name] = {
						type:
							p.type === "boolean"
								? "boolean"
								: p.type === "integer"
									? "integer"
									: "string",
						description: p.description || p.name,
					};
					if (p.required === "Yes") required.push(p.name);
				}
			}

			return {
				type: "function",
				function: {
					name: fnName,
					description: desc,
					parameters: { type: "object", properties: props, required },
				},
				_meta: {
					callUrl: api.callUrl,
					provider: api.provider,
					pricePerCall: api.pricePerCall,
					name: api.name,
					apiId: api.apiId,
				},
			};
		});
	}

	// ── Main Execution ────────────────────────────────────────────────────

	/**
	 * Executes the agent on a given user task using the AI reasoning loop.
	 * The AI selects tools from the catalog, pays for them, and synthesizes a final answer.
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

		// 1. Catalog — fetch if missing or stale
		const catalogIsStale =
			this.catalogTtl > 0 && Date.now() - this._catalogFetchedAt > this.catalogTtl;
		if (!this.catalog || catalogIsStale) {
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
		this._emit("balance:checked", {
			address: this.agentAddress,
			usdcBalance: balData.usdcBalance,
		});

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
		// Track tools that have already failed so we don't retry them
		const failedTools = new Set();

		for (let loop = 0; loop < this.maxLoops; loop++) {
			const message = response.choices[0].message;
			if (!message.tool_calls || message.tool_calls.length === 0) break;
			messages.push(message);

			if (this.logger) this.logger.header(`EXECUTION PROCESS`);

			const toolResults = [];
			let successfulCallsThisRound = 0;

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
						content: JSON.stringify({ error: "Unknown tool — do not retry" }),
					});
					continue;
				}

				// Skip tools that already failed in a previous round
				if (failedTools.has(name)) {
					toolResults.push({
						role: "tool",
						tool_call_id: id,
						content: JSON.stringify({
							error: "Tool unavailable — do not retry",
							tool: meta.name,
						}),
					});
					continue;
				}

				if (this.logger) {
					this.logger.tree(` `);
					this.logger.tree(
						`[~] TARGET TOOL : ${C.bold}${meta.name}${C.reset} [COST: ${C.yellow}${(Number(meta.pricePerCall) / 1_000_000).toFixed(6)} USDC${C.reset}]`,
						0
					);
					this.logger.tree(` `);
				}
				this._emit("tool:called", {
					name: meta.name,
					apiId: meta.apiId,
					args,
					pricePerCall: meta.pricePerCall,
				});

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
						successfulCallsThisRound++;
						if (this.logger)
							this.logger.tree(`${C.green}[ OK ] Transaction success${C.reset}`, 1);
						this._emit("tool:result", {
							name: meta.name,
							apiId: meta.apiId,
							success: true,
							data: body.data ?? body,
						});
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
						// Mark as failed so we don't retry this tool
						failedTools.add(name);
						this._emit("tool:result", {
							name: meta.name,
							apiId: meta.apiId,
							success: false,
							status,
							error: body.error,
						});
						toolResults.push({
							role: "tool",
							tool_call_id: id,
							content: JSON.stringify({
								error: body.error || "API call failed — do not retry this tool",
								status,
								permanent: true,
							}),
						});
					}
				} catch (err) {
					if (this.logger)
						this.logger.tree(
							`${C.red}[ FAIL ] Execution error: ${err.message}${C.reset}`,
							1
						);
					// Mark as failed so we don't retry this tool
					failedTools.add(name);
					this._emit("tool:result", {
						name: meta.name,
						apiId: meta.apiId,
						success: false,
						error: err.message,
					});
					toolResults.push({
						role: "tool",
						tool_call_id: id,
						content: JSON.stringify({
							error: `${err.message} — do not retry this tool`,
							permanent: true,
						}),
					});
				}
			}

			messages.push(...toolResults);

			// If every tool call this round failed, stop looping — the LLM has
			// all the error context it needs to synthesize a final answer.
			if (successfulCallsThisRound === 0 && toolResults.length > 0) {
				this._spinner("Synthesizing final answer");
				response = await this.llm.chat.completions.create({
					model: this.model,
					messages,
					temperature: this.temperature,
					// No tools — force a text answer, not another tool call
				});
				this._spinnerDone("Done");
				if (this.logger) this.logger.footer();
				break;
			}

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

		const finalMetrics = {
			totalSpent: (Number(totalSpent) / 1_000_000).toFixed(6) + " USDC",
			callsMade: callCount,
		};
		this._emit("run:complete", { answer: finalText.trim(), metrics: finalMetrics });

		return {
			answer: finalText.trim(),
			metrics: finalMetrics,
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

	/**
	 * Directly call a specific API by name or apiId, bypassing the AI loop.
	 * Useful for real AI frameworks (LangChain tools, custom agents) that handle
	 * tool selection themselves and just need the x402 payment + proxy handled.
	 *
	 * @param {string} nameOrId - API name (e.g. "BTC Price") or apiId (0x...).
	 * @param {Object} [args={}] - Query arguments forwarded to the upstream API.
	 * @returns {Promise<{data: any, amountUsd: string, nonce: string}>}
	 * @throws {Error} If the API is not found in the catalog or payment fails.
	 * @example
	 * // Use in a LangChain tool or custom agent:
	 * const { data } = await agent.callAPI("BTC Price");
	 * const { data: joke } = await agent.callAPI("Random Joke");
	 * const { data: geo } = await agent.callAPI("IP Info", { ip: "8.8.8.8" });
	 */
	async callAPI(nameOrId, args = {}) {
		// Ensure catalog is loaded
		if (!this.catalog) await this.fetchCatalog();
		if (!this.tools) {
			this.tools = this._catalogToTools(this.catalog);
			this.toolMap = Object.fromEntries(this.tools.map((t) => [t.function.name, t._meta]));
		}

		// Find by name (case-insensitive) or apiId
		const meta = Object.values(this.toolMap).find(
			(m) => m.name.toLowerCase() === nameOrId.toLowerCase() || m.apiId === nameOrId
		);

		if (!meta) {
			const available = Object.values(this.toolMap)
				.map((m) => m.name)
				.join(", ");
			throw new Error(`API not found: "${nameOrId}". Available: ${available}`);
		}

		const { status, body, nonce } = await this.callPaidAPI(
			meta.callUrl,
			meta.provider,
			meta.pricePerCall,
			args
		);

		if (status !== 200) {
			throw new Error(`API call failed (HTTP ${status}): ${body.error || "unknown error"}`);
		}

		return {
			data: body.data ?? body,
			amountUsd: (Number(meta.pricePerCall) / 1_000_000).toFixed(6),
			nonce,
		};
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
 * // Basic usage — AI picks tools automatically
 * const agent = createX402Agent({ autoMint: true, verbose: true });
 * const result = await agent.run("Get me a random joke.");
 * console.log(result.answer);
 *
 * // Direct API call — bypass AI loop (for LangChain tools, custom agents)
 * const agent = createX402Agent({ verbose: false });
 * const { data } = await agent.callAPI("BTC Price");
 *
 * // Event hooks — integrate with real AI frameworks
 * const agent = createX402Agent({
 *   verbose: false,
 *   onEvent: (type, payload) => {
 *     if (type === 'payment:success') console.log('Paid:', payload.amountUsd, 'USDC');
 *     if (type === 'tool:result')     console.log('Got:', payload.data);
 *     if (type === 'run:complete')    console.log('Done:', payload.metrics);
 *   }
 * });
 * const result = await agent.run("What is the ETH price and a random dog fact?");
 */
export function createX402Agent(config = {}) {
	return new X402Agent(config);
}
