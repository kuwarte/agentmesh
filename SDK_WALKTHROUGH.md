# x402Agent SDK - Complete Walkthrough

## Overview

The SDK (`packages/x402-agent-sdk/index.js`) is a complete autonomous agent that:

1. **Discovers APIs** on-chain via the x402 gateway catalog
2. **Uses LLM reasoning** (Groq or OpenAI) to pick the right tools
3. **Handles x402 payments** with ECDSA signatures
4. **Executes APIs** via paid HTTP calls
5. **Feeds results back** to the LLM for synthesis

---

## Part 1: Initialization

### How It Starts

```javascript
import { createX402Agent } from "@x402/agent-sdk";

const agent = createX402Agent({
	gateway: "http://localhost:3001", // Backend URL
	privateKey: "0x...", // Agent wallet
	facilitator: "0x...", // Smart contract address
	llm: {
		provider: "groq", // or "openai"
		apiKey: process.env.GROQ_API_KEY,
		model: "llama-3.3-70b-versatile",
	},
	autoMint: true, // Get test tokens automatically
	autoApprove: true, // Auto-approve USDC spending
	verbose: true, // Rich terminal UI
	settleDelay: 2000, // Wait for on-chain settlement
});
```

### Constructor Flow

```javascript
constructor(config = {}) {
  // 1. Load configuration from env + config object
  const env = process.env;
  const gateway = config.gateway || env.GATEWAY_URL || "http://localhost:3001";
  const privateKey = config.privateKey || env.AGENT_PRIVATE_KEY;

  // 2. Create ethers.js wallet (for signing payments)
  this.wallet = new ethers.Wallet(privateKey);
  this.agentAddress = this.wallet.address;  // "0xAgent..."

  // 3. Setup blockchain provider (for USDC approval)
  this.provider = config.rpcUrl
    ? new ethers.JsonRpcProvider(config.rpcUrl)
    : null;
  this.signer = this.provider
    ? this.wallet.connect(this.provider)
    : null;

  // 4. Initialize LLM client
  if (config.llm.provider === "groq") {
    this.llm = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: config.llm.apiKey
    });
  } else if (config.llm.provider === "openai") {
    this.llm = new OpenAI({ apiKey: config.llm.apiKey });
  }

  // 5. Setup terminal logger (if verbose)
  this.logger = config.verbose ? new TuiLogger(config.debug) : null;

  // 6. Store configuration
  this.gateway = gateway;
  this.facilitator = config.facilitator;  // "0x...X402Facilitator"
  this.maxLoops = config.maxLoops || 10;
  this.temperature = config.temperature || 0.0;
  this.settleDelay = Math.max(300, config.settleDelay || 2000);
  this.autoMint = config.autoMint;
  this.autoApprove = config.autoApprove;

  // 7. Setup event hook for framework integration
  this.onEvent = typeof config.onEvent === 'function' ? config.onEvent : null;
}
```

---

## Part 2: Catalog Discovery

### Step 1: Fetch the Catalog

```javascript
async fetchCatalog() {
  // Check cache TTL
  const now = Date.now();
  const isStale = this.catalogTtl > 0
    && now - this._catalogFetchedAt > this.catalogTtl;

  // Return cached if fresh
  if (this.catalog && !isStale) {
    return { catalog: this.catalog };
  }

  // Fetch from gateway
  const res = await this._fetch(`${this.gateway}/api/v1/catalog`);
  if (!res.ok) throw new Error("Catalog fetch failed");

  const data = await res.json();
  // Response structure:
  // {
  //   success: true,
  //   count: 4,
  //   catalog: [
  //     {
  //       apiId: "0x123abc...",
  //       name: "BTC Price",
  //       endpoint: "http://localhost:3001/internal/btc",
  //       callUrl: "/api/v1/call/0x123abc...",
  //       pricePerCall: "1000",  // in micro USDC
  //       priceUsd: "0.001000",
  //       provider: "0xGateway...",
  //       currency: "USDC",
  //       network: "morph_hoodi"
  //     },
  //     ...
  //   ],
  //   payment: { scheme: "x402", facilitator: "0x..." }
  // }

  this.catalog = data.catalog;
  this._catalogFetchedAt = now;

  // Emit event for framework hooks
  this._emit("catalog:loaded", {
    count: this.catalog.length,
    catalog: this.catalog
  });

  return data;
}
```

