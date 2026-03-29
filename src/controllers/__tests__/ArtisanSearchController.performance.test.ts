import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ArtisanSearchController from "../ArtisanSearchController";
import { performance } from "perf_hooks";
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

/**
 * Performance Thresholds (documented for contributors)
 *
 * These thresholds reflect expected response times when the database
 * layer is mocked. They are intentionally generous to avoid flakiness
 * on slower CI machines, while still catching genuine regressions.
 *
 * | Scenario                        | Threshold |
 * |---------------------------------|-----------|
 * | Basic search                    | 200ms     |
 * | Complex filtering               | 500ms     |
 * | Geospatial search               | 300ms     |
 * | Deep pagination                 | 100ms     |
 * | Autocomplete suggestions        | 50ms      |
 * | Memory increase (100 searches)  | 10MB      |
 *
 * To run only performance tests:
 *   npx vitest run --testPathPattern=performance
 *
 * To opt in on CI, set the environment variable:
 *   RUN_PERF_TESTS=true
 */

const PERFORMANCE_THRESHOLDS = {
  basicSearch: 200,
  complexFiltering: 500,
  geospatialSearch: 300,
  deepPagination: 100,
  suggestions: 50,
  memoryIncrease: 10 * 1024 * 1024, // 10MB
};

const runIfPerf = process.env.RUN_PERF_TESTS === "true" ? describe : describe.skip;

runIfPerf("ArtisanSearchController Performance Tests", () => {
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
    it(`should complete basic search within ${PERFORMANCE_THRESHOLDS.basicSearch}ms`, async () => {
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
          rating: (j % 5) + 1, // deterministic, no Math.random()
        })),
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(1000);

      mockRequest.query = {
        search: "Artisan",
        radius: 1,
        latitude: "40.7128",
        longitude: "-74.0060",
      };

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.basicSearch);
    });

    it(`should handle complex filtering within ${PERFORMANCE_THRESHOLDS.complexFiltering}ms`, async () => {
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
        reviews: Array.from({ length: 3 }, () => ({ rating: 5 })),
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
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.complexFiltering);
    });

    it(`should handle geospatial search within ${PERFORMANCE_THRESHOLDS.geospatialSearch}ms`, async () => {
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
          latitude: 40.7128 + (i - 15) * 0.005, // deterministic, no Math.random()
          longitude: -74.006 + (i - 15) * 0.005,
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
      };

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.geospatialSearch);
    });
  });

  describe("Pagination Performance", () => {
    it(`should handle large dataset deep pagination within ${PERFORMANCE_THRESHOLDS.deepPagination}ms`, async () => {
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
      (prisma.artisan.count as any).mockResolvedValue(100000);

      mockRequest.query = { page: "50", limit: "20" };

      const startTime = performance.now();
      await controller.index(mockRequest, mockResponse);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.deepPagination);
    });
  });

  describe("Suggestions Performance", () => {
    it(`should return suggestions within ${PERFORMANCE_THRESHOLDS.suggestions}ms`, async () => {
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
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.suggestions);
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
        reviews: Array.from({ length: 5 }, () => ({ rating: 5 })),
      }));

      (prisma.artisan.findMany as any).mockResolvedValue(mockArtisans);
      (prisma.artisan.count as any).mockResolvedValue(1000);

      mockRequest.query = { search: "Test" };

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        await controller.index(mockRequest, mockResponse);
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryIncrease);
    });
  });
});