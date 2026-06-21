import type { Metadata } from "next";
import Link from "next/link";
import AppSidebar from "@/components/layout/AppSidebar";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Docs — AgentMesh",
  description:
    "Complete documentation for browsing, paying, and calling APIs on AgentMesh using x402 and USDC on Morph L2.",
};

const NAV_SECTIONS = [
  { label: "Overview",       href: "#overview" },
  { label: "How it works",   href: "#how-it-works" },
  { label: "Quick start",    href: "#quickstart" },
  { label: "Payment flow",   href: "#payment-flow" },
  { label: "SDK",            href: "#sdk" },
  { label: "Contracts",      href: "#contracts" },
  { label: "Network",        href: "#network" },
  { label: "FAQ",            href: "#faq" },
];

const PAYMENT_STEPS = [
  {
    n: "01",
    title: "Fetch catalog",
    body: "The agent (or browser) hits GET /api/v1/catalog. The gateway reads APIRegistry.sol on Morph and returns every live API with its price in micro-USDC.",
    code: "GET /api/v1/catalog",
  },
  {
    n: "02",
    title: "Get a nonce",
    body: "Before signing, request a fresh nonce + deadline from GET /payment/nonce. Nonces expire in 5 minutes and are single-use to prevent replay attacks.",
    code: "GET /payment/nonce\n→ { nonce, deadline }",
  },
  {
    n: "03",
    title: "Sign off-chain",
    body: "Construct the EIP-191 payload and sign it locally with your wallet. Nothing hits the chain yet — the signature is just base64-encoded JSON.",
    code: "keccak256(\n  facilitator + payer +\n  provider   + amount +\n  nonce      + deadline\n)",
  },
  {
    n: "04",
    title: "Send X-Payment header",
    body: "Attach the encoded payment to your API call. The x402 middleware on the gateway verifies the ECDSA signature, then calls settle() on-chain.",
    code: 'X-Payment: base64({\n  payer, provider, amount,\n  nonce, deadline, sig\n})',
  },
  {
    n: "05",
    title: "On-chain settlement",
    body: "X402Facilitator.sol verifies the signature, checks the nonce, enforces the deadline, and transfers USDC — 99% to the provider, 1% to the treasury.",
    code: "emit PaymentSettled(\n  payer, provider,\n  amount, apiId\n)",
  },
];

const SDK_CONFIG = [
  { key: "gateway",      type: "string",  desc: "Backend URL" },
  { key: "privateKey",   type: "string",  desc: "Wallet private key for signing payments" },
  { key: "llm",          type: "object",  desc: '{ provider: "groq" | "openai", apiKey, model }' },
  { key: "autoMint",     type: "boolean", desc: "Auto-claim test USDC from faucet (testnet only)" },
  { key: "autoApprove",  type: "boolean", desc: "Auto-approve USDC spending for the facilitator" },
  { key: "settleDelay",  type: "number",  desc: "ms to wait for on-chain confirmation (default 5000)" },
  { key: "maxLoops",     type: "number",  desc: "Max AI reasoning iterations before forcing an answer" },
  { key: "temperature",  type: "number",  desc: "LLM temperature — 0 for deterministic output" },
  { key: "catalogTtl",   type: "number",  desc: "Catalog cache TTL in ms (0 = cache forever)" },
  { key: "onEvent",      type: "function",desc: "Callback for payment:success, tool:called, run:complete, …" },
];

const CONTRACTS = [
  {
    name: "APIRegistry.sol",
    desc: "On-chain source of truth for the API catalog. Providers call registerAPI() to list an endpoint. The backend reads getAllAPIs() to build the catalog served to agents.",
    methods: ["registerAPI(name, endpoint, price)", "getAPI(apiId)", "getAllAPIs()", "updateAPI(apiId, price, active)"],
  },
  {
    name: "X402Facilitator.sol",
    desc: "Handles every settlement. Verifies the ECDSA signature, checks the nonce for replay protection, enforces the deadline, then splits the USDC transfer.",
    methods: ["settle(payer, provider, amount, nonce, deadline, sig)"],
  },
  {
    name: "MockUSDC.sol",
    desc: "ERC-20 test token on Morph Hoodi. The faucet endpoint calls mint() for you — up to 1000 USDC per wallet per hour.",
    methods: ["mint(address, amount)", "balanceOf(address)", "approve(spender, amount)"],
  },
];