### Step 2: Convert Catalog to OpenAI Tools

```javascript
_catalogToTools(catalog) {
  return catalog.map((api) => {
    // Derive valid JS identifier from API name
    // "BTC Price" → "btc_price"
    const fnName = (() => {
      let fn = api.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (/^\d/.test(fn)) fn = "fn_" + fn;
      return fn || "api_" + api.apiId.slice(2, 10);
    })();

    // Use real metadata description (from Supabase) if available
    const desc = api.description
      ? `${api.description} Costs $${api.priceUsd} USDC per call.`
      : `${api.name}. Costs $${api.priceUsd} USDC per call.`;

    // Build parameter schema from metadata
    const props = {};
    const required = [];
    if (Array.isArray(api.params)) {
      for (const p of api.params) {
        props[p.name] = {
          type: p.type === "boolean" ? "boolean"
               : p.type === "integer" ? "integer"
               : "string",
          description: p.description || p.name
        };
        if (p.required === "Yes") required.push(p.name);
      }
    }

    // Return OpenAI function-calling format
    return {
      type: "function",
      function: {
        name: fnName,
        description: desc,
        parameters: {
          type: "object",
          properties: props,
          required
        }
      },
      // Store metadata for later tool execution
      _meta: {
        callUrl: api.callUrl,              // "/api/v1/call/0x123..."
        provider: api.provider,            // "0xAPIOwner..."
        pricePerCall: api.pricePerCall,    // "1000" (micro USDC)
        name: api.name,                    // "BTC Price"
        apiId: api.apiId                   // "0x123abc..."
      }
    };
  });
}
```

**Example output:**

```javascript
{
  type: "function",
  function: {
    name: "btc_price",
    description: "Real-time Bitcoin/USD price. Costs $0.001000 USDC per call.",
    parameters: {
      type: "object",
      properties: {},  // No params needed for BTC price
      required: []
    }
  },
  _meta: {
    callUrl: "/api/v1/call/0x123abc...",
    provider: "0xGateway...",
    pricePerCall: "1000",
    name: "BTC Price",
    apiId: "0x123abc..."
  }
}
```

---

## Part 3: Payment Signing (The x402 Protocol)

### Step 1: Get Fresh Nonce from Gateway

```javascript
async callPaidAPI(callUrl, provider, amount, args = {}) {
  // 1. Request fresh nonce (valid for 5 minutes)
  this._spinner("Requesting nonce");
  const nonceRes = await this._fetch(`${this.gateway}/payment/nonce`);
  const { nonce, deadline } = await nonceRes.json();
  // Example response:
  // { nonce: "0x...", deadline: 1704067200 }
  this._spinnerDone("Nonce obtained");

  // Continue to signing step...
}
```

### Step 2: Sign the Payment Locally

```javascript
async signPayment(provider, amount, nonce, deadline) {
  // Reconstruct the exact message hash that the smart contract will verify
  // Formula: keccak256(abi.encodePacked(
  //   facilitator, payer, provider, amount, nonce, deadline
  // ))

  const encoded = ethers.solidityPacked(
    ["address", "address", "address", "uint256", "bytes32", "uint256"],
    [
      this.facilitator,           // "0xX402Facilitator"
      this.agentAddress,          // "0xAgent..." (payer)
      provider,                   // "0xAPIOwner..." (provider)
      BigInt(amount),             // 1000n (micro USDC)
      nonce,                      // "0xfresh..."
      BigInt(deadline)            // 1704067200
    ]
  );
  // Output: "0x..." (raw bytes)

  // Hash the packed data
  const hash = ethers.keccak256(encoded);
  // Output: "0x..." (32-byte hash)

  // Sign the message (ECDSA)
  return this.wallet.signMessage(ethers.getBytes(hash));
  // Output: "0x...sig..." (65-byte ECDSA signature)
}
```

