import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { blockchainService } from "./services/blockchain.service";
import apiRoutes from "./routes/api.routes";
// import paymentRoutes from "./routes/payment.routes";
// import registryRoutes from "./routes/registry.routes";

const app = express();

app.use(cors());
app.use(express.json());

// req_logger
app.use((req, _res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
});

// TODO: routes
app.use("/api/v1", apiRoutes);
// app.use("/payment", paymentRoutes);
// app.use("/registry", registryRoutes);

// health_check
app.get("/", (_req: Request, res: Response) => {
	res.json({
		name: "AgentMesh Gateway",
		version: "0.1.0",
		status: "running",
		chain: {
			network: process.env.CHAIN_NAME || "morphl2",
			connected: blockchainService.isReady(),
		},
		docs: {
			catalog: "/api/v1/catalog",
			registry: "/registry",
			payment: "/payment/status",
		},
	});
});

// boot seq
const PORT = Number(process.env.PORT) || 3001;

async function bootstrap() {
	try {
		console.log("[server] Initializing blockchain service...");
		await blockchainService.init();

		app.listen(PORT, () => {
			console.log(`\nAgentMesh Gateway running on http://localhost:${PORT}`);
			console.log(`   Chain connected : ${blockchainService.isReady()}`);
			console.log(`   API BTC sample  : http://localhost:${PORT}/api/v1/btc`);
			console.log(`   Registry        : http://localhost:${PORT}/registry`);
			console.log(`   Payment status  : http://localhost:${PORT}/payment/status\n`);
		});
	} catch (err) {
		console.error("[server] Failed to start:", err);
		process.exit(1);
	}
}

bootstrap();
