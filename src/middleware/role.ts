import { NextFunction, Request, Response } from "express";
import { RequestError } from "../utils/errors";
import ErrorHandler from "../utils/request-handlers";
import { UserRole } from "@prisma/client";

/**
 * Role Middleware: isCurator
 * 
 * Ensures the authenticated user has CURATOR or ADMIN privileges.
 */
export const isCurator = (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (user && (user.role === UserRole.CURATOR || user.role === UserRole.ADMIN)) {
        next();
    } else {
        // Return 403 Access Denied
        ErrorHandler(new RequestError("Access Denied", 403), req, res);
    }
};
