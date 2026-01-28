import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { RequestError } from "../utils/errors";
import ErrorHandler from "../utils/request-handlers";
import { UserRole } from "@prisma/client";

/**
 * Middleware to verify access to curator verification documents
 * 
 * Access rules:
 * - Admins can access any verification document
 * - Curators can only access their own verification documents
 * - Documents must be tagged with 'curator_verification'
 * 
 * @param req - Express request object (expects mediaId in params or query)
 * @param res - Express response object
 * @param next - Express next function
 */
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

        // Verify document is a verification document
        if (!media.tags.includes('curator_verification')) {
            return ErrorHandler(
                new RequestError("This is not a verification document", 403),
                req,
                res
            );
        }

        // Check access permissions
        const isAdmin = user.role === UserRole.ADMIN;
        
        // Check if user is the curator who submitted the application
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
