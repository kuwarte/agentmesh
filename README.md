<p align="center">
  <img src="docs/logo.ico" alt="Agent Mesh" width="80" /><br/>
  <strong style="font-size:2em">Agent Mesh</strong>
</p>

**Autonomous AI agents that discover, pay for, and call APIs — no human in the loop.**

Agent Mesh is an x402 agentic payment platform built on [Morph L2](https://morphl2.io). It lets AI agents autonomously purchase API access using on-chain USDC micropayments, with a 1% platform fee and 99% going directly to API providers.

> **Marketplace** — [x402agentmesh.vercel.app](https://x402agentmesh.vercel.app) · Built on Morph Hoodi Testnet · Chain ID `2910`

---

## What It Does

```
AI Agent  ──(picks tool)──▶  x402 Gateway  ──(settle USDC)──▶  Morph L2
                                    │
                            ◀────(API data)─────
```

1. An AI agent queries the **service catalog** to discover available paid APIs
2. It signs an off-chain payment voucher and attaches it as an `X-Payment` header
3. The gateway verifies the signature and calls `X402Facilitator.settle()` on-chain
4. The API response is returned — the provider wallet receives payment atomically

No 402 dance, no subscriptions, no API keys. Just sign and call.

---

## Repository Structure

```
agentmesh/
├── apps/
│   ├── web/                    # Next.js 15 frontend (Vercel)
│   │   ├── app/
│   │   │   ├── marketplace/    # API discovery + detail pages
│   │   │   ├── provider/       # Provider dashboard + earnings
│   │   │   └── api/            # Next.js API routes (wallet auth)
│   │   ├── components/
│   │   │   ├── layout/         # AppSidebar, Footer, Nav
│   │   │   └── sections/       # Landing page sections
│   │   ├── lib/
│   │   │   ├── apis.ts         # Static API catalog (→ Supabase)
│   │   │   ├── supabase.ts     # Supabase browser + server clients
│   │   │   └── chains.tsx      # Morph L2 wagmi chain config
│   │   └── hooks/
│   │       └── useReveal.tsx   # Scroll-reveal animation hook
│   │
│   └── backend/                # Express gateway (Node.js, port 3001)
│       └── src/
│           ├── server.ts
│           ├── routes/         # api, payment, registry, dashboard, faucet
│           ├── services/       # blockchain, ledger, nonce
│           └── middleware/
│               └── x402.middleware.ts   # Payment verification
│
├── packages/
│   ├── contracts/              # Foundry (Solidity)
│   │   └── src/
│   │       ├── APIRegistry.sol
│   │       ├── X402Facilitator.sol
│   │       └── MockUSDC.sol
│   │
│   └── x402-agent-sdk/         # Reusable agent SDK (ESM)
│       └── index.js            # X402Agent class + createX402Agent()
│
└── demo-agent/
    └── agent.mjs               # Standalone demo agent
```

---

## Contracts (Morph Hoodi Testnet)

| Contract | Address | Role |
|---|---|---|
| `APIRegistry.sol` | [`0x007c677F96A5E934D84502Ccd81FD161023b2cfA`](https://explorer-hoodi.morphl2.io/address/0x007c677F96A5E934D84502Ccd81FD161023b2cfA) | On-chain API registry — stores name, endpoint, price, provider |
| `X402Facilitator.sol` | [`0x980938b322d653789dE859b4aB0119C0b02016f4`](https://explorer-hoodi.morphl2.io/address/0x980938b322d653789dE859b4aB0119C0b02016f4) | Payment settlement — verifies ECDSA sig, splits USDC (99/1%) |
| `MockUSDC.sol` | [`0xC6F74786d5a0149611a77a2C2ABE1A049C48d492`](https://explorer-hoodi.morphl2.io/address/0xC6F74786d5a0149611a77a2C2ABE1A049C48d492) | ERC-20 test token with built-in faucet (1000 USDC/hr per wallet) |

### Built-in Feeds

The gateway ships with four built-in paid APIs that auto-register on-chain at startup:

| Feed | Route | Price | Note |
|---|---|---|---|
| BTC Price | `/api/v1/call/<apiId>` | $0.001 USDC | **Mock data** — randomised price |
| ETH Price | `/api/v1/call/<apiId>` | $0.001 USDC | **Mock data** — randomised price |
| SOL Price | `/api/v1/call/<apiId>` | $0.0005 USDC | **Mock data** — randomised price |
| Gas Tracker | `/api/v1/call/<apiId>` | $0.0005 USDC | **Mock data** — randomised gwei values |

> The built-in feeds return simulated data. They exist to demonstrate the full x402 payment flow end-to-end on testnet. Replace the handlers in `src/routes/api.routes.ts` (`/internal/:key`) with real data sources for production use.

---

## Backend API Routes

**Public**

| Method | Route | Description |
|---|---|---|
| `GET` | `/config` | Network info, contract addresses, quickstart guide |
| `GET` | `/api/v1/catalog` | Full service catalog with prices (no payment required) |

**Paid APIs** (require `X-Payment` header)

| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/v1/call/:apiId` | Universal proxy — calls any registered API after verifying payment |

**Payment**

| Method | Route | Description |
|---|---|---|
| `GET` | `/payment/nonce` | Get fresh nonce + deadline (5 min TTL) |
| `POST` | `/payment/verify` | Pre-flight signature check |
| `GET` | `/payment/balance/:address` | USDC balance |
| `GET` | `/payment/status` | Facilitator contract status |

**Registry**

| Method | Route | Description |
|---|---|---|
| `GET` | `/registry/apis` | List all on-chain APIs (marketplace) |
| `GET` | `/registry/api/:id` | Single API detail merged with metadata |
| `GET` | `/registry/slug/:slug` | Resolve a URL slug to API detail |
| `GET` | `/registry/provider/:address` | All APIs registered by a provider |
| `GET` | `/registry/categories` | Distinct categories for marketplace filter |
| `GET` | `/registry/stats` | Total API count + chain status |
| `POST` | `/registry/register` | Register a new API on-chain *(requires `x-internal-key`)* |
| `PUT` | `/registry/api/:id` | Update price or active status *(requires `x-internal-key`)* |
| `POST` | `/registry/metadata/:id` | Submit off-chain metadata (category, tags, description) |

**Dashboard & Provider**

| Method | Route | Description |
|---|---|---|
| `GET` | `/dashboard/:address` | Earnings + activity for a wallet |
| `GET` | `/provider/:address` | Provider portal — APIs + stats |

**Faucet (testnet)**

| Method | Route | Description |
|---|---|---|
| `POST` | `/faucet/mint` | Mint 1000 MockUSDC to an address |
| `GET` | `/faucet/status/:address` | Check cooldown remaining |

---

## x402 Agent SDK

Install as a local package or copy `packages/x402-agent-sdk/index.js` into your project.

```js
import { createX402Agent } from './packages/x402-agent-sdk/index.js';

const agent = createX402Agent({
  // All config is optional — falls back to .env
  llm: { provider: 'groq' },  // or 'openai'
  autoMint: true,
  autoApprove: true,
});

const result = await agent.run('What is the current BTC price?');
console.log(result.answer);
// → "The current BTC price is $65,420."
console.log(result.metrics);
// → { totalSpent: '0.001000 USDC', callsMade: 1 }
```

### SDK Config

| Option | Default | Description |
|---|---|---|
| `gateway` | `$GATEWAY_URL` or `http://localhost:3001` | x402 gateway URL — must include `https://` scheme |
| `privateKey` | `$AGENT_PRIVATE_KEY` | Agent wallet private key |
| `facilitator` | `$X402_FACILITATOR_ADDRESS` | Facilitator contract address |
| `llm.provider` | `"groq"` | `"groq"` or `"openai"` |
| `llm.apiKey` | `$GROQ_API_KEY` | LLM provider API key |
| `autoMint` | `false` | Auto-mint test USDC when balance is 0 |
| `autoApprove` | `false` | Auto-approve USDC spending |
| `verbose` | `false` | Rich terminal UI with live status |
| `maxLoops` | `10` | Max AI reasoning iterations |
| `settleDelay` | `3000` | ms to wait after each payment (allow on-chain settle) |
| `onEvent` | `null` | Event hook `(type, payload) => void` |

### Event Hooks

```js
const agent = createX402Agent({
  onEvent: (type, payload) => {
    if (type === 'payment:success') {
      console.log(`Paid ${payload.amountUsd} USDC to ${payload.provider}`);
    }
  }
});
```

| Event | Payload fields |
|---|---|
| `catalog:loaded` | `count`, `catalog` |
| `balance:checked` | `address`, `usdcBalance` |
| `tool:called` | `name`, `apiId`, `args`, `pricePerCall` |
| `payment:signing` | `callUrl`, `provider`, `amount` |
| `payment:success` | `callUrl`, `provider`, `amountUsd`, `nonce`, `data` |
| `payment:failed` | `callUrl`, `status`, `error` |
| `tool:result` | `name`, `apiId`, `success`, `data` or `error` |
| `run:complete` | `answer`, `metrics` |

### Direct API Call (bypass LLM)

```js
// Useful for LangChain tool definitions or custom agent loops
const result = await agent.callAPI('BTC Price');
console.log(result.data);       // API response
console.log(result.amountUsd);  // "0.001000"
```

---

## Getting Started

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full system diagram and payment flow.

### Prerequisites

- [Foundry](https://getfoundry.sh) (`forge`, `cast`)
- Node.js 18+
- pnpm
- A wallet with Hoodi ETH — [Morph faucet](https://morphl2.io/faucet)

### 1 — Build contracts

```bash
cd packages/contracts
forge build
```

ABIs land in `packages/contracts/out/`. The backend imports from there — don't skip this.

### 2 — Deploy MockUSDC

```bash
forge script script/DeployMockUSDC.s.sol \
  --rpc-url morph_hoodi \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast
```

Copy the printed `MockUSDC` address.

### 3 — Deploy APIRegistry + X402Facilitator

```bash
USDC_ADDRESS=<MOCK_USDC_ADDRESS> \
TREASURY_ADDRESS=<YOUR_WALLET_ADDRESS> \
forge script script/Deploy.s.sol \
  --rpc-url morph_hoodi \
  --private-key <YOUR_PRIVATE_KEY> \
  --broadcast
```

### 4 — Configure backend `.env`

```bash
# apps/backend/.env
RPC_URL=https://rpc-hoodi.morphl2.io
CHAIN_NAME=morph_hoodi
GATEWAY_PRIVATE_KEY=<YOUR_PRIVATE_KEY>
GATEWAY_URL=https://your-backend.railway.app  # must include https:// — used to register built-in endpoints on-chain
API_REGISTRY_ADDRESS=0x007c677F96A5E934D84502Ccd81FD161023b2cfA
X402_FACILITATOR_ADDRESS=0x980938b322d653789dE859b4aB0119C0b02016f4
USDC_ADDRESS=0xC6F74786d5a0149611a77a2C2ABE1A049C48d492
PROVIDER_ADDRESS=<YOUR_WALLET_ADDRESS>
TREASURY_ADDRESS=<YOUR_WALLET_ADDRESS>
FACILITATOR_DEPLOY_BLOCK=5652133          # avoids scanning from block 0
INTERNAL_API_KEY=<RANDOM_SECRET>          # protects POST /registry/register and PUT /registry/api/:id
```

> `GATEWAY_URL` must be a full URL including the `https://` scheme (e.g. `https://your-backend.railway.app`). At startup the server calls `autoRegisterBuiltins()` which registers the built-in feed endpoints on-chain using this value. If it's missing the scheme or left as `localhost`, those entries on-chain will point to an unreachable address and the agent SDK will throw `ERR_INVALID_URL`.
>
> `INTERNAL_API_KEY` guards the registry write endpoints. Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 5 — Start the backend

```bash
cd apps/backend
pnpm install

# development (hot reload)
pnpm dev

# production build
# Note: forge build must be run in packages/contracts first — tsc build copies the ABIs automatically
pnpm build
pnpm start
# → http://localhost:3001
```

### 6 — Get MockUSDC

```bash
curl -X POST http://localhost:3001/faucet/mint \
  -H "Content-Type: application/json" \
  -d '{"address": "<YOUR_WALLET_ADDRESS>"}'
```

Or call on-chain directly:

```bash
cast send 0xC6F74786d5a0149611a77a2C2ABE1A049C48d492 "mint()" \
  --private-key <YOUR_PRIVATE_KEY> \
  --rpc-url https://rpc-hoodi.morphl2.io
```

### 7 — Run the demo agent

```bash
cd packages/x402-agent-sdk
cp .env.example .env
# Fill in GROQ_API_KEY and AGENT_PRIVATE_KEY
# Make sure GATEWAY_URL includes the https:// scheme, e.g.:
#   GATEWAY_URL=https://apiagentmesh-production.up.railway.app
```

Then run the standalone demo:

```bash
cd demo-agent
node agent.mjs "Analyze the crypto market and give a trading recommendation"
```

The agent auto-mints, auto-approves, picks the right tools, pays, and returns an answer.

---

## Running Contract Tests

```bash
cd packages/contracts
forge test -vv
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| `ERR_INVALID_URL` | `GATEWAY_URL` is missing the `https://` scheme — e.g. use `https://your-backend.railway.app` not just `your-backend.railway.app` |
| `RPC not available` | Check https://rpc-hoodi.morphl2.io status |
| `Invalid signature` | `payer` in `X-Payment` must match the signing wallet; check `FACILITATOR_ADDRESS` matches across `.env` files |
| `Nonce used` | Nonces are single-use — fetch a fresh one from `GET /payment/nonce` |
| `Provider payment failed` | Agent wallet hasn't approved the facilitator, or has no MockUSDC |
| `Cooldown active` | Faucet allows 1 mint/hr per wallet — check `GET /faucet/status/:address` |
| `Expired` | Nonces expire in 5 minutes |
| `ABIs not found` | Run `forge build` in `packages/contracts` first |
| `403 Forbidden` on `/registry/register` | Set `INTERNAL_API_KEY` in `.env` and pass it as `x-internal-key` header |
| Built-in feeds skip registration on redeploy | Deactivating an API doesn't remove it from the name check — see the note in `autoRegisterBuiltins()` in `src/routes/api.routes.ts` |
| Slow ledger replay on startup | Set `FACILITATOR_DEPLOY_BLOCK` in `.env` to the deployment block number |

---

## Network

| | |
|---|---|
| Network | Morph Hoodi Testnet |
| Chain ID | `2910` |
| RPC | `https://rpc-hoodi.morphl2.io` |
| Explorer | `https://explorer-hoodi.morphl2.io` |
| APIRegistry | `0x007c677F96A5E934D84502Ccd81FD161023b2cfA` |
| X402Facilitator | `0x980938b322d653789dE859b4aB0119C0b02016f4` |
| MockUSDC | `0xC6F74786d5a0149611a77a2C2ABE1A049C48d492` |
| Deployed at block | `5652133` |

---

## Tech Stack

- **Frontend** — Next.js 15, Tailwind CSS, wagmi, WalletConnect, TanStack Query
- **Backend** — Express, Node.js, ethers.js v6
- **Contracts** — Solidity, Foundry
- **Database** — Supabase (API metadata)
- **Chain** — Morph L2 (EVM-compatible)
- **AI** — Groq (llama-3.3-70b) / OpenAI GPT-4o

---

*@authors De-Finitely Broke*