**Inside signPayment():**

```
Input:
  facilitator = "0x0123456789abcdef0123456789abcdef01234567"
  payer       = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  provider    = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  amount      = 1000n
  nonce       = "0x1111111111111111111111111111111111111111111111111111111111111111"
  deadline    = 1704067200

↓ solidityPacked()

Raw bytes: 0x0123...aaaa...bbbb...000003e811111...06476d00

↓ keccak256()

Hash: 0xabcd1234...

↓ wallet.signMessage()

Signature: 0xabcd1234...vrs components...
```

### Step 3: Build X-Payment Header

```javascript
buildXPayment(provider, amount, nonce, deadline, signature) {
  // Serialize payment into JSON
  const paymentObj = {
    payer: this.agentAddress,           // "0xaaaa..."
    provider,                           // "0xbbbb..."
    amount: amount.toString(),          // "1000"
    nonce,                              // "0x1111..."
    deadline,                           // 1704067200
    signature                           // "0xabcd..."
  };

  const jsonStr = JSON.stringify(paymentObj);
  // {"payer":"0xaaaa...","provider":"0xbbbb...","amount":"1000",...}

  // Encode to base64 (HTTP-safe format)
  return Buffer.from(jsonStr).toString("base64");
  // "eyJwYXllciI6IjB4YWFhYSIsInByb3ZpZGVyIjoiMHhiYmJiIi4uLn0="
}
```

### Step 4: Make the HTTP Call with X-Payment Header

```javascript
async callPaidAPI(callUrl, provider, amount, args = {}) {
  // ... (nonce + signing steps above) ...

  // Build the HTTP request
  const xPayment = this.buildXPayment(provider, amount, nonce, deadline, signature);
  const fullUrl = callUrl.startsWith("http")
    ? callUrl
    : `${this.gateway}${callUrl}`;

  const fetchOptions = {
    headers: {
      "X-Payment": xPayment  // Base64-encoded payment JSON
    }
  };

  // If args are provided (POST), add them to body
  if (Object.keys(args).length > 0) {
    fetchOptions.method = "POST";
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(args);
  }

  // Make the request
  this._spinner("Sending payment");
  const apiRes = await this._fetch(fullUrl, fetchOptions);
  const body = await apiRes.json();
  // Example response:
  // { data: { symbol: "BTC", price: 65420 }, success: true }
  this._spinnerDone("Payment sent");

  // Emit success/failure event for framework hooks
  if (apiRes.status === 200) {
    this._emit("payment:success", {
      callUrl,
      provider,
      amount: String(amount),
      amountUsd: (Number(amount) / 1_000_000).toFixed(6),
      nonce,
      data: body.data ?? body
    });
  } else {
    this._emit("payment:failed", {
      callUrl,
      provider,
      amount: String(amount),
      status: apiRes.status,
      error: body.error
    });
  }

  // Wait for on-chain settlement (async in background)
  if (this.settleDelay > 0) {
    this._spinner(`Waiting ${this.settleDelay}ms for settlement`);
    await new Promise((resolve) => setTimeout(resolve, this.settleDelay));
    this._spinnerDone("Settlement delay finished");
  }

  return { status: apiRes.status, body, nonce };
}
```

---

## Part 4: The AI Reasoning Loop

### Main Execution: `run(task)`

