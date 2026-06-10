# x402Agent SDK - Visual Reference

## Class Structure

```
┌────────────────────────────────────────────────────────────────┐
│                     X402Agent Class                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PROPERTIES:                                                   │
│  • wallet (ethers.Wallet)         — Agent's signing key        │
│  • agentAddress (string)          — "0xAgent..."               │
│  • gateway (string)               — Backend URL                │
│  • facilitator (string)           — Contract address           │
│  • llm (OpenAI)                   — LLM client                 │
│  • logger (TuiLogger)             — Terminal UI                │
│  • catalog (Array)                — Cached API list            │
│  • tools (Array)                  — OpenAI function format     │
│  • toolMap (Object)               — Quick lookup by name       │
│  • provider (JsonRpcProvider)     — Blockchain RPC             │
│  • signer (Signer)                — Connected wallet           │
│  • onEvent (Function)             — Event hook callback        │
│                                                                │
│  CONFIGURATION:                                                │
│  • maxLoops (number)              — Max AI reasoning loops     │
│  • temperature (number)           — LLM temperature (0=fixed)  │
│  • settleDelay (ms)               — Wait for on-chain settle   │
│  • autoMint (bool)                — Auto-get test tokens       │
│  • autoApprove (bool)             — Auto-approve USDC          │
│  • catalogTtl (ms)                — Cache expiry (0=forever)   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Method Call Graph

```
PUBLIC METHODS (User calls these):
│
├─ new X402Agent(config)
│   └─ constructor()
│      ├─ Load env vars
│      ├─ Create wallet
│      ├─ Init LLM
│      └─ Setup logger
│
├─ agent.run(task)
│   └─ Full AI reasoning loop
│      ├─ fetchCatalog()
│      │  └─ GET /api/v1/catalog
│      ├─ _catalogToTools()
│      │  └─ Convert to OpenAI format
│      ├─ _ensureAllowance()
│      │  └─ Check USDC approval
│      ├─ AI Loop (maxLoops):
│      │  ├─ LLM picks tools
│      │  ├─ callPaidAPI() ← FOR EACH TOOL
│      │  │  ├─ GET /payment/nonce
│      │  │  ├─ signPayment()
│      │  │  ├─ buildXPayment()
│      │  │  ├─ fetch(apiUrl)
│      │  │  ├─ Wait settleDelay
│      │  │  └─ _emit('payment:success')
│      │  └─ Feed results back to LLM
│      └─ Extract answer + metrics
│
└─ agent.callAPI(nameOrId, args)
   └─ Direct tool call (bypass AI loop)
      └─ callPaidAPI()
         └─ (same as above)

PRIVATE METHODS (SDK internal):
│
├─ _fetch(url, options)
│   └─ Fetch wrapper with debug logging
├─ _debug(msg, depth)
│   └─ Log debug messages
├─ _emit(type, payload)
│   └─ Fire event hook callback
├─ _wrapText(text, width)
│   └─ Format text for box display
├─ _ensureAllowance()
│   └─ Check/approve USDC spending
├─ signPayment()
│   └─ ECDSA sign the payment
├─ buildXPayment()
│   └─ Serialize to base64 header
└─ _catalogToTools()
   └─ Transform to OpenAI format
