import { Router } from "express";
import { ethers } from "ethers";

import MockUSDC from "../../../../packages/contracts/out/DeployMockUSDC.s.sol/MockUSDC.json";

const router = Router();

if (!process.env.RPC_URL) throw new Error("RPC_URL missing");
if (!process.env.GATEWAY_PRIVATE_KEY) throw new Error("GATEWAY_PRIVATE_KEY missing");
if (!process.env.USDC_ADDRESS) throw new Error("USDC_ADDRESS missing");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const wallet = new ethers.Wallet(process.env.GATEWAY_PRIVATE_KEY, provider);

const usdc = new ethers.Contract(process.env.USDC_ADDRESS, MockUSDC.abi, wallet);

const lastMint: Record<string, number> = {};

router.post("/mint", async (req, res) => {
	try {
		const { address } = req.body;

		if (!address) {
			return res.status(400).json({ error: "Missing address" });
		}

		const now = Date.now();
		const last = lastMint[address] || 0;

		if (now - last < 60 * 60 * 1000) {
			return res.status(429).json({
				error: "Cooldown active (1 hour)",
			});
		}

		const tx = await usdc.mint();

		lastMint[address] = now;

		await tx.wait();

		return res.json({
			success: true,
			txHash: tx.hash,
			amount: "1000 USDC",
			note: "Minted to gateway wallet (msg.sender)",
		});
	} catch (err: any) {
		return res.status(500).json({
			error: err.message,
		});
	}
});

export default router;
