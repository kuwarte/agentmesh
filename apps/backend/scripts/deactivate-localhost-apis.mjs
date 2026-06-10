/**
 * deactivate-localhost-apis.mjs
 *
 * One-time cleanup script.
 * Finds all on-chain APIs whose endpoint contains "localhost" and deactivates them
 * via PUT /registry/api/:id so the catalog only shows the Railway-hosted entries.
 *
 * Usage:
 *   BACKEND_URL=https://apiagentmesh-production.up.railway.app \
 *   INTERNAL_API_KEY=your_key \
 *   node scripts/deactivate-localhost-apis.mjs
 */

const BACKEND_URL      = process.env.BACKEND_URL      || "http://localhost:3001";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

if (!INTERNAL_API_KEY) {
  console.error("[cleanup] ERROR: INTERNAL_API_KEY env var is required.");
  console.error("  Usage: BACKEND_URL=https://... INTERNAL_API_KEY=your_key node scripts/deactivate-localhost-apis.mjs");
  process.exit(1);
}

async function run() {
  console.log(`[cleanup] Fetching catalog from ${BACKEND_URL}/api/v1/catalog ...`);

  const res  = await fetch(`${BACKEND_URL}/api/v1/catalog`);
  const data = await res.json();

  const stale = data.catalog.filter((api) =>
    api.endpoint.includes("localhost")
  );

  if (stale.length === 0) {
    console.log("[cleanup] No localhost entries found — nothing to do.");
    return;
  }

  console.log(`[cleanup] Found ${stale.length} localhost entries to deactivate:\n`);
  stale.forEach((api) =>
    console.log(`  ${api.name.padEnd(15)} ${api.apiId}  →  ${api.endpoint}`)
  );
  console.log();

  for (const api of stale) {
    const r = await fetch(`${BACKEND_URL}/registry/api/${api.apiId}`, {
      method:  "PUT",
      headers: {
        "Content-Type":  "application/json",
        "X-Internal-Key": INTERNAL_API_KEY,
      },
      body: JSON.stringify({ active: false }),
    });
    const result = await r.json();
    if (result.success) {
      console.log(`[cleanup] ✓ Deactivated "${api.name}" (${api.apiId.slice(0, 12)}...)`);
    } else {
      console.error(`[cleanup] ✗ Failed "${api.name}": ${result.error}`);
    }
  }

  console.log("\n[cleanup] Done. Re-check /api/v1/catalog to confirm.");
}

run().catch(console.error);
