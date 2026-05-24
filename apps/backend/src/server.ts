import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { blockchainService } from "./services/blockchain.service";
import { ledgerService } from "./services/ledger.service";
import { metadataService } from "./services/metadata.service";
import apiRoutes, { autoRegisterBuiltins } from "./routes/api.routes";
import paymentRoutes from "./routes/payment.routes";
import registryRoutes from "./routes/registry.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import providerRoutes from "./routes/provider.routes";
import faucetRoutes from "./routes/faucet.routes";

const BANNER = `
   █████████                                 █████    ██████   ██████                  █████     
  ███░░░░░███                               ░░███    ░░██████ ██████                  ░░███      
 ░███    ░███   ███████  ██████  ████████   ███████   ░███░█████░███   ██████   █████  ░███████  
 ░███████████  ███░░███ ███░░███░░███░░███ ░░░███░    ░███░░███ ░███  ███░░███ ███░░   ░███░░███ 
 ░███░░░░░███ ░███ ░███░███████  ░███ ░███   ░███     ░███ ░░░  ░███ ░███████ ░░█████  ░███ ░███ 
 ░███    ░███ ░███ ░███░███░░░   ░███ ░███   ░███ ███ ░███      ░███ ░███░░░   ░░░░███ ░███ ░███ 
 █████   █████░░███████░░██████  ████ █████  ░░█████  █████     █████░░██████  ██████  ████ █████
░░░░░   ░░░░░  ░░░░░███ ░░░░░░  ░░░░ ░░░░░    ░░░░░  ░░░░░     ░░░░░  ░░░░░░  ░░░░░░  ░░░░ ░░░░░ 
               ███ ░███                                                                          
              ░░██████                                                                           
               ░░░░░░                                                                            
`;

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
	next();
});

// Routes
app.use("/api/v1", apiRoutes);
app.use("/payment", paymentRoutes);
app.use("/registry", registryRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/provider", providerRoutes);
app.use("/faucet", faucetRoutes);

// Health check
app.get("/", (_req: Request, res: Response) => {
	res.json({
		name: "AgentMesh Gateway",
		version: "1.0.0",
		status: "running",
		chain: {
			network: process.env.CHAIN_NAME || "morph_hoodi",
			connected: blockchainService.isReady(),
			explorer: "https://explorer-hoodi.morphl2.io",
		},
		endpoints: {
			// Paid APIs
			catalog:    "/api/v1/catalog",
			call:       "/api/v1/call/:apiId",
			internal:   "/api/v1/internal/:key",
			// Registry
			registry:    "/registry/apis",
			register:    "POST /registry/register",
			updateApi:   "PUT /registry/api/:id",
			categories:  "/registry/categories",
			metadata:    "POST /registry/metadata/:id",
			slug:        "/registry/slug/:slug",
			// Payment
			nonce: "/payment/nonce",
			verify: "POST /payment/verify",
			balance: "/payment/balance/:address",
			status: "/payment/status",
			// Frontend pages
			marketplace: "/registry/apis",
			dashboard: "/dashboard/:address",
			provider: "/provider/:address",
		},
	});
});

// Public config — safe for frontend "Getting Started" page and agent onboarding
// Contains all addresses and info agents/users need to integrate
app.get("/config", (_req: Request, res: Response) => {
	res.json({
		network: {
			name:        process.env.CHAIN_NAME || "morph_hoodi",
			chainId:     blockchainService.getChainId(),
			rpcUrl:      "https://rpc-hoodi.morphl2.io",
			explorerUrl: "https://explorer-hoodi.morphl2.io",
		},
		contracts: {
			facilitator: process.env.X402_FACILITATOR_ADDRESS || null,
			registry:    process.env.API_REGISTRY_ADDRESS     || null,
			usdc:        process.env.USDC_ADDRESS             || null,
		},
		faucet: {
			endpoint:    "/faucet/mint",
			amount:      "1000",
			amountUsd:   "1000.000000",
			cooldown:    "3600 seconds (1 hour)",
			checkUrl:    "/faucet/status/:address",
		},
		payment: {
			scheme:       "x402",
			headerName:   "X-Payment",
			headerFormat: "base64(JSON({ payer, provider, amount, nonce, deadline, signature }))",
			nonceUrl:     "/payment/nonce",
			verifyUrl:    "/payment/verify",
			signMessage:  "keccak256(abi.encodePacked(facilitator, payer, provider, amount, nonce, deadline))",
		},
		quickstart: {
			step1: "GET /config — get contract addresses and network info",
			step2: "GET /faucet/status/:address — check if you need MockUSDC",
			step3: "POST /faucet/mint { address } — get 1000 test USDC",
			step4: "Approve: usdc.approve(contracts.facilitator, maxUint256)",
			step5: "GET /api/v1/catalog — discover available APIs and prices",
			step6: "GET /payment/nonce — get a fresh nonce + deadline",
			step7: "Sign: keccak256(facilitator+payer+provider+amount+nonce+deadline)",
			step8: "Call any API with X-Payment: base64(JSON({...})) header via /api/v1/call/:apiId",
		},
	});
});

const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
	try {
		console.log(BANNER);
		console.log("[server] Initializing blockchain service...");
		await blockchainService.init();

		// Initialize off-chain metadata service (Supabase)
		metadataService.init();

		// Replay past PaymentSettled events to restore ledger after restart
		await blockchainService.replayLedgerFromChain(ledgerService);

		// Register built-in feeds on-chain if not already present
		await autoRegisterBuiltins();

		app.listen(PORT, () => {
			console.log(`\nAgentMesh Gateway v1.0.0 — http://localhost:${PORT}`);
			console.log(`   Network   : ${process.env.CHAIN_NAME || "morph_hoodi"}`);
			console.log(`   Connected : ${blockchainService.isReady()}`);
			console.log(`   Catalog   : http://localhost:${PORT}/api/v1/catalog`);
			console.log(`   Registry  : http://localhost:${PORT}/registry/apis`);
			console.log(`   Dashboard : http://localhost:${PORT}/dashboard/<address>`);
			console.log(`   Provider  : http://localhost:${PORT}/provider/<address>\n`);
		});
	} catch (err) {
		console.error("[server] Failed to start:", err);
		process.exit(1);
	}
}

bootstrap();