```

## Data Transformation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    PIPELINE: Raw Catalog                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    GET /api/v1/catalog
                            ↓
            ┌─────────────────────────────────────┐
            │  Raw Catalog Entry (JSON)           │
            ├─────────────────────────────────────┤
            │ {                                   │
            │   apiId: "0x123abc...",             │
            │   name: "BTC Price",                │
            │   endpoint: "http://...",           │
            │   callUrl: "/api/v1/call/0x123...", │
            │   pricePerCall: "1000",             │
            │   priceUsd: "0.001000",             │
            │   provider: "0xProvider...",        │
            │   description: "...",               │ (from Supabase)
            │   params: [{ name, type, req... }]  │ (from Supabase)
            │ }                                   │
            └─────────────────────────────────────┘
                            ↓
                 _catalogToTools()
                            ↓
        ┌────────────────────────────────────────────┐
        │  OpenAI Function-Calling Format            │
        ├────────────────────────────────────────────┤
        │ {                                          │
        │   type: "function",                        │
        │   function: {                              │
        │     name: "btc_price",  ← JS-safe name    │
        │     description: "Real-time BTC/USD...",  │
        │     parameters: {                          │
        │       type: "object",                      │
        │       properties: { /* from params */ },  │
        │       required: ["price"]                 │
        │     }                                      │
        │   },                                       │
        │   _meta: {  ← PRESERVED FOR EXECUTION    │
        │     callUrl: "/api/v1/call/0x123...",    │
        │     provider: "0xProvider...",            │
        │     pricePerCall: "1000",                │
        │     name: "BTC Price",                    │
        │     apiId: "0x123abc..."                  │
        │   }                                        │
        │ }                                          │
        └────────────────────────────────────────────┘
                            ↓
            Passed to LLM for tool selection
                            ↓
            LLM picks tool, we lookup _meta
                            ↓
            Execute with callPaidAPI()
```

## Payment Signing Sequence

```
Agent Wallet              x402Agent              Backend Gateway
    │                          │                        │
    │  agent.run(task)         │                        │
    │─────────────────────────>│                        │
    │                          │                        │
    │                          │  GET /api/v1/catalog   │
    │                          │───────────────────────>│
    │                          │  [APIs + metadata]     │
    │                          │<───────────────────────│
    │                          │                        │
    │                          │ (LLM picks tools)      │
    │                          │                        │
    │                          │ GET /payment/nonce     │
    │                          │───────────────────────>│
    │                          │ {nonce, deadline}      │
    │                          │<───────────────────────│
    │                          │                        │
    │ Sign (ECDSA)             │                        │
    │<────────── signPayment() │                        │
    │                          │                        │
    │ keccak256(                                        │
    │   facilitator +                                   │
    │   payer +                                         │
    │   provider +                                      │
    │   amount +                                        │
    │   nonce +                                         │
    │   deadline                                        │
    │ )                        │                        │
    │                          │                        │
    │ wallet.signMessage()     │                        │
    │ → signature              │                        │
    │─────signature────────────>                        │
    │                          │                        │
    │                          │ buildXPayment()        │
    │                          │ {                      │
    │                          │   payer,               │
    │                          │   provider,            │
    │                          │   amount,              │
    │                          │   nonce,               │
    │                          │   deadline,            │
    │                          │   signature            │
    │                          │ }                      │
    │                          │ → base64()             │
    │                          │                        │
    │                          │ POST /api/v1/call      │
    │                          │ X-Payment: base64(...) │
    │                          │───────────────────────>│
    │                          │                        │ (verify sig)
    │                          │                        │ (proxy call)
    │                          │                        │ (settle async)
    │                          │ 200 OK {data}          │
    │                          │<───────────────────────│
    │                          │                        │
    │                          │ (wait settleDelay)     │
    │                          │                        │
    │                          │ (return answer)        │
    │<───────────answer────────│                        │
    │                          │                        │
```

## AI Reasoning Loop Visualization

```
┌─────────────────────────────────────────────────────────────┐
│              AI REASONING LOOP (max N iterations)           │
└─────────────────────────────────────────────────────────────┘

ITERATION 1:
┌─────────────────────────────────┐
│  LLM Call #1                    │
│  Input:                         │
│  - System prompt                │
│  - User task                    │
│  - Available tools              │
│                                 │
│  Output:                        │
│  - tool_calls: [                │
│      { name: "btc_price" },     │
│      { name: "eth_price" }      │
│    ]                            │
└─────────────────────────────────┘
         ↓
    Execute Tools
    ├─ callPaidAPI("btc_price") → { price: 65420 }
    └─ callPaidAPI("eth_price") → { price: 3200 }
         ↓
   Add Results to Messages
   └─ messages.push({
        role: "tool",
        content: { price: 65420 },  ← btc_price
        content: { price: 3200 }    ← eth_price
      })

ITERATION 2:
┌─────────────────────────────────┐
│  LLM Call #2                    │
│  Input:                         │
│  - Previous messages            │
│  - Tool results                 │
│  - Available tools (again)      │
│                                 │
│  Output:                        │
│  - tool_calls: [] ← EMPTY!      │
│  - content: "BTC is $65,420..." │
│    (Now LLM synthesizes answer) │
└─────────────────────────────────┘
         ↓
    No more tools → STOP LOOP
         ↓
    Extract final_text and return

OPTIONAL ITERATION 3+:
If LLM calls more tools:
  → Execute them
  → Add results
  → Loop again
  (up to maxLoops)

If all tools fail in one round:
  → Force final answer (no tools)
  → Stop loop
```

