import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { RequestError } from "../utils/errors";
import ErrorHandler from "../utils/request-handlers";
import { UserRole } from "@prisma/client";

export const canAccessVerificationDocument = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const mediaId = String(req.params.mediaId || req.query.mediaId);
    const user = req.user;

    if (!user) {
        return ErrorHandler(new RequestError("Unauthenticated", 401), req, res);
    }

    if (!mediaId) {
        return ErrorHandler(new RequestError("Media ID is required", 400), req, res);
    }

    try {
        const media = await prisma.media.findUnique({
            where: { id: mediaId },
            include: {
                verificationApplicationDocs: {
                    include: {
                        application: {
                            include: {
                                curator: true
                            }
                        }
                    }
                }
            }
        });

        if (!media) {
            return ErrorHandler(new RequestError("Document not found", 404), req, res);
        }

        if (!media.tags.includes('curator_verification')) {
            return ErrorHandler(
                new RequestError("This is not a verification document", 403),
                req,
                res
            );
        }

        const isAdmin = user.role === UserRole.ADMIN;
        
        const isOwner = media.verificationApplicationDocs.some(
            doc => doc.application.curator.userId === user.id
        );

        if (!isAdmin && !isOwner) {
            return ErrorHandler(
                new RequestError("Access denied. You do not have permission to access this document", 403),
                req,
                res
            );
        }

        next();
    } catch (error) {
        return ErrorHandler(
            error instanceof RequestError 
                ? error 
                : new RequestError("Failed to verify document access", 500),
            req,
            res
        );
    }
};