const FAQ = [
  {
    q: "Do I need an account or API key?",
    a: "No. Access is gated by USDC payment through x402. Connect a wallet, approve the facilitator once, and you can call any listed API immediately.",
  },
  {
    q: "Which chain is used?",
    a: "Settlement happens on Morph Hoodi Testnet (chain ID 2910). All USDC amounts are in micro-USDC — 1 USDC = 1,000,000 units.",
  },
  {
    q: "What is the fee split?",
    a: "99% of every payment goes directly to the API provider's wallet. 1% goes to the AgentMesh treasury for protocol maintenance.",
  },
  {
    q: "How do I get test USDC?",
    a: "The faucet endpoint POST /faucet/mint sends 1000 USDC to your address. You can call it once per hour. The SDK handles this automatically when autoMint: true.",
  },
  {
    q: "Can an AI agent use this without a human in the loop?",
    a: "Yes — that is the primary use case. The x402-agent-sdk wraps the full payment + LLM loop. The agent fetches the catalog, picks the right API via function calling, signs and settles automatically.",
  },
  {
    q: "What prevents double-spending or replay attacks?",
    a: "Each nonce is single-use and stored in the gateway's nonce cache. Deadlines expire after 5 minutes. X402Facilitator.sol rejects any payment with a used nonce or expired deadline.",
  },
];

