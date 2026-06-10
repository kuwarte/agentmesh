# AgentMesh — System Architecture

---

## High-Level Overview

```
┌─────────────────────────┐          ┌───────────────────────────────────────┐
│   Human User / Provider │          │      AI Agent (x402-agent-sdk)        │
│                         │          │                                       │
│  • Browse marketplace   │          │  • Wallet (ethers.Wallet)             │
│  • Register APIs        │          │  • LLM reasoning (Groq / OpenAI)      │
│  • View earnings        │          │  • Auto-approve USDC spending         │
│  • Mint test USDC       │          │  • Auto-mint via faucet               │
└────────────┬────────────┘          └──────────────────┬────────────────────┘
             │ HTTPS (browser)                          │ HTTPS
             │ human-facing UI only                     │ fetch + X-Payment header
             ▼                                          │ (bypasses frontend)
┌────────────────────────────────────────┐              │
│         FRONTEND  (Next.js 15)         │              │
│         apps/web  — port 3000          │              │
│                                        │              │
│  /                  Landing page       │              │
│  /marketplace       API grid, search   │              │
│  /marketplace/[slug]  Detail + schema  │              │
│  /provider/[address]  Earnings dash    │              │
└────────────────────┬───────────────────┘              │
                     │ REST                             │ REST
                     └──────────────────┬───────────────┘
                                        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                  BACKEND GATEWAY  (Express / Node.js)                     │
│                    apps/backend  — port 3001                              │
│                                                                           │
│  Routes                                Services                           │
│  ─────────────────────────────         ───────────────────────────────    │
│  GET  /api/v1/catalog                  blockchain.service.ts              │
│  GET  /api/v1/btc|eth|sol|gas            • ethers.js provider             │
│  GET  /api/v1/call/:apiId                • Read APIRegistry               │
│                                          • Call X402Facilitator.settle()  │
│  GET  /payment/nonce                     • Replay PaymentSettled events   │
│  POST /payment/verify                                                     │
│  GET  /payment/balance/:address        ledger.service.ts                  │
│                                          • In-memory analytics cache      │
│  GET  /registry/apis                     • Per-provider earnings          │
│  POST /registry/register                 • Total call counts              │
│  PUT  /registry/api/:id                                                   │
│                                        nonce.service.ts                   │
│  GET  /dashboard/:address                • Nonce + deadline generation    │
│  GET  /provider/:address                 • In-memory nonce cache          │
│                                          • Replay-attack guard            │
│  POST /faucet/mint                                                        │
│  GET  /faucet/status/:address          Middleware                         │
│                                          x402.middleware.ts               │
│  GET  /config                            • Parse X-Payment header         │
│                                          • Decode base64 JSON             │
│                                          • Verify ECDSA signature         │
│                                          • Call settle() on-chain         │
│                                          • Block invalid payments         │
└─────────────────────┬──────────────────────────┬──────────────────────────┘
                      │                          │
           ┌──────────┘                          └──────────────────┐
           ▼                                                        ▼
┌──────────────────┐                        ┌────────────────────────────────────────┐
│    SUPABASE      │                        │         MORPH L2  (chainId: 2910)      │
│  API metadata    │                        │         Morph Hoodi Testnet            │
│  • descriptions  │                        │                                        │
│  • params schema │                        │  APIRegistry.sol                       │
│  • tags          │                        │  ─────────────────────────────────     │
└──────────────────┘                        │  struct API {                          │
                                            │    address  provider                   │
                                            │    string   name                       │
                                            │    string   endpoint                   │
                                            │    uint256  pricePerCall               │
                                            │    bool     active                     │
                                            │  }                                     │
                                            │                                        │
                                            │  registerAPI(name, endpoint, price)    │
                                            │  getAPI(apiId)                         │
                                            │  getAllAPIs()                          │
                                            │  updateAPI(apiId, price, active)       │
                                            │                                        │
                                            │  X402Facilitator.sol                   │
                                            │  ─────────────────────────────────     │
                                            │  settle(payer, provider, amount,       │
                                            │         nonce, deadline, signature)    │
                                            │                                        │
                                            │  • Verifies ECDSA sig == payer         │
                                            │  • Replay protection via nonces        │
                                            │  • Deadline enforcement                │
                                            │  • 1% platform fee → treasury          │
                                            │  • 99% → provider wallet              │
                                            │                                        │
                                            │  MockUSDC.sol  (ERC-20 testnet)        │
                                            │  ─────────────────────────────────     │
                                            │  • mint(address, amount)               │
                                            │  • Faucet: 1000 USDC / hr              │
                                            └────────────────────────────────────────┘
```

