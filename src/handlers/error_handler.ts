import { Request, Response, NextFunction } from "express"
import { AppError, RequestError } from "../util/errors.js";

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (process.env.NODE_ENV !== 'test') {
        console.error("Error:", err);
    }

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message
        });
        return;
    }

    if (err instanceof RequestError) {
        res.status(err.statusCode).json({
            error: err.message,
            code: err.code
        });
        return;
    }

    if (errorCodes.has(err.code)) {
        res.status(503).json({
            error: "Service unavaible",
            message: "Database is currently unavaible. Please try again later"
        });
    }

    res.status(500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "production" ?
            "An unexpected error has occurred"
            :
            err.message
    });
}

const errorCodes: Set<string> = new Set([
    "ECONNREFUSED",
    "08006",
    "57P03"
])
