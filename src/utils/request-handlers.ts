import { NextFunction, Request, Response } from "express"
import { BaseError } from "./errors";
import { Prisma } from "@prisma/client";
import { env } from "./helpers";
import logger from "./logger";

export const ErrorHandler = (err: BaseError | string, req: Request, res: Response, next?: NextFunction) => {

    const message = 'Something went wrong';

    const error: Record<string, any> = {
        status: 'error',
        code: typeof err === 'string' || !err.statusCode ? 500 : err.statusCode,
        message: typeof err === 'string' ? `${message}: ${err}` : err.message || message,
    }

    if (typeof err !== 'string' && err.errors) {
        error.errors = err.errors
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        error.code = 404
        error.message = `${err.meta?.modelName} not found!`
    }

    if (typeof err !== 'string' && env('NODE_ENV') === 'development' && env<boolean>('HIDE_ERROR_STACK') !== true) {
        error.stack = err.stack
    }

    // Structured logging with Winston (non-blocking)
    logger.error(`${typeof err === 'string' ? err : err.message}`, {
        timestamp: new Date().toISOString(),
        stack: typeof err !== 'string' ? err.stack : undefined,
        request: {
            method: req.method,
            path: req.path,
            ip: req.ip,
        }
    });

    res.status(error.code).json(error)
}

export default ErrorHandler