## Event Hook Lifecycle

```
┌──────────────────────────────────────────────────┐
│         agent.run() Events Timeline              │
└──────────────────────────────────────────────────┘

┌──────────────────────────────┐
│ 'catalog:loaded'             │
│ { count, catalog }           │
└──────────────────────────────┘
             ↓
┌──────────────────────────────┐
│ 'balance:checked'            │
│ { address, usdcBalance }     │
└──────────────────────────────┘
             ↓
     (for each tool called)
             ↓
┌──────────────────────────────┐
│ 'tool:called'                │
│ { name, apiId, args, price } │
└──────────────────────────────┘
             ↓
┌──────────────────────────────┐
│ 'payment:signing'            │
│ { callUrl, provider, amount }│
└──────────────────────────────┘
             ↓
┌──────────────────────────────┐
│ 'payment:success'            │
│ { callUrl, provider,         │
│   amountUsd, nonce, data }   │
│ (OR)                         │
│ 'payment:failed'             │
│ { callUrl, status, error }   │
└──────────────────────────────┘
             ↓
┌──────────────────────────────┐
│ 'tool:result'                │
│ { name, apiId, success,      │
│   data (or error) }          │
└──────────────────────────────┘
             ↓
          (repeat for each tool)
             ↓
┌──────────────────────────────┐
│ 'run:complete'               │
│ { answer, metrics: {         │
│    totalSpent,               │
│    callsMade               } │
└──────────────────────────────┘
```

## Configuration Hierarchy

```
Default Values (hardcoded)
         ↓
Environment Variables (.env)
    GATEWAY_URL=...
    AGENT_PRIVATE_KEY=...
    X402_FACILITATOR_ADDRESS=...
    RPC_URL=...
    USDC_ADDRESS=...
    GROQ_API_KEY=... (or OPENAI_API_KEY)
         ↓
Runtime Config (passed to constructor)
    const agent = createX402Agent({
      gateway: "https://custom.com",
      privateKey: "0x...",
      llm: { provider: "openai", ... },
      autoMint: false,
      settleDelay: 5000,
      ...
    })
         ↓
Final Configuration (used by SDK)
    this.gateway = "https://custom.com"
    this.wallet = ethers.Wallet(...)
    this.llm = OpenAI(...)
    ...
```

## Error Handling Strategy

```
Tool Execution Flow:

    callPaidAPI()
         ↓
    Success (200)?
    ├─ YES → Record success
    │        totalSpent += amount
    │        callCount++
    │        _emit('payment:success')
    │        Add to toolResults
    │
    └─ NO → Failure
             failedTools.add(name)
             _emit('payment:failed')
             Add error to toolResults

             On next LLM call:
             Skip this tool (already failed)

Round Completion Check:

    If ALL tools failed this round:
    └─ Force final answer (no tools)
       └─ Stop looping
       └─ Return whatever answer LLM synthesizes

    Else (some succeeded):
    └─ Continue normal loop
       └─ LLM gets both successes and failures
       └─ LLM decides next action
```

## Direct API Calling (Bypass AI)

```
For LangChain or Custom Agents:

    agent.callAPI("BTC Price")
         ↓
    Find API in catalog
    (by name or apiId)
         ↓
    Call callPaidAPI() directly
    (no LLM involved)
         ↓
    Return {
      data: { ... },
      amountUsd: "0.001000",
      nonce: "0x..."
    }

Use Case:
    - LangChain tool definition
    - Custom agent loop
    - Non-LLM integrations
    - Direct API calls without reasoning
```
