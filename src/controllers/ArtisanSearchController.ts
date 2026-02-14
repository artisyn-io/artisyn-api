import { ArtisanType, EventType, Prisma, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import Resource from "src/resources/index";
import SearchCacheService from "src/services/SearchCacheService";
import { prisma } from "src/db";
import { trackBusinessEvent } from "src/utils/analyticsMiddleware";
import { validate } from "src/utils/validator";

interface SearchFilters {
  search?: string;
  category?: string;
  subcategory?: string;
  country?: string;
  state?: string;
  city?: string;
  type?: ArtisanType;
  isVerified?: boolean;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  sortBy?:
  | "relevance"
  | "rating"
  | "price_low"
  | "price_high"
  | "created_at"
  | "name";
  page?: number;
  limit?: number;
}

export default class ArtisanSearchController extends BaseController {
  /**
   * Public endpoint to list and search artisans with comprehensive filtering
   */
  index = async (req: Request, res: Response) => {
    const filters = this.validateFilters(req.query);

    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderBy(filters);
    const { take, skip, meta } = this.pagination(req);

    // Add geospatial filtering if location and radius are provided
    if (filters.latitude && filters.longitude && filters.radius) {
      await this.addGeospatialFilter(where, filters);
    }

    const [artisans, total] = await Promise.all([
      prisma.artisan.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          category: true,
          subcategory: true,
          location: true,
          curator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
        },
      }),
      prisma.artisan.count({ where }),
    ]);

    // Calculate average rating for each artisan
    const artisansWithRating = artisans.map((artisan: any) => ({
      ...artisan,
      averageRating:
        artisan.reviews.length > 0
          ? artisan.reviews.reduce(
            (sum: number, review: any) => sum + review.rating,
            0,
          ) / artisan.reviews.length
          : null,
      reviewCount: artisan.reviews.length,
    }));

    // Track search event
    if (filters.search) {
      trackBusinessEvent(EventType.SEARCH_PERFORMED, req.user?.id, {
        query: filters.search,
        filters: filters,
        resultsCount: total,
      });
    }

    Resource(req, res, { data: artisansWithRating })
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
        pagination: meta(total, artisansWithRating.length),
        filters: filters,
      });
  };

  /**
   * Get search suggestions based on partial input
   */
  suggestions = async (req: Request, res: Response) => {
    const { query } = this.validate(req, {
      query: "required|string|min:2",
    });

    const suggestions = await prisma.artisan.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
          { subcategory: { name: { contains: query, mode: "insensitive" } } },
        ],
        isActive: true,
      },
      select: {
        name: true,
        category: {
          select: { name: true },
        },
        subcategory: {
          select: { name: true },
        },
      },
      take: 10,
      distinct: ["name"],
    });

    Resource(req, res, { data: suggestions }).json().status(200).additional({
      status: "success",
      message: "OK",
      code: 200,
    });
  };

  /**
   * Get popular search terms and categories
   */
  popular = async (req: Request, res: Response) => {
    const [popularCategories, popularLocations] = await Promise.all([
      prisma.category.findMany({
        include: {
          _count: {
            select: { artisans: true },
          },
        },
        orderBy: {
          artisans: {
            _count: "desc",
          },
        },
        take: 10,
      }),
      prisma.location.groupBy({
        by: ["city", "state", "country"],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
        take: 10,
      }),
    ]);

    Resource(req, res, {
      data: {
        categories: popularCategories,
        locations: popularLocations,
      },
    })
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
      });
  };

  private validateFilters (query: any): SearchFilters {
    const validated = validate(query, {
      search: "nullable|string|min:2",
      category: "nullable|string",
      subcategory: "nullable|string",
      country: "nullable|string",
      state: "nullable|string",
      city: "nullable|string",
      type: "nullable|in:PERSON,BUSINESS",
      isVerified: "nullable|boolean",
      isActive: "nullable|boolean",
      minPrice: "nullable|numeric|min:0",
      maxPrice: "nullable|numeric|min:0",
      latitude: "nullable|numeric|min:-90|max:90",
      longitude: "nullable|numeric|min:-180|max:180",
      radius: "nullable|numeric|min:0.1|max:1000",
      sortBy:
        "nullable|in:relevance,rating,price_low,price_high,created_at,name",
      page: "nullable|integer|min:1",
      limit: "nullable|integer|min:1|max:100",
    });

    return {
      ...validated,
      isVerified:
        validated.isVerified !== undefined ? validated.isVerified : true,
      isActive: validated.isActive !== undefined ? validated.isActive : true,
      minPrice: validated.minPrice ? parseFloat(validated.minPrice) : undefined,
      maxPrice: validated.maxPrice ? parseFloat(validated.maxPrice) : undefined,
      latitude: validated.latitude ? parseFloat(validated.latitude) : undefined,
      longitude: validated.longitude ? parseFloat(validated.longitude) : undefined,
      radius: validated.radius ? parseFloat(validated.radius) : undefined,
      sortBy: validated.sortBy || "relevance",
      page: validated.page ? parseInt(validated.page) : 1,
      limit: validated.limit ? parseInt(validated.limit) : 20,
    };
  }

  private buildWhereClause (filters: SearchFilters): Prisma.ArtisanWhereInput {
    const where: Prisma.ArtisanWhereInput = {
      isActive: filters.isActive,
      isVerified: filters.isVerified,
    };

    // Text search
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        {
          category: { name: { contains: filters.search, mode: "insensitive" } },
        },
        {
          subcategory: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          location: { city: { contains: filters.search, mode: "insensitive" } },
        },
        {
          location: {
            state: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          location: {
            country: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }

    // Category and subcategory filters
    if (filters.category) {
      where.category = {
        name: { equals: filters.category, mode: "insensitive" },
      };
    }

    if (filters.subcategory) {
      where.subcategory = {
        name: { equals: filters.subcategory, mode: "insensitive" },
      };
    }

    // Location filters
    if (filters.country) {
      where.location = {
        ...where.location,
        country: { equals: filters.country, mode: "insensitive" } as never,
      };
    }

    if (filters.state) {
      where.location = {
        ...where.location,
        state: { equals: filters.state, mode: "insensitive" } as never,
      };
    }

    if (filters.city) {
      where.location = {
        ...where.location,
        city: { equals: filters.city, mode: "insensitive" } as never,
      };
    }

    // Type filter
    if (filters.type) {
      where.type = filters.type;
    }

    // Price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.OR = [
        { price: { gte: filters.minPrice, lte: filters.maxPrice } },
        {
          priceRange: {
            path: [],
            array_contains:
              (filters.minPrice !== undefined && filters.maxPrice !== undefined
                ? [filters.minPrice, filters.maxPrice]
                : filters.minPrice !== undefined
                  ? [filters.minPrice]
                  : [filters.maxPrice]) as never,
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy (
    filters: SearchFilters,
  ): Prisma.ArtisanOrderByWithRelationInput[] {
    switch (filters.sortBy) {
      case "rating":
        return [{ reviews: { _count: "desc" } }, { name: "asc" }];

      case "price_low":
        return [{ price: "asc" }, { name: "asc" }];

      case "price_high":
        return [{ price: "desc" }, { name: "asc" }];

      case "created_at":
        return [{ createdAt: "desc" }, { name: "asc" }];

      case "name":
        return [{ name: "asc" }];

      case "relevance":
      default:
        if (filters.search) {
          return [
            { isVerified: "desc" },
            { reviews: { _count: "desc" } },
            { name: "asc" },
          ];
        }
        return [
          { isVerified: "desc" },
          { reviews: { _count: "desc" } },
          { name: "asc" },
        ];
    }
  }

  private async addGeospatialFilter (
    where: Prisma.ArtisanWhereInput,
    filters: SearchFilters,
  ): Promise<void> {
    // Using PostgreSQL's earth distance extension for geospatial queries
    // This requires the earthdistance extension to be installed in PostgreSQL

    const earthDistanceQuery = `
            (
                6371 * acos(
                    cos(radians(${filters.latitude})) * 
                    cos(radians(latitude)) * 
                    cos(radians(longitude) - radians(${filters.longitude})) + 
                    sin(radians(${filters.latitude})) * 
                    sin(radians(latitude))
                )
            ) <= ${filters.radius}
        `;

    // This would need to be implemented as a raw query or using PostgreSQL extensions
    // For now, we'll use a simpler bounding box approach
    const latDelta = filters.radius! / 111; // Approximate km per degree latitude
    const lonDelta =
      filters.radius! / (111 * Math.cos((filters.latitude! * Math.PI) / 180));

    where.location = {
      ...where.location,
      latitude: {
        gte: filters.latitude! - latDelta,
        lte: filters.latitude! + latDelta,
      } as never,
      longitude: {
        gte: filters.longitude! - lonDelta,
        lte: filters.longitude! + lonDelta,
      } as never,
    };
  }
}
