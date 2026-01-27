import { performance } from "perf_hooks";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ArtisanSearchController from "../ArtisanSearchController";
import { prisma } from "../../db";

// Mock the dependencies
vi.mock("../../db", () => ({
  prisma: {
    artisan: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("../../utils/analyticsMiddleware", () => ({
  trackBusinessEvent: vi.fn(),
}));

describe("ArtisanSearchController Performance Tests", () => {
  let controller: ArtisanSearchController;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    controller = new ArtisanSearchController();
    mockRequest = {
      query: {},
      user: { id: "test-user-id" },
    };
    mockResponse = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      additional: vi.fn().mockReturnThis(),
    };

    // Mock pagination method from BaseController
    (controller as any).pagination = vi.fn().mockReturnValue({
      take: 20,
      skip: 0,
      meta: vi.fn().mockReturnValue({ page: 1, totalPages: 1 }),
    });

    // Mock validate method from BaseController
    (controller as any).validate = vi.fn().mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Search Performance", () => {
    it("should complete basic search within 200ms", async () => {
      // Mock large dataset response
      const mockArtisans = Array.from({ length: 100 }, (_, i) => ({
        id: `artisan-${i}`,
        name: `Artisan ${i}`,
        description: `Description for artisan ${i}`,
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
        reviews: Array.from({ length: 5 }, (_, j) => ({
          rating: Math.floor(Math.random() * 5) + 1,
        })),
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(1000);

      mockRequest.query = { search: "Artisan" };

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(200); // Should complete within 200ms
    });

    it("should handle complex filtering within 500ms", async () => {
      const mockArtisans = Array.from({ length: 50 }, (_, i) => ({
        id: `artisan-${i}`,
        name: `Artisan ${i}`,
        description: `Description for artisan ${i}`,
        isActive: true,
        isVerified: true,
        category: { name: "Woodworking" },
        subcategory: { name: "Furniture" },
        location: { city: "New York", state: "NY", country: "USA" },
        curator: {
          id: "curator-1",
          firstName: "John",
          lastName: "Doe",
          avatar: null,
        },
        reviews: Array.from({ length: 3 }, (_, j) => ({ rating: 5 })),
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(500);

      mockRequest.query = {
        search: "Woodworking",
        category: "Woodworking",
        subcategory: "Furniture",
        city: "New York",
        country: "USA",
        minPrice: "50",
        maxPrice: "500",
        sortBy: "rating",
      };

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(500); // Should complete within 500ms for complex queries
    });

    it("should handle geospatial search efficiently", async () => {
      const mockArtisans = Array.from({ length: 30 }, (_, i) => ({
        id: `artisan-${i}`,
        name: `Artisan ${i}`,
        description: `Description for artisan ${i}`,
        isActive: true,
        isVerified: true,
        category: { name: "Test Category" },
        subcategory: null,
        location: {
          city: "Test City",
          state: "Test State",
          country: "Test Country",
          latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
          longitude: -74.006 + (Math.random() - 0.5) * 0.1,
        },
        curator: {
          id: "curator-1",
          firstName: "John",
          lastName: "Doe",
          avatar: null,
        },
        reviews: [],
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(30);

      mockRequest.query = {
        latitude: "40.7128",
        longitude: "-74.0060",
        radius: "10",
      };

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(300); // Geospatial queries should be efficient
    });
  });

  describe("Pagination Performance", () => {
    it("should handle large dataset pagination efficiently", async () => {
      // Mock response for paginated results
      const mockArtisans = Array.from({ length: 20 }, (_, i) => ({
        id: `artisan-${i}`,
        name: `Artisan ${i}`,
        description: `Description for artisan ${i}`,
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
        reviews: [],
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(100000); // Large dataset

      mockRequest.query = { page: "50", limit: "20" }; // Deep pagination

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Pagination should be fast even for deep pages
    });
  });

  describe("Suggestions Performance", () => {
    it("should return suggestions quickly", async () => {
      const mockSuggestions = Array.from({ length: 10 }, (_, i) => ({
        name: `Suggestion ${i}`,
        category: { name: "Test Category" },
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockSuggestions);

      mockRequest.query = { query: "Test" };

      const startTime = performance.now();
      await controller.suggestions(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(50); // Suggestions should be very fast
    });
  });

  describe("Memory Usage", () => {
    it("should not cause memory leaks with repeated searches", async () => {
      const mockArtisans = Array.from({ length: 100 }, (_, i) => ({
        id: `artisan-${i}`,
        name: `Artisan ${i}`,
        description: `Description for artisan ${i}`,
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
        reviews: Array.from({ length: 5 }, (_, j) => ({ rating: 5 })),
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(1000);

      mockRequest.query = { search: "Test" };

      // Run multiple searches to check for memory leaks
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        await controller.index(mockRequest, mockResponse);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
