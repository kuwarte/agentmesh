import { Request, Response, NextFunction } from "express";

export function requireInternal(req: Request, res: Response, next: NextFunction) {
	const internalKey = req.headers["x-internal-key"];

	if (internalKey !== process.env.INTERNAL_API_KEY) {
		return res.status(403).json({
			error: "Forbidden",
		});
	}

	next();
}
