import { NextFunction, Request, Response } from "express";
import { matchedData } from 'express-validator';
import { ApiResource } from "../resources";
import ArtisanCollection from "../resources/ArtisanCollection";
import ArtisanResource from "../resources/ArtisanResource";
import BaseController from "./BaseController";
import { RequestError, ValidationError } from "../utils/errors";
import { artisanValidation } from "../models/validation";
import { prisma } from "../db";

/**
 * ListingController
 * 
 * Handles all CRUD operations for Listings (Artisans).
 * Follows strict role isolation: Public Read, Curator Write.
 */
export default class ListingController extends BaseController {

    /**
     * Display a listing of the resource.
     * 
     * @param req Request
     * @param res Response
     * @param next NextFunction
     */
    index = async (req: Request, res: Response, next: NextFunction) => {
        try {
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

            ApiResource(new ArtisanCollection(req, res, {
                data,
                pagination: meta(count, data.length)
            })).json()
                .status(200);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Display the specified resource.
     * 
     * @param req Request
     * @param res Response
     * @param next NextFunction
     */
    show = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const listing = await prisma.artisan.findFirst({
                where: { id: req.params.id },
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

            ApiResource(new ArtisanResource(req, res, listing))
                .json()
                .status(200);
        } catch (error) {
            next(error);
        }
    }

    /**
     * Store a newly created resource in storage.
     * 
     * @param req Request
     * @param res Response
     * @param next NextFunction
     */
    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate Input
            const validated = matchedData(req, { locations: ['body'] });

            // Assign Curator
            const curatorId = req.user?.id;
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

            ApiResource(new ArtisanResource(req, res, listing))
                .json()
                .status(201)
                .additional({
                    status: 'success',
                    message: 'Listing created successfully',
                    code: 201
                });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update the specified resource in storage.
     * 
     * @param req Request
     * @param res Response
     * @param next NextFunction
     */
    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

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

            ApiResource(new ArtisanResource(req, res, updated))
                .json()
                .status(202)
                .additional({
                    status: 'success',
                    message: 'Listing updated successfully',
                    code: 202
                });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Remove the specified resource from storage.
     * 
     * @param req Request
     * @param res Response
     * @param next NextFunction
     */
    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

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

            ApiResource(new ArtisanResource(req, res, {}))
                .json()
                .status(202)
                .additional({
                    status: 'success',
                    message: 'Listing deleted successfully',
                    code: 202
                });
        } catch (error) {
            next(error);
        }
    }
}