```javascript
async run(task) {
  // ─────────────────────────────────────────────────────────
  // PHASE 1: Load & Setup
  // ─────────────────────────────────────────────────────────

  // Load catalog if needed
  if (!this.catalog || catalogIsStale) {
    await this.fetchCatalog();
    this.tools = this._catalogToTools(this.catalog);
    this.toolMap = Object.fromEntries(
      this.tools.map((t) => [t.function.name, t._meta])
    );
    // toolMap = {
    //   "btc_price": { callUrl, provider, pricePerCall, name, apiId },
    //   "eth_price": { ... },
    //   "gas_tracker": { ... }
    // }
  }

  // Check balance
  const balRes = await this._fetch(
    `${this.gateway}/payment/balance/${this.agentAddress}`
  );
  const balData = await balRes.json();  // { usdcBalance: "1000.000000" }

  // Auto-mint if needed
  if (parseFloat(balData.usdcBalance) === 0 && this.autoMint) {
    await this._fetch(`${this.gateway}/faucet/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: this.agentAddress })
    });
  }

  // Ensure USDC approval on-chain
  await this._ensureAllowance();

  // ─────────────────────────────────────────────────────────
  // PHASE 2: Initial AI Prompt
  // ─────────────────────────────────────────────────────────

  const messages = [
    {
      role: "system",
      content: `You are an autonomous agent on Morph L2.
Your only job is to map the user's request to the most relevant tool...`
    },
    {
      role: "user",
      content: task  // "What is the current BTC price?"
    }
  ];

  let response = await this.llm.chat.completions.create({
    model: this.model,  // "llama-3.3-70b-versatile"
    messages,
    tools: this.tools.map(({ _meta, ...t }) => t),  // OpenAI functions
    tool_choice: "auto",
    temperature: this.temperature
  });

  // Response structure:
  // {
  //   choices: [{
  //     message: {
  //       content: null,
  //       tool_calls: [{
  //         id: "call_abc123",
  //         function: {
  //           name: "btc_price",
  //           arguments: "{}"
  //         }
  //       }]
  //     }
  //   }]
  // }

  let totalSpent = 0n;
  let callCount = 0;
  const failedTools = new Set();  // Track failed tools to avoid retry

  // ─────────────────────────────────────────────────────────
  // PHASE 3: Tool Execution Loop
  // ─────────────────────────────────────────────────────────

  for (let loop = 0; loop < this.maxLoops; loop++) {
    const message = response.choices[0].message;

    // Stop if no tool calls (LLM chose to answer)
    if (!message.tool_calls || message.tool_calls.length === 0) break;

    // Add LLM message to conversation
    messages.push(message);

    const toolResults = [];

    // Execute each tool the LLM chose
    for (const toolCall of message.tool_calls) {
      const { id, function: { name, arguments: argsStr } } = toolCall;

      // Parse tool arguments
      let args = {};
      try {
        const parsed = JSON.parse(argsStr);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          args = parsed;
        }
      } catch {}

      // Look up tool metadata
      const meta = this.toolMap[name];
      if (!meta) {
        toolResults.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify({ error: "Unknown tool" })
        });
        continue;
      }

      // Skip if this tool already failed
      if (failedTools.has(name)) {
        toolResults.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify({ error: "Tool unavailable — do not retry" })
        });
        continue;
      }

      // Emit event (for frameworks like LangChain)
      this._emit("tool:called", {
        name: meta.name,
        apiId: meta.apiId,
        args,
        pricePerCall: meta.pricePerCall
      });

      // Execute the paid API call
      try {
        const { status, body, nonce } = await this.callPaidAPI(
          meta.callUrl,
          meta.provider,
          meta.pricePerCall,
          args
        );

        if (status === 200) {
          // Success: record result and add to conversation
          results[meta.name] = body.data;
          totalSpent += BigInt(meta.pricePerCall);
          callCount++;

          this._emit("tool:result", {
            name: meta.name,
            apiId: meta.apiId,
            success: true,
            data: body.data ?? body
          });

          toolResults.push({
            role: "tool",
            tool_call_id: id,
            content: JSON.stringify({
              data: body.data || body,
              success: true
            })
          });
        } else {
          // Failure: mark tool as failed and add error
          failedTools.add(name);

          this._emit("tool:result", {
            name: meta.name,
            apiId: meta.apiId,
            success: false,
            status,
            error: body.error
          });

          toolResults.push({
            role: "tool",
            tool_call_id: id,
            content: JSON.stringify({
              error: body.error || "API call failed",
              status,
              permanent: true
            })
          });
        }
      } catch (err) {
        // Network/parsing error
        failedTools.add(name);

        this._emit("tool:result", {
          name: meta.name,
          apiId: meta.apiId,
          success: false,
          error: err.message
        });

        toolResults.push({
          role: "tool",
          tool_call_id: id,
          content: JSON.stringify({
            error: `${err.message} — do not retry this tool`,
            permanent: true
          })
        });
      }
    }

    // Add tool results to conversation
    messages.push(...toolResults);

    // If all tools failed this round, stop looping
    // (LLM has all context to synthesize answer)
    if (successfulCallsThisRound === 0 && toolResults.length > 0) {
      response = await this.llm.chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature
        // No tools — force text answer
      });
      break;
    }

    // Otherwise, continue the loop with LLM
    response = await this.llm.chat.completions.create({
      model: this.model,
      messages,
      tools: this.tools.map(({ _meta, ...t }) => t),
      tool_choice: "auto",
      temperature: this.temperature
    });
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 4: Extract Final Answer
  // ─────────────────────────────────────────────────────────

  let finalText = "No output.";
  try {
    if (response.choices?.[0]?.message?.content) {
      finalText = response.choices[0].message.content;
    }
  } catch {}

  const finalMetrics = {
    totalSpent: (Number(totalSpent) / 1_000_000).toFixed(6) + " USDC",
    callsMade: callCount
  };

  this._emit("run:complete", {
    answer: finalText.trim(),
    metrics: finalMetrics
  });

  return {
    answer: finalText.trim(),
    metrics: finalMetrics
  };
}
```

---

## Part 5: Event Hooks (Framework Integration)

### Emitting Events

```javascript
_emit(type, payload = {}) {
  if (this.onEvent) {
    try {
      this.onEvent(type, {
        type,
        timestamp: Date.now(),
        ...payload
      });
    } catch {}
  }
}
```

### Using Event Hooks (e.g., LangChain)

```javascript
const agent = createX402Agent({
	verbose: false,
	onEvent: (type, payload) => {
		switch (type) {
			case "catalog:loaded":
				console.log(`✓ Loaded ${payload.count} APIs`);
				break;

			case "payment:signing":
				console.log(`→ Signing payment for ${payload.callUrl}`);
				break;

			case "payment:success":
				console.log(`✓ Paid $${payload.amountUsd} USDC`);
				myLogger.recordPayment(payload);
				break;

			case "payment:failed":
				console.error(`✗ Payment failed: ${payload.error}`);
				break;

			case "tool:called":
				console.log(`→ Calling: ${payload.name}`);
				break;

			case "tool:result":
				if (payload.success) {
					console.log(`✓ Got data: ${JSON.stringify(payload.data).slice(0, 50)}...`);
				} else {
					console.error(`✗ Tool failed: ${payload.error}`);
				}
				break;

			case "run:complete":
				console.log(`\n✓ DONE\n  Answer: ${payload.answer.slice(0, 100)}...`);
				console.log(`  Cost: ${payload.metrics.totalSpent}`);
				console.log(`  Calls: ${payload.metrics.callsMade}`);
				break;
		}
	},
});

