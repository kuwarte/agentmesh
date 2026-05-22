import { createX402Agent } from "../packages/x402-agent-sdk/index.js";

const agent = createX402Agent({ verbose: true, settleDelay: 500 });
const result = await agent.run(process.argv[2] || "What is the BTC price?");
console.log(result.answer);