---

## Payment Flow

How a single paid API call moves through the system, from agent to on-chain settlement.

```
AI Agent                Gateway (Express)           Morph L2
────────                ─────────────────           ────────

  │  1. GET /api/v1/catalog                │
  │ ─────────────────────────────────────► │
  │ ◄───────────────────────────────────── │
  │    [{ name, callUrl, pricePerCall }]   │

  │  2. GET /payment/nonce                 │
  │ ─────────────────────────────────────► │
  │ ◄───────────────────────────────────── │
  │    { nonce, deadline }                 │

  │  3. Sign off-chain                     │
  │    keccak256(                          │
  │      facilitator + payer +             │
  │      provider   + amount +            │
  │      nonce      + deadline            │
  │    )                                   │

  │  4. Call paid API                      │
  │    X-Payment: base64({                 │
  │      payer, provider, amount,          │
  │      nonce, deadline, signature })     │
  │ ─────────────────────────────────────► │
  │                                        │  5. x402 middleware
  │                                        │     verify ECDSA signature
  │                                        │
  │                                        │  6. settle(payer, provider,
  │                                        │     amount, nonce, deadline,
  │                                        │     signature)
  │                                        │ ────────────────────────────►
  │                                        │                              │ 7. Verify sig
  │                                        │                              │    Check nonce (replay guard)
  │                                        │                              │    Check deadline
  │                                        │                              │    transferFrom payer → provider (99%)
  │                                        │                              │    transferFrom payer → treasury (1%)
  │                                        │                              │    emit PaymentSettled
  │                                        │ ◄────────────────────────────
  │                                        │    PaymentSettled event
  │                                        │
  │  8. Receive API response               │
  │ ◄───────────────────────────────────── │
  │    { data: ... }                       │
```

---

## SDK Architecture

### Class Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      X402Agent                              │
├─────────────────────────────────────────────────────────────┤
│  Core                                                       │
│    wallet          ethers.Wallet  — signing key             │
│    agentAddress    string         — "0xAgent..."            │
│    gateway         string         — backend URL             │
│    facilitator     string         — contract address        │
│    llm             OpenAI         — Groq or OpenAI client   │
│    provider        JsonRpcProvider                          │
│    signer          Signer         — connected wallet        │
│                                                             │
│  State                                                      │
│    catalog         API[]          — cached service list     │
│    tools           OpenAITool[]   — function-calling format │
│    toolMap         Record<name, meta>                       │
│                                                             │
│  Config                                                     │
│    maxLoops        number  — max AI reasoning iterations    │
│    temperature     number  — LLM temperature (0=fixed)      │
│    settleDelay     ms      — wait for on-chain settle       │
│    autoMint        bool    — auto-get test tokens           │
│    autoApprove     bool    — auto-approve USDC              │
│    catalogTtl      ms      — cache expiry (0=forever)       │
│    onEvent         Function — event hook callback           │
└─────────────────────────────────────────────────────────────┘
```

### Method Flow

```
agent.run(task)
  │
  ├── fetchCatalog()          GET /api/v1/catalog
  ├── _catalogToTools()       convert to OpenAI function-calling format
  ├── _ensureAllowance()      check / approve USDC spending
  │
  └── AI Loop (up to maxLoops)
        │
        ├── LLM picks tools from catalog
        │
        ├── for each tool_call:
        │     ├── callPaidAPI()
        │     │     ├── GET /payment/nonce
        │     │     ├── signPayment()         off-chain ECDSA
        │     │     ├── buildXPayment()       base64 JSON header
        │     │     ├── fetch(apiUrl, { X-Payment })
        │     │     └── wait settleDelay
        │     └── emit events
        │
        ├── feed results back to LLM
        └── if no tool_calls → extract final answer → return
