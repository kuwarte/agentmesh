import { createX402Agent } from "../packages/x402-agent-sdk/index.js";

const agent = createX402Agent({
	verbose: true, // rich terminal UI
	autoMint: true, // request test tokens from faucet if balance is 0
	autoApprove: true, // auto-approve USDC spending on-chain (requires RPC_URL + USDC_ADDRESS)
	settleDelay: 300, // ms to wait after each payment for on-chain settlement
});

const task = process.argv[2] || "What is the current BTC price?";

const result = await agent.run(task);

console.log("\nAnswer:", result.answer);
console.log("Metrics:", result.metrics);
