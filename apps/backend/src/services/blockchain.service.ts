import { ethers } from "ethers";
import APIRegistry from "../../../../packages/contracts/out/APIRegistry.sol/APIRegistry.json";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

export const registryContract = new ethers.Contract(
	process.env.REGISTRY_ADDRESS!,
	APIRegistry.abi,
	provider
);
