import { NextFunction, Request, Response } from "express";
import { RequestError } from "../utils/errors";
import { env } from "../utils/helpers";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { isPast, constructFrom } from "date-fns";

/**
 * Authentication Middleware
 * 
 * Verifies the JWT token from the Authorization header.
 * Attaches the authenticated user to the request object.
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return ErrorHandler(new RequestError("Unauthenticated", 401), req, res);
    }

    try {
        jwt.verify(token, env('JWT_SECRET', ''), async (err: any, decoded: any) => {
            if (err) {
                return ErrorHandler(new RequestError("Unauthenticated", 401), req, res);
            }

            // Fetch user and verify token existence in DB
            const accessToken = await prisma.personalAccessToken.findFirst({
                where: { token },
                include: { user: { include: { curator: true } } },
            });

            const user = accessToken?.user;

            if (user && !isPast(constructFrom(accessToken?.expiresAt!, new Date())!)) {
                req.user = user;
                req.authToken = accessToken?.token;
                next();
            } else {
                return ErrorHandler(new RequestError("Unauthenticated", 401), req, res);
            }
        });
    } catch (e) {
        return ErrorHandler(new RequestError("Unauthenticated", 401), req, res);
    }
};

import ErrorHandler from "src/utils/request-handlers";
