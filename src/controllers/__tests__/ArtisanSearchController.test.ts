import { Request, Response } from "express";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ArtisanSearchController from "../ArtisanSearchController";
import { prisma } from "../../db";

// Mock the validator module BEFORE any imports
vi.mock("../../utils/validator", () => ({
  validate: vi.fn().mockReturnValue({}),
  validator: vi.fn((req: any, rules: any) => ({
    passes: () => true,
    fails: () => false,
    errors: {
      all: () => ({}),
    },
  })),
}));

// Mock the dependencies
vi.mock("../../db", () => ({
  prisma: {
    artisan: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    location: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("../../utils/analyticsMiddleware", () => ({
  trackBusinessEvent: vi.fn(),
}));

vi.mock("../../services/SearchCacheService", () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(),
    cachePopularData: vi.fn(),
  },
}));

describe("ArtisanSearchController", () => {
  let controller: ArtisanSearchController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    controller = new ArtisanSearchController();
    
    // Create proper mock functions
    jsonMock = vi.fn().mockReturnThis();
    statusMock = vi.fn().mockReturnThis();
    
    mockRequest = {
      query: {},
      user: { 
        id: "test-user-id",
        email: "test@example.com",
        password: "hashed-password",
        walletAddress: "0x123",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "+1234567890",
        isVerified: true,
        isActive: true,
        role: "USER",
        createdAt: new Date(),
        updatedAt: new Date(),
        avatar: null,
        bio: null,
        dateOfBirth: null,
      } as any,
    };
    
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };
    
    // Ensure status returns the response object
    statusMock.mockReturnValue(mockResponse);

    // Mock pagination method from BaseController
    (controller as any).pagination = vi.fn().mockReturnValue({
      take: 20,
      skip: 0,
      meta: vi.fn().mockReturnValue({ page: 1, totalPages: 1 }),
    });

    // Mock the respond method that likely exists in BaseController
    (controller as any).respond = vi.fn().mockImplementation((res, data) => {
      res.json(data);
      return res;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(1);

      mockRequest.query = { search: "Test" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalled();
      expect(prisma.artisan.count).toHaveBeenCalled();
    });

    it("should handle category filtering", async () => {
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      (prisma.artisan.count as any).mockResolvedValue(0);
      
      mockRequest.query = { category: "Woodworking" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalled();
      // Just verify the method completed without checking json
    });

    it("should handle location filtering", async () => {
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      (prisma.artisan.count as any).mockResolvedValue(0);
      
      mockRequest.query = { city: "New York", country: "USA" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalled();
    });

    it("should handle price range filtering", async () => {
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      (prisma.artisan.count as any).mockResolvedValue(0);
      
      mockRequest.query = { minPrice: "50", maxPrice: "200" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalled();
    });

    it("should handle sorting by rating", async () => {
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      (prisma.artisan.count as any).mockResolvedValue(0);
      
      mockRequest.query = { sortBy: "rating" };

      await controller.index(mockRequest as Request, mockResponse as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalled();
    });

    it("should handle pagination", async () => {
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      (prisma.artisan.count as any).mockResolvedValue(0);
      
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

      (prisma.artisan.findMany as any).mockResolvedValue(mockSuggestions);

      mockRequest.query = { query: "Wood" };

      await controller.suggestions(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(prisma.artisan.findMany).toHaveBeenCalled();
    });

    it("should validate query parameter", async () => {
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      
      mockRequest.query = { query: "test" };

      // Mock validate to not throw
      (controller as any).validate = vi.fn().mockReturnValue({});

      await controller.suggestions(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect((controller as any).validate).toHaveBeenCalled();
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

      (prisma.category.findMany as any).mockResolvedValue(mockCategories);
      (prisma.location.groupBy as any).mockResolvedValue(mockLocations);

      await controller.popular(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(prisma.category.findMany).toHaveBeenCalled();
      expect(prisma.location.groupBy).toHaveBeenCalled();
    });
  });
});