const result = await agent.run("What is the BTC and ETH price?");
```

---

## Part 6: Direct API Calling (Bypass AI Loop)

### callAPI() Method

For frameworks like LangChain that handle tool selection themselves:

```javascript
async callAPI(nameOrId, args = {}) {
  // Ensure catalog is loaded
  if (!this.catalog) {
    await this.fetchCatalog();
  }
  if (!this.tools) {
    this.tools = this._catalogToTools(this.catalog);
    this.toolMap = Object.fromEntries(
      this.tools.map((t) => [t.function.name, t._meta])
    );
  }

  // Find API by name or apiId
  const meta = Object.values(this.toolMap).find(
    (m) => m.name.toLowerCase() === nameOrId.toLowerCase()
        || m.apiId === nameOrId
  );

  if (!meta) {
    const available = Object.values(this.toolMap)
      .map((m) => m.name)
      .join(", ");
    throw new Error(`API not found: "${nameOrId}". Available: ${available}`);
  }

  // Make the paid call directly
  const { status, body, nonce } = await this.callPaidAPI(
    meta.callUrl,
    meta.provider,
    meta.pricePerCall,
    args
  );

  if (status !== 200) {
    throw new Error(`API call failed (HTTP ${status}): ${body.error || "unknown"}`);
  }

  return {
    data: body.data ?? body,
    amountUsd: (Number(meta.pricePerCall) / 1_000_000).toFixed(6),
    nonce
  };
}
```

### Usage in LangChain

```javascript
// Setup agent
const agent = createX402Agent({ verbose: false });

