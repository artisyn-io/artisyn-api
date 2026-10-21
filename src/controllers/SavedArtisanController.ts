import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import BaseController from "./BaseController";
import SavedArtisanCollection from "../resources/SavedArtisanCollection";
import SavedArtisanResource from "../resources/SavedArtisanResource";
import { RequestError } from "../utils/errors";
import { prisma } from "../db";

/**
 * SavedArtisanController
 * 
 * Handles shortlisted/saved artisans for authenticated users.
 * Supports paginated listing, idempotent save & delete, batched ID lookups,
 * and exclusion of archived/inaccessible listings without destroying the relationship.
 */
export default class SavedArtisanController extends BaseController {

    /**
     * GET /api/saved-artisans
     * Paginated list of active saved artisans for the authenticated user.
     */
    index = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const { take, skip, meta } = this.pagination(req);

        // Filter for user's saved artisans while excluding archived/inactive listings
        const artisanWhere: Prisma.ArtisanWhereInput = {
            archivedAt: null,
            isActive: true,
        };

        if (req.query.categoryId) {
            artisanWhere.categoryId = String(req.query.categoryId);
        }

        if (req.query.search) {
            const searchStr = String(req.query.search);
            artisanWhere.OR = [
                { name: { contains: searchStr, mode: 'insensitive' } },
                { description: { contains: searchStr, mode: 'insensitive' } },
            ];
        }

        const where: Prisma.SavedArtisanWhereInput = {
            userId,
            artisan: artisanWhere,
        };

        const [data, count] = await prisma.$transaction([
            prisma.savedArtisan.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    artisan: {
                        include: {
                            category: true,
                            subcategory: true,
                            location: true,
                            curator: true,
                        },
                    },
                },
            }),
            prisma.savedArtisan.count({ where }),
        ]);

        new SavedArtisanCollection(req, res, {
            data,
            pagination: meta(count, data.length),
        })
            .json()
            .additional({
                status: 'success',
                message: 'Saved artisans retrieved successfully',
                code: 200,
                total: count,
            })
            .status(200);
    };

    /**
     * GET /api/saved-artisans/ids
     * Returns an array of active saved artisan IDs for the authenticated user.
     * Can optionally filter against a provided batch of candidate artisan IDs to avoid N+1 queries.
     */
    ids = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        let targetIds: string[] | undefined;
        const rawIds = req.query.ids || req.query.artisanIds;
        if (typeof rawIds === 'string') {
            targetIds = rawIds.split(',').map((id) => id.trim()).filter(Boolean);
        } else if (Array.isArray(rawIds)) {
            targetIds = (rawIds as string[]).map((id) => String(id).trim()).filter(Boolean);
        }

        const where: Prisma.SavedArtisanWhereInput = {
            userId,
            artisan: {
                archivedAt: null,
                isActive: true,
            },
            ...(targetIds && targetIds.length > 0 ? { artisanId: { in: targetIds } } : {}),
        };

        const records = await prisma.savedArtisan.findMany({
            where,
            select: { artisanId: true },
        });

        const savedIds = records.map((r) => r.artisanId);

        res.status(200).json({
            status: 'success',
            message: 'OK',
            code: 200,
            data: savedIds,
            count: savedIds.length,
        });
    };

    /**
     * GET /api/saved-artisans/count
     * Accurate active saved-artisan count for dashboard widgets.
     */
    count = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const count = await prisma.savedArtisan.count({
            where: {
                userId,
                artisan: {
                    archivedAt: null,
                    isActive: true,
                },
            },
        });

        res.status(200).json({
            status: 'success',
            message: 'OK',
            code: 200,
            data: { count },
        });
    };

    /**
     * GET /api/saved-artisans/:artisanId
     * Fetch a specific saved artisan record if active.
     */
    show = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const artisanId = String(req.params.artisanId);

        const saved = await prisma.savedArtisan.findUnique({
            where: {
                userId_artisanId: {
                    userId,
                    artisanId,
                },
            },
            include: {
                artisan: {
                    include: {
                        category: true,
                        subcategory: true,
                        location: true,
                        curator: true,
                    },
                },
            },
        });

        if (!saved || !saved.artisan || saved.artisan.archivedAt || !saved.artisan.isActive) {
            throw new RequestError("Saved artisan not found", 404);
        }

        new SavedArtisanResource(req, res, saved)
            .json()
            .additional({
                status: 'success',
                message: 'OK',
                code: 200,
            })
            .status(200);
    };

    /**
     * PUT /api/saved-artisans/:artisanId
     * Idempotently saves an artisan to the user's shortlist.
     */
    save = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const artisanId = String(req.params.artisanId);

        // Verify artisan exists and is accessible
        const artisan = await prisma.artisan.findUnique({
            where: { id: artisanId },
        });

        if (!artisan || artisan.archivedAt || !artisan.isActive) {
            throw new RequestError("Listing not found or no longer available", 404);
        }

        // Idempotent upsert to guarantee no duplicates and handle concurrent saves safely
        const savedArtisan = await prisma.savedArtisan.upsert({
            where: {
                userId_artisanId: {
                    userId,
                    artisanId,
                },
            },
            update: {},
            create: {
                userId,
                artisanId,
            },
            include: {
                artisan: {
                    include: {
                        category: true,
                        subcategory: true,
                        location: true,
                        curator: true,
                    },
                },
            },
        });

        new SavedArtisanResource(req, res, savedArtisan)
            .json()
            .additional({
                status: 'success',
                message: 'Artisan saved successfully',
                code: 200,
            })
            .status(200);
    };

    /**
     * DELETE /api/saved-artisans/:artisanId
     * Idempotently removes an artisan from the user's shortlist.
     */
    remove = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const artisanId = String(req.params.artisanId);

        // Idempotent delete (deleteMany succeeds whether or not record previously existed)
        await prisma.savedArtisan.deleteMany({
            where: {
                userId,
                artisanId,
            },
        });

        res.status(200).json({
            status: 'success',
            message: 'Artisan removed from shortlist successfully',
            code: 200,
            data: {
                artisanId,
                removed: true,
            },
        });
    };
}
