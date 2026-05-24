import { createX402Agent } from "../packages/x402-agent-sdk/index.js";

// All config is read from .env (copy .env.example from packages/x402-agent-sdk)
// Required: AGENT_PRIVATE_KEY, GROQ_API_KEY, X402_FACILITATOR_ADDRESS (or FACILITATOR_ADDRESS)
// Optional: GATEWAY_URL, RPC_URL, USDC_ADDRESS, AUTO_APPROVE, AUTO_MINT, DEBUG, VERBOSE

const agent = createX402Agent({
  verbose: true,       // rich terminal UI
  autoMint: true,      // request test tokens from faucet if balance is 0
  autoApprove: true,   // auto-approve USDC spending on-chain (requires RPC_URL + USDC_ADDRESS)
  settleDelay: 2000,   // ms to wait after each payment for on-chain settlement
});

const task = process.argv[2] || "What is the current BTC price?";

const result = await agent.run(task);

// result.answer  — final synthesized answer from the LLM
// result.metrics — { totalSpent: "0.000100 USDC", callsMade: 1 }
console.log("\nAnswer:", result.answer);
console.log("Metrics:", result.metrics);
