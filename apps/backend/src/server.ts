import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { blockchainService } from "./services/blockchain.service";
import apiRoutes, { syncWithRegistry } from "./routes/api.routes";
import paymentRoutes from "./routes/payment.routes";
import registryRoutes from "./routes/registry.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import providerRoutes from "./routes/provider.routes";

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

// Health check
app.get("/", (_req: Request, res: Response) => {
	res.json({
		name: "AgentMesh Gateway",
		version: "0.1.0",
		status: "running",
		chain: {
			network: process.env.CHAIN_NAME || "morph_hoodi",
			connected: blockchainService.isReady(),
			explorer: "https://explorer-hoodi.morphl2.io",
		},
		endpoints: {
			// Paid APIs
			catalog: "/api/v1/catalog",
			btc: "/api/v1/btc",
			eth: "/api/v1/eth",
			sol: "/api/v1/sol",
			gas: "/api/v1/gas",
			proxy: "/api/v1/call/:apiId",
			// Registry
			registry: "/registry/apis",
			register: "POST /registry/register",
			updateApi: "PUT /registry/api/:id",
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

const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
	try {
		console.log(BANNER);
		console.log("[server] Initializing blockchain service...");
		await blockchainService.init();

		// Sync built-in endpoint catalog with on-chain registry prices
		await syncWithRegistry();

		app.listen(PORT, () => {
			console.log(`\nAgentMesh Gateway v0.0.0 — http://localhost:${PORT}`);
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
