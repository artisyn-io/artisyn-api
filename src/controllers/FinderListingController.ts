import { Request, Response } from "express";

import ArtisanCollection from "../resources/ArtisanCollection";
import ArtisanResource from "../resources/ArtisanResource";
import BaseController from "./BaseController";
import { ListingOwnerType } from "@prisma/client";
import { RequestError } from "../utils/errors";
import { matchedData } from "express-validator";
import { prisma } from "../db";

/**
 * FinderListingController
 *
 * Handles all CRUD operations for Finder-owned Listings.
 * Follows strict role isolation: Finder can only manage their own listings.
 */
export default class FinderListingController extends BaseController {
  /**
   * GET /api/finder/listings
   * Fetch all listings created by the authenticated finder.
   */
  index = async (req: Request, res: Response) => {
    const { take, skip, meta } = this.pagination(req);
    const finderId = req.user?.id!;

    // Filters - only show listings owned by this finder
    const where: any = {
      curatorId: finderId,
      ownerType: ListingOwnerType.FINDER,
    };

    if (req.query.categoryId) where.categoryId = String(req.query.categoryId);
    if (req.query.subcategoryId)
      where.subcategoryId = String(req.query.subcategoryId);
    if (req.query.isActive !== undefined)
      where.isActive = req.query.isActive === "true";

    // Fetch Data
    const [data, count] = await prisma.$transaction([
      prisma.artisan.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          subcategory: true,
          location: true,
        },
      }),
      prisma.artisan.count({ where }),
    ]);

    new ArtisanCollection(req, res, {
      data,
      pagination: meta(count, data.length),
    })
      .json()
      .status(200);
  };

  /**
   * GET /api/finder/listings/:id
   * Fetch a single listing by ID (owner only).
   */
  async show(req: Request, res: Response) {
    const finderId = req.user?.id!;
    const listingId = String(req.params.id);

    const listing = await prisma.artisan.findFirst({
      where: {
        id: listingId,
        curatorId: finderId,
        ownerType: ListingOwnerType.FINDER,
      },
      include: {
        category: true,
        subcategory: true,
        location: true,
      },
    });

    if (!listing) {
      throw new RequestError("Listing not found or access denied", 404);
    }

    new ArtisanResource(req, res, listing).json().status(200);
  }

  /**
   * POST /api/finder/listings
   * Create a new listing as a finder.
   */
  async create(req: Request, res: Response) {
    // Validate Input
    const validated = matchedData(req, { locations: ["body"] }) as any;

    // Assign Finder
    const finderId = req.user?.id!;
    if (!finderId) {
      throw new RequestError("Unauthenticated", 401);
    }

    // Create Listing with FINDER owner type
    const listing = await prisma.artisan.create({
      data: {
        ...validated,
        curatorId: finderId,
        ownerType: ListingOwnerType.FINDER,
        isActive: validated.isActive ?? true,
        isVerified: false, // Finders' listings default to unverified
      },
      include: {
        category: true,
        subcategory: true,
        location: true,
      },
    });

    new ArtisanResource(req, res, listing)
      .json()
      .additional({
        status: "success",
        message: "Listing created successfully",
        code: 201,
      })
      .status(201);
  }

  /**
   * PUT /api/finder/listings/:id
   * Update an existing listing (owner only).
   */
  async update(req: Request, res: Response) {
    const id = String(req.params.id);
    const finderId = req.user?.id!;

    // Validate Input
    const validated = matchedData(req, { locations: ["body"] });

    // Find Existing - must be owned by this finder
    const existing = await prisma.artisan.findFirst({
      where: {
        id,
        curatorId: finderId,
        ownerType: ListingOwnerType.FINDER,
      },
    });

    if (!existing) {
      throw new RequestError("Listing not found or access denied", 404);
    }

    // Update
    const updated = await prisma.artisan.update({
      where: { id },
      data: validated,
      include: {
        category: true,
        subcategory: true,
        location: true,
      },
    });

    new ArtisanResource(req, res, updated)
      .json()
      .additional({
        status: "success",
        message: "Listing updated successfully",
        code: 202,
      })
      .status(202);
  }

  /**
   * DELETE /api/finder/listings/:id
   * Delete a listing (owner only).
   */
  async delete(req: Request, res: Response) {
    const id = String(req.params.id);
    const finderId = req.user?.id!;

    // Find Existing - must be owned by this finder
    const existing = await prisma.artisan.findFirst({
      where: {
        id,
        curatorId: finderId,
        ownerType: ListingOwnerType.FINDER,
      },
    });

    if (!existing) {
      throw new RequestError("Listing not found or access denied", 404);
    }

    // Delete
    await prisma.artisan.delete({ where: { id } });

    new ArtisanResource(req, res, {})
      .json()
      .additional({
        status: "success",
        message: "Listing deleted successfully",
        code: 202,
      })
      .status(202);
  }
}