// LangChain tool definition
const btcPriceTool = {
	name: "get_btc_price",
	description: "Get current Bitcoin price in USD",
	parameters: {},
	// Custom handler
	handler: async () => {
		const { data } = await agent.callAPI("BTC Price");
		return `Bitcoin is trading at $${data.price}`;
	},
};

// LangChain will:
// 1. Call LLM with tools
// 2. LLM selects get_btc_price
// 3. LangChain calls handler
// 4. handler calls agent.callAPI()
// 5. SDK handles x402 payment automatically
```

---

## Part 7: Configuration & Environment

### .env File

```bash
# Gateway & Chain
GATEWAY_URL=http://localhost:3001
RPC_URL=https://rpc-hoodi.morphl2.io
CHAIN_NAME=morph_hoodi

# Agent Wallet
AGENT_PRIVATE_KEY=0x...

# Smart Contracts
X402_FACILITATOR_ADDRESS=0x...
API_REGISTRY_ADDRESS=0x...
USDC_ADDRESS=0x...

# LLM Provider (choose one)
GROQ_API_KEY=gsk_...
# OR
OPENAI_API_KEY=sk-...

# Optional
DEBUG=false
VERBOSE=true
AUTO_MINT=true
AUTO_APPROVE=true
SETTLE_DELAY=2000
```

### Runtime Config

```javascript
const agent = createX402Agent({
	// Override env vars
	gateway: "https://api.example.com",
	privateKey: process.env.AGENT_PRIVATE_KEY,
	facilitator: process.env.X402_FACILITATOR_ADDRESS,

	llm: {
		provider: "groq", // or "openai"
		apiKey: process.env.GROQ_API_KEY,
		model: "llama-3.3-70b-versatile",
	},

	// Blockchain
	rpcUrl: process.env.RPC_URL,
	usdcAddress: process.env.USDC_ADDRESS,

	// Agent behavior
	autoMint: true,
	autoApprove: true,
	maxLoops: 10,
	temperature: 0.0,
	settleDelay: 2000,
	catalogTtl: 0, // 0 = never cache

	// UI & Debugging
	verbose: true,
	debug: false,

	// Framework integration
	onEvent: (type, payload) => {
		console.log(`[${type}]`, payload);
	},
});
```

---

## Summary: Typical User Journey

```
User starts agent:
  ↓
agent.run("What is BTC and ETH price?")
  ↓
1. Fetch catalog from gateway
2. Convert to OpenAI functions
3. Check balance, auto-mint if 0
4. Auto-approve USDC if needed
5. Send initial prompt to LLM
  ↓
LLM reasoning:
  - Sees "BTC Price" and "ETH Price" tools
  - Selects both as tool calls
  ↓
For each tool call:
  1. Get fresh nonce
  2. Sign payment locally (ECDSA)
  3. Build X-Payment header
  4. POST to /api/v1/call/:apiId
  5. Receive data
  6. Wait for on-chain settlement
  7. Add result to conversation
  ↓
LLM synthesis:
  - Receives both prices
  - No more tool calls needed
  - Synthesizes final answer: "BTC is $65,420 and ETH is $3,200"
  ↓
Return to user:
{
  answer: "BTC is $65,420 and ETH is $3,200",
  metrics: {
    totalSpent: "0.002000 USDC",  // Two calls at 0.001 each
    callsMade: 2
  }
}
```
