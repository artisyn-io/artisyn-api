import { prisma } from "src/db";

interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
  key: string;
}

export class SearchCacheService {
  private static instance: SearchCacheService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): SearchCacheService {
    if (!SearchCacheService.instance) {
      SearchCacheService.instance = new SearchCacheService();
    }
    return SearchCacheService.instance;
  }

  /**
   * Generate cache key from search parameters
   */
  private generateKey(params: Record<string, any> | string): string {
    // If params is already a string, use it directly
    if (typeof params === 'string') {
      return params;
    }

    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = params[key];
          return result;
        },
        {} as Record<string, any>,
      );

    return `search:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cached search results
   */
  public async get<T>(params: Record<string, any> | string): Promise<T | null> {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache search results
   */
  public async set<T>(
    params: Record<string, any> | string,
    data: T,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    const key = this.generateKey(params);
    const expiresAt = new Date(Date.now() + ttl);

    this.cache.set(key, {
      data,
      expiresAt,
      key,
    });

    // Clean up expired entries periodically
    this.cleanupExpired();
  }

  /**
   * Invalidate cache for specific patterns
   */
  public invalidate(pattern: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // This would need to be tracked separately
    };
  }

  /**
   * Cache popular searches and categories
   */
  public async cachePopularData(): Promise<void> {
    try {
      // Cache popular categories
      const popularCategories = await prisma.category.findMany({
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
      });

      await this.set("popular:categories", popularCategories, 10 * 60 * 1000); // 10 minutes

      // Cache popular locations
      const popularLocations = await prisma.location.groupBy({
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
      });

      await this.set("popular:locations", popularLocations, 10 * 60 * 1000); // 10 minutes
    } catch (error) {
      console.error("Error caching popular data:", error);
    }
  }
}

export default SearchCacheService.getInstance();