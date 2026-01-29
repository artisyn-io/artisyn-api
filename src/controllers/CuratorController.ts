import { NextFunction, Request, Response } from "express";
import { ApiResource } from "../resources/index";
import CuratorCollection from "../resources/CuratorCollection";
import CuratorResource from "../resources/CuratorResource";
import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import { prisma } from "../db";

/**
 * CuratorController
 * 
 * Handles public read operations for Curators.
 * Provides listing and profile preview functionality.
 */
export default class CuratorController extends BaseController {

    /**
     * GET /api/curators
     * List all curators with search, filtering, and pagination support.
     */
    index = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { take, skip, meta } = this.pagination(req);

            // Build search query
            const search = req.query.search ? {
                OR: [
                    { user: { firstName: { contains: String(req.query.search), mode: 'insensitive' as const } } },
                    { user: { lastName: { contains: String(req.query.search), mode: 'insensitive' as const } } },
                    { user: { email: { contains: String(req.query.search), mode: 'insensitive' as const } } },
                    { specialties: { has: String(req.query.search) } },
                ]
            } : {};

            // Build filter query
            const where: any = {
                ...search,
            };

            // Filter by verification status
            if (req.query.verificationStatus) {
                where.verificationStatus = String(req.query.verificationStatus);
            }

            // Filter by specialty
            if (req.query.specialty) {
                where.specialties = { has: String(req.query.specialty) };
            }

            // Filter by minimum experience
            if (req.query.minExperience) {
                where.experience = { gte: parseInt(String(req.query.minExperience)) };
            }

            // Only show verified curators by default (optional - can be overridden)
            if (req.query.verified === 'true' || (!req.query.verified && !req.query.verificationStatus)) {
                where.verificationStatus = 'VERIFIED';
            }

            // Fetch Data
            const [data, count] = await prisma.$transaction([
                prisma.curator.findMany({
                    where,
                    take,
                    skip,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                role: true,
                                avatar: true,
                                bio: true,
                                phone: true,
                                emailVerifiedAt: true,
                            }
                        }
                    }
                }),
                prisma.curator.count({ where })
            ]);

            ApiResource(new CuratorCollection(req, res, {
                data,
                pagination: meta(count, data.length)
            }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'OK',
                    code: 200,
                });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/curators/:id
     * Get a specific curator by ID with full profile details.
     */
    show = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const curator = await prisma.curator.findFirst({
                where: { id: typeof req.params.id === 'string' ? req.params.id : Array.isArray(req.params.id) ? req.params.id[0] : undefined },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            role: true,
                            avatar: true,
                            bio: true,
                            phone: true,
                            emailVerifiedAt: true,
                        }
                    }
                }
            });

            if (!curator) {
                throw new RequestError("Curator not found", 404);
            }

            ApiResource(new CuratorResource(req, res, curator))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'OK',
                    code: 200,
                });
        } catch (error) {
            next(error);
        }
    }
}