export default function DocsPage() {
  return (
    <div className={styles.shell}>
      <AppSidebar />

      <div className={styles.body}>
        {/* ── Sticky in-page nav ───────────────────────────────── */}
        <aside className={styles.tocWrap} aria-label="On this page">
          <p className={styles.tocLabel}>On this page</p>
          <nav className={styles.toc}>
            {NAV_SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className={styles.tocLink}>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <main className={styles.main}>

          {/* HERO */}
          <header className={styles.hero} id="overview">
            <h1 className={styles.heroTitle}>
              AgentMesh <span className={styles.heroTitleAccent}>Developer Guide</span>
            </h1>
            <p className={styles.heroSub}>
              AgentMesh is an open API marketplace where payments settle on-chain through the x402 protocol.
              No accounts, no API keys, no invoicing — just a wallet, USDC, and one approval.
              This guide covers everything from first call to running autonomous agents.
            </p>
            <p className={styles.heroSub}>Note: <br />This documentation refers to Morph Testnet only. <br />X402AgentSDK is still not uploaded as npm package.</p>
            

            <div className={styles.heroStats}>
              <div className={styles.statPill}>
                <span className={styles.statLabel}>Chain</span>
                <span className={styles.statValue}>Morph L2</span>
              </div>
              <div className={styles.statPill}>
                <span className={styles.statLabel}>Token</span>
                <span className={styles.statValue}>MockUSDC</span>
              </div>
              <div className={styles.statPill}>
                <span className={styles.statLabel}>Approval</span>
                <span className={styles.statValue}>One-time</span>
              </div>
              <div className={styles.statPill}>
                <span className={styles.statLabel}>Fee split</span>
                <span className={styles.statValue}>99% / 1%</span>
              </div>
            </div>
          </header>

          <hr className={styles.divider} />

          {/* HOW IT WORKS */}
          <section className={styles.docSection} id="how-it-works">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>How it works</p>
              <h2>Request, sign, settle — all in one call</h2>
              <p>
                Every API call carries an off-chain ECDSA signature in the{" "}
                <code>X-Payment</code> header. The gateway middleware verifies it and
                triggers an on-chain USDC transfer before proxying your request.
                Providers receive funds within the same transaction.
              </p>
            </div>

            <div className={styles.threeCol}>
              <div className={styles.featureCard}>
                <h3>Discover</h3>
                <p>Browse the on-chain API catalog. Every listing includes live pricing, parameter schemas, and example responses.</p>
              </div>
              <div className={styles.featureCard}>
                <h3>Pay</h3>
                <p>Sign a micro-payment off-chain with your wallet. No gas is required from you — the gateway calls the facilitator contract.</p>
              </div>
              <div className={styles.featureCard}>
                <h3>Receive</h3>
                <p>The API response comes back in the same HTTP round-trip. Settlement is confirmed on Morph L2 within the same request lifecycle.</p>
              </div>
            </div>
          </section>

          <hr className={styles.divider} />

          {/* QUICK START */}
          <section className={styles.docSection} id="quickstart">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Quick start</p>
              <h2>Call your first API in under 5 minutes</h2>
              <p>
                The fastest path is through the UI. For programmatic access, use the SDK or send raw HTTP with the payment header.
              </p>
            </div>

            <div className={styles.codeStack}>
              <p className={styles.stepLabel}>Via the app</p>
              <ol className={styles.numberedSteps}>
                <li>Open <Link href="/marketplace" className={styles.inlineLink}>Marketplace</Link> and pick an API.</li>
                <li>Connect a wallet that holds USDC on Morph Hoodi Testnet. Use POST /faucet/mint if you need test tokens.</li>
                <li>Click Approve Facilitator once. This sets the USDC allowance for the X402Facilitator contract.</li>
                <li>Click Call API. The app builds the payment header, signs it, and shows you the live response.</li>
              </ol>

              <p className={styles.stepLabel} style={{ marginTop: "2rem" }}>Via the SDK (Soon)</p>
              <div className={styles.codeWrap}>
                <div className={styles.codeHeader}>
                  <span>install</span>
                </div>
                <pre className={styles.code}><code>{`npm install @agentmesh/x402-agent-sdk`}</code></pre>
              </div>

              <div className={styles.codeWrap}>
                <div className={styles.codeHeader}>
                  <span>index.js</span>
                </div>
                <pre className={styles.code}><code>{`import { createX402Agent } from "@agentmesh/x402-agent-sdk";

const agent = await createX402Agent({
  gateway:     process.env.GATEWAY_URL,
  privateKey:  process.env.AGENT_PRIVATE_KEY,
  llm:         { provider: "groq", apiKey: process.env.GROQ_API_KEY },
  autoMint:    true,   // claim test USDC automatically
  autoApprove: true,   // approve facilitator automatically
});

const result = await agent.run("What is the current BTC price in USD?");
console.log(result.answer);
// → "Bitcoin is currently trading at $67,420."`}</code></pre>
              </div>

              <div className={styles.codeWrap}>
                <div className={styles.codeHeader}>
                  <span>raw HTTP (no SDK)</span>
                </div>
                <pre className={styles.code}><code>{`// 1. Fetch catalog
const catalog = await fetch(\`\${GATEWAY}/api/v1/catalog\`).then(r => r.json());

// 2. Get nonce
const { nonce, deadline } = await fetch(\`\${GATEWAY}/payment/nonce\`).then(r => r.json());

// 3. Sign payment
const payload = ethers.utils.solidityKeccak256(
  ["address","address","address","uint256","uint256","uint256"],
  [facilitator, payer, provider, amount, nonce, deadline]
);
const signature = await wallet.signMessage(ethers.utils.arrayify(payload));

// 4. Call API with payment header
const xPayment = btoa(JSON.stringify({ payer, provider, amount, nonce, deadline, signature }));
const res = await fetch(apiUrl, { headers: { "X-Payment": xPayment } });
const data = await res.json();`}</code></pre>
              </div>
            </div>
          </section>

          <hr className={styles.divider} />

          {/* PAYMENT FLOW */}
          <section className={styles.docSection} id="payment-flow">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Payment flow</p>
              <h2>Step-by-step: how a paid call settles</h2>
              <p>
                Each step below maps directly to a network hop or contract call. Understanding this helps you
                debug failed payments and design reliable agent workflows.
              </p>
            </div>

            <div className={styles.flowList}>
              {PAYMENT_STEPS.map((step) => (
                <div key={step.n} className={styles.flowItem}>
                  <div className={styles.flowLeft}>
                    <span className={styles.flowNum}>{step.n}</span>
                    <div className={styles.flowConnector} />
                  </div>
                  <div className={styles.flowRight}>
                    <h3 className={styles.flowTitle}>{step.title}</h3>
                    <p className={styles.flowBody}>{step.body}</p>
                    <pre className={styles.flowCode}><code>{step.code}</code></pre>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className={styles.divider} />

          {/* SDK */}
          <section className={styles.docSection} id="sdk">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>SDK reference (Soon)</p>
              <h2>x402-agent-sdk configuration</h2>
              <p>
                All options passed to <code>createX402Agent()</code>. Every field is optional except{" "}
                <code>gateway</code> and <code>privateKey</code>.
              </p>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {SDK_CONFIG.map((row) => (
                    <tr key={row.key}>
                      <td><code>{row.key}</code></td>
                      <td><span className={styles.typeBadge}>{row.type}</span></td>
                      <td>{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.sectionHead} style={{ marginTop: "2.5rem" }}>
              <h3>SDK events</h3>
              <p>Pass an <code>onEvent</code> callback to observe the agent lifecycle in real time.</p>
            </div>

            <div className={styles.codeWrap}>
              <div className={styles.codeHeader}><span>onEvent callback</span></div>
              <pre className={styles.code}><code>{`const agent = await createX402Agent({
  // ...
  onEvent: (event) => {
    switch (event.type) {
      case "catalog:loaded":   console.log(\`\${event.count} APIs available\`); break;
      case "balance:checked":  console.log(\`Balance: \${event.usdcBalance} USDC\`); break;
      case "tool:called":      console.log(\`Calling \${event.name} — $\${event.priceUsd}\`); break;
      case "payment:success":  console.log(\`Settled \${event.amountUsd} USDC\`); break;
      case "payment:failed":   console.error(\`Failed: \${event.error}\`); break;
      case "run:complete":     console.log(\`Done. Spent: $\${event.metrics.totalSpent}\`); break;
    }
  },
});`}</code></pre>
            </div>
          </section>

          <hr className={styles.divider} />

          {/* CONTRACTS */}
          <section className={styles.docSection} id="contracts">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Smart contracts</p>
              <h2>On-chain components</h2>
              <p>
                Three contracts run the protocol on Morph Hoodi Testnet. You never call them directly
                as a consumer — the gateway and SDK handle that — but understanding them helps you
                verify settlement and build custom integrations.
              </p>
            </div>

            <div className={styles.contractGrid}>
              {CONTRACTS.map((c) => (
                <div key={c.name} className={styles.contractCard}>
                  <div className={styles.contractName}>
                    <span className={styles.contractDot} />
                    <code>{c.name}</code>
                  </div>
                  <p className={styles.contractDesc}>{c.desc}</p>
                  <ul className={styles.methodList}>
                    {c.methods.map((m) => (
                      <li key={m}><code>{m}</code></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <hr className={styles.divider} />

          {/* NETWORK */}
          <section className={styles.docSection} id="network">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>Network</p>
              <h2>Chain & token details</h2>
              <p>All activity runs on Morph Hoodi Testnet during beta. Mainnet migration will be announced on the waitlist.</p>
            </div>

            <div className={styles.networkGrid}>
              {[
                ["Network",       "Morph Hoodi Testnet"],
                ["Chain ID",      "2910"],
                ["RPC",           "https://rpc-hoodi.morphl2.io"],
                ["Explorer",      "https://explorer-hoodi.morphl2.io"],
                ["Token",         "MockUSDC (ERC-20, 6 decimals)"],
                ["Fee split",     "99% provider · 1% treasury"],
                ["Nonce TTL",     "5 minutes"],
                ["Faucet limit",  "1000 USDC / hr / wallet"],
              ].map(([label, value]) => (
                <div key={label} className={styles.networkRow}>
                  <span className={styles.networkLabel}>{label}</span>
                  <span className={styles.networkValue}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <hr className={styles.divider} />

          {/* FAQ */}
          <section className={styles.docSection} id="faq">
            <div className={styles.sectionHead}>
              <p className={styles.eyebrow}>FAQ</p>
              <h2>Common questions</h2>
            </div>

            <div className={styles.faqList}>
              {FAQ.map((item) => (
                <div key={item.q} className={styles.faqItem}>
                  <h3 className={styles.faqQ}>{item.q}</h3>
                  <p className={styles.faqA}>{item.a}</p>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}


