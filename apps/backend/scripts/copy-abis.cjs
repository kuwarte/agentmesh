/**
 * copy-abis.cjs
 *
 * Copies the three contract ABIs from packages/contracts/out/ into
 * apps/backend/src/abis/ so the backend is self-contained and can be
 * deployed as a standalone directory without the rest of the monorepo.
 *
 * Run automatically as part of `pnpm build`.
 * Requires: forge build (packages/contracts) to have been run first.
 */

const fs   = require("fs");
const path = require("path");

const contracts = [
  "APIRegistry.sol/APIRegistry.json",
  "X402Facilitator.sol/X402Facilitator.json",
  "MockUSDC.sol/MockUSDC.json",
];

const srcBase = path.resolve(__dirname, "../../../packages/contracts/out");
const dstBase = path.resolve(__dirname, "../src/abis");

if (!fs.existsSync(srcBase)) {
  console.error(
    "[copy-abis] ERROR: packages/contracts/out/ not found.\n" +
    "            Run `forge build` in packages/contracts first."
  );
  process.exit(1);
}

fs.mkdirSync(dstBase, { recursive: true });

for (const contract of contracts) {
  const src = path.join(srcBase, contract);
  const dst = path.join(dstBase, path.basename(contract)); // e.g. src/abis/APIRegistry.json
  fs.copyFileSync(src, dst);
  console.log(`[copy-abis] ${path.basename(contract)} → src/abis/`);
}

console.log("[copy-abis] Done. Commit src/abis/ or run this before every build.");
