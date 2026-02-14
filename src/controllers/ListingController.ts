import { Request, Response } from "express";

import ArtisanCollection from "../resources/ArtisanCollection";
import ArtisanResource from "../resources/ArtisanResource";
import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import { matchedData } from 'express-validator';
import { prisma } from "../db";

/**
 * ListingController
 * 
 * Handles all CRUD operations for Listings (Artisans).
 * Follows strict role isolation: Public Read, Curator Write.
 */
export default class ListingController extends BaseController {

    index = async (req: Request, res: Response) => {
        const { take, skip, meta } = this.pagination(req);

        // Filters
        const where: any = { isActive: true }; // Default to active listings
        if (req.query.categoryId) where.categoryId = String(req.query.categoryId);
        if (req.query.subcategoryId) where.subcategoryId = String(req.query.subcategoryId);
        if (req.query.curatorId) where.curatorId = String(req.query.curatorId);

        // Fetch Data
        const [data, count] = await prisma.$transaction([
            prisma.artisan.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: true,
                    subcategory: true,
                    location: true,
                    curator: true
                }
            }),
            prisma.artisan.count({ where })
        ]);

        new ArtisanCollection(req, res, {
            data,
            pagination: meta(count, data.length)
        })
            .json()
            .status(200);
    }

    async show (req: Request, res: Response) {
        const listing = await prisma.artisan.findFirst({
            where: { id: String(req.params.id) },
            include: {
                category: true,
                subcategory: true,
                location: true,
                curator: true
            }
        });

        if (!listing) {
            throw new RequestError("Listing not found", 404);
        }

        new ArtisanResource(req, res, listing)
            .json()
            .status(200);
    }

    async create (req: Request, res: Response) {
        // Validate Input
        const validated = matchedData(req, { locations: ['body'] }) as any;

        // Assign Curator
        const curatorId = req.user?.id!;
        if (!curatorId) {
            throw new RequestError("Unauthenticated", 401);
        }

        // Create Listing
        const listing = await prisma.artisan.create({
            data: {
                ...validated,
                curatorId,
                isActive: validated.isActive ?? true,
                isVerified: false // Default to unverified
            },
            include: {
                category: true,
                subcategory: true,
                location: true,
                curator: true
            }
        });

        new ArtisanResource(req, res, listing)
            .json()
            .additional({
                status: 'success',
                message: 'Listing created successfully',
                code: 201
            })
            .status(201);
    }

    async update (req: Request, res: Response) {
        const id = String(req.params.id);

        // Validate Input
        const validated = matchedData(req, { locations: ['body'] });

        // Find Existing
        const existing = await prisma.artisan.findUnique({ where: { id } });
        if (!existing) {
            throw new RequestError("Listing not found", 404);
        }

        // Authorization Check: Only Owner or Admin
        if (existing.curatorId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new RequestError("Unauthorized access to this listing", 403);
        }

        // Update
        const updated = await prisma.artisan.update({
            where: { id },
            data: validated,
            include: {
                category: true,
                subcategory: true,
                location: true,
                curator: true
            }
        });

        new ArtisanResource(req, res, updated)
            .json()
            .additional({
                status: 'success',
                message: 'Listing updated successfully',
                code: 202
            })
            .status(202);
    }

    async delete (req: Request, res: Response) {
        const id = String(req.params.id);

        // Find Existing
        const existing = await prisma.artisan.findUnique({ where: { id } });
        if (!existing) {
            throw new RequestError("Listing not found", 404);
        }

        // Authorization Check
        if (existing.curatorId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new RequestError("Unauthorized access to this listing", 403);
        }

        // Delete
        await prisma.artisan.delete({ where: { id } });

        new ArtisanResource(req, res, {})
            .json()
            .additional({
                status: 'success',
                message: 'Listing deleted successfully',
                code: 202
            })
            .status(202);
    }
}