```

### Catalog → OpenAI Tools Pipeline

```
GET /api/v1/catalog
        │
        ▼
  Raw Catalog Entry
  {
    apiId:        "0x123abc..."
    name:         "BTC Price"
    callUrl:      "/api/v1/call/0x123..."
    pricePerCall: "1000"          ← micro USDC (1 USDC = 1,000,000)
    priceUsd:     "0.001000"
    provider:     "0xProvider..."
    description:  "..."           ← from Supabase
    params:       [{ name, type, required, description }]
  }
        │
        ▼  _catalogToTools()
        │
  OpenAI Function-Calling Format
  {
    type: "function",
    function: {
      name:        "btc_price",   ← JS-safe identifier
      description: "Real-time BTC/USD price. Costs $0.001000 USDC per call.",
      parameters: {
        type: "object",
        properties: { ... },      ← built from params
        required: [...]
      }
    },
    _meta: {                      ← preserved for execution
      callUrl, provider,
      pricePerCall, name, apiId
    }
  }
        │
        ▼
  Passed to LLM for tool selection
        │
        ▼
  LLM picks tool → lookup _meta → callPaidAPI()
```

---

## Event Lifecycle

```
agent.run() event sequence
──────────────────────────

  catalog:loaded        { count, catalog }
        │
  balance:checked       { address, usdcBalance }
        │
  (for each tool)
        │
  tool:called           { name, apiId, args, pricePerCall }
        │
  payment:signing       { callUrl, provider, amount }
        │
  payment:success       { callUrl, provider, amountUsd, nonce, data }
    OR
  payment:failed        { callUrl, status, error }
        │
  tool:result           { name, apiId, success, data | error }
        │
  (repeat for each tool)
        │
  run:complete          { answer, metrics: { totalSpent, callsMade } }
```

---

## Contract Interaction Model

```
                  ┌──────────────┐
  Provider        │  API         │
  registers  ───► │  Registry    │  on-chain source of truth
                  │  .sol        │  for API catalog + pricing
                  └──────┬───────┘
                         │ getAPI() / getAllAPIs()
                         ▼
                  ┌──────────────┐
                  │  Backend     │  reads registry, builds catalog,
                  │  Gateway     │  serves /api/v1/catalog
                  └──────┬───────┘
                         │ settle()
                         ▼
                  ┌──────────────────────┐       ┌──────────────┐
  Agent  ───sig──►│  X402               │──99%──►│  Provider    │
  wallet          │  Facilitator.sol     │        │  wallet      │
                  │                      │──1%───►│  Treasury    │
                  │  • verify ECDSA      │        └──────────────┘
                  │  • check nonce       │
                  │  • check deadline    │
                  │  • transferFrom USDC │
                  └──────────────────────┘
                           ▲
                  ┌─────────────────────┐
                  │  MockUSDC.sol       │
                  │  ERC-20 test token  │
                  │  • 1000 USDC/hr     │
                  │    per wallet       │
                  └─────────────────────┘
```

---

## Configuration Hierarchy (SDK)

```
Hardcoded defaults
      │
      ▼
Environment variables (.env)
      GATEWAY_URL
      AGENT_PRIVATE_KEY
      X402_FACILITATOR_ADDRESS
      RPC_URL
      USDC_ADDRESS
      GROQ_API_KEY  (or OPENAI_API_KEY)
      AUTO_APPROVE / AUTO_MINT
      │
      ▼
Runtime config (constructor argument)
      createX402Agent({
        gateway:     "https://...",
        privateKey:  "0x...",
        llm:         { provider: "openai", ... },
        autoMint:    false,
        settleDelay: 5000,
      })
      │
      ▼
Final resolved config used by the SDK
```

---

## Error Handling (SDK)

```
callPaidAPI()
      │
      ├── 200 OK?
      │     ├── Record success
      │     ├── totalSpent += pricePerCall
      │     ├── emit payment:success
      │     └── add to tool results
      │
      └── Non-200 or throw
            ├── failedTools.add(toolName)
            ├── emit payment:failed
            └── add error to tool results
                      │
                      ▼
            Next LLM iteration:
            • failed tool is skipped
            • if ALL tools failed → force final answer → stop loop
            • if some succeeded  → LLM synthesizes with available data
```

---

## Network Details

| | |
|---|---|
| Network | Morph Hoodi Testnet |
| Chain ID | `2910` |
| RPC | `https://rpc-hoodi.morphl2.io` |
| Explorer | `https://explorer-hoodi.morphl2.io` |
| Token | MockUSDC (ERC-20, 6 decimals) |
| Fee split | 99% provider · 1% treasury |
| Nonce TTL | 5 minutes |
| Faucet limit | 1000 USDC / hr / wallet |
