import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
	res.json({
		message: "agentmesh_backend is running...",
	});
});

// mockapi
app.get("/api/btc", (req, res) => {
	res.json({
		symbol: "BTC",
		price: 67000,
		source: "mock-provider",
	});
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
	console.log(`[SERVER]: http://localhost:${PORT}`);
});
