import { Request, Response } from "express";
import ArtisanSearchController from "../ArtisanSearchController";
import { prisma } from "../../db";

// Mock the dependencies
jest.mock("../../db", () => ({
  prisma: {
    artisan: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    location: {
      groupBy: jest.fn(),
    },
  },
}));

jest.mock("../../utils/analyticsMiddleware", () => ({
  trackBusinessEvent: jest.fn(),
}));

jest.mock("../../services/SearchCacheService", () => ({
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  clear: jest.fn(),
  getStats: jest.fn(),
  cachePopularData: jest.fn(),
}));

describe("ArtisanSearchController", () => {
  let controller: ArtisanSearchController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ArtisanSearchController();
    mockRequest = {
      query: {},
      user: { id: "test-user-id" },
    };
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      additional: jest.fn().mockReturnThis(),
    };

    // Mock pagination method from BaseController
    (controller as any).pagination = jest.fn().mockReturnValue({
      take: 20,
      skip: 0,
      meta: jest.fn().mockReturnValue({ page: 1, totalPages: 1 }),
    });

    // Mock validate method from BaseController
    (controller as any).validate = jest.fn().mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("index", () => {
    it("should return artisans with basic search", async () => {
      const mockArtisans = [
        {
          id: "1",
          name: "Test Artisan",
          description: "Test description",
          isActive: true,
          isVerified: true,
          category: { name: "Test Category" },
          subcategory: null,
          location: {
            city: "Test City",
            state: "Test State",
            country: "Test Country",
          },
          curator: {
            id: "curator-1",
            firstName: "John",
            lastName: "Doe",
            avatar: null,
          },
          reviews: [{ rating: 5 }, { rating: 4 }],
        },
      ];

      (prisma.artisan.findMany as jest.Mock).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as jest.Mock).mockResolvedValue(1);

      mockRequest.query = { search: "Test" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "Test", mode: "insensitive" } },
              { description: { contains: "Test", mode: "insensitive" } },
            ]),
            isActive: true,
            isVerified: true,
          }),
          take: 20,
          skip: 0,
          include: expect.any(Object),
        }),
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              averageRating: 4.5,
              reviewCount: 2,
            }),
          ]),
        }),
      );
    });

    it("should handle category filtering", async () => {
      mockRequest.query = { category: "Woodworking" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { name: { equals: "Woodworking", mode: "insensitive" } },
            isActive: true,
            isVerified: true,
          }),
        }),
      );
    });

    it("should handle location filtering", async () => {
      mockRequest.query = { city: "New York", country: "USA" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: {
              city: { equals: "New York", mode: "insensitive" },
              country: { equals: "USA", mode: "insensitive" },
            },
            isActive: true,
            isVerified: true,
          }),
        }),
      );
    });

    it("should handle price range filtering", async () => {
      mockRequest.query = { minPrice: "50", maxPrice: "200" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ price: { gte: 50, lte: 200 } }]),
            isActive: true,
            isVerified: true,
          }),
        }),
      );
    });

    it("should handle sorting by rating", async () => {
      mockRequest.query = { sortBy: "rating" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { reviews: { _count: "desc" } },
            { name: "asc" },
          ]),
        }),
      );
    });

    it("should handle pagination", async () => {
      mockRequest.query = { page: "2", limit: "10" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect((controller as any).pagination).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe("suggestions", () => {
    it("should return search suggestions", async () => {
      const mockSuggestions = [
        { name: "Woodworking", category: { name: "Crafts" } },
        { name: "Pottery", subcategory: { name: "Ceramics" } },
      ];

      (prisma.artisan.findMany as jest.Mock).mockResolvedValue(mockSuggestions);

      mockRequest.query = { query: "Wood" };

      await controller.suggestions(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(prisma.artisan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              { name: { contains: "Wood", mode: "insensitive" } },
            ]),
            isActive: true,
          },
          take: 10,
          distinct: ["name"],
        }),
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockSuggestions,
        }),
      );
    });

    it("should validate query parameter", async () => {
      mockRequest.query = {};

      await controller.suggestions(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect((controller as any).validate).toHaveBeenCalledWith(
        mockRequest.query,
        { query: "required|string|min:2" },
      );
    });
  });

  describe("popular", () => {
    it("should return popular categories and locations", async () => {
      const mockCategories = [
        { id: "1", name: "Woodworking", _count: { artisans: 50 } },
        { id: "2", name: "Pottery", _count: { artisans: 30 } },
      ];

      const mockLocations = [
        { city: "New York", state: "NY", country: "USA", _count: { id: 100 } },
        {
          city: "Los Angeles",
          state: "CA",
          country: "USA",
          _count: { id: 80 },
        },
      ];

      (prisma.category.findMany as jest.Mock).mockResolvedValue(mockCategories);
      (prisma.location.groupBy as jest.Mock).mockResolvedValue(mockLocations);

      await controller.popular(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { _count: { select: { artisans: true } } },
          orderBy: { artisans: { _count: "desc" } },
          take: 10,
        }),
      );

      expect(prisma.location.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ["city", "state", "country"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            categories: mockCategories,
            locations: mockLocations,
          },
        }),
      );
    });
  });
});
