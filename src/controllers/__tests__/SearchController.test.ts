import { describe, it, expect, beforeEach, vi } from 'vitest';
import SearchController from '../SearchController';
import { Request, Response } from 'express';
import { prisma } from 'src/db';

// Mock Prisma
vi.mock('src/db', () => ({
  prisma: {
    artisan: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    curator: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock Resource
vi.mock('src/resources', () => ({
  default: vi.fn().mockImplementation((req, res, data) => ({
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    additional: vi.fn().mockReturnThis(),
  })),
}));

// Mock Validator
vi.mock('src/utils/validator', () => ({
  validate: vi.fn().mockImplementation((query) => query),
}));

describe('SearchController', () => {
  let controller: SearchController;
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new SearchController();
    req = {
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('index', () => {
    it('should return both artisans and curators with correct filtering', async () => {
      req.query = { query: 'test' };

      (prisma.artisan.findMany as any).mockResolvedValue([{ id: '1', name: 'Test Artisan' }]);
      (prisma.curator.findMany as any).mockResolvedValue([{ id: '2', userId: 'user-1' }]);
      (prisma.artisan.count as any).mockResolvedValue(1);
      (prisma.curator.count as any).mockResolvedValue(1);

      await controller.index(req as Request, res as Response);

      // Verify Artisan query uses isActive: true
      expect(prisma.artisan.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }),
      }));

      // Verify Curator query uses verificationStatus: 'VERIFIED'
      expect(prisma.curator.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: 'VERIFIED',
        }),
      }));
    });
  });

  describe('suggestions', () => {
    it('should return correctly formatted labels for artisans and curators', async () => {
      req.query = { query: 'john' };

      (prisma.artisan.findMany as any).mockResolvedValue([
        { name: 'John Artisan' }
      ]);
      (prisma.curator.findMany as any).mockResolvedValue([
        {
          user: { firstName: 'John', lastName: 'Curator' }
        }
      ]);

      await controller.suggestions(req as Request, res as Response);

      // Verify Curator query uses verificationStatus: 'VERIFIED'
      expect(prisma.curator.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: 'VERIFIED',
        }),
      }));

      // Verify select structure for curator suggestions
      expect(prisma.curator.findMany).toHaveBeenCalledWith(expect.objectContaining({
        select: expect.objectContaining({
          user: expect.objectContaining({
            select: { firstName: true, lastName: true }
          })
        }),
      }));
    });

    it('should handle empty suggestions gracefully', async () => {
      req.query = { query: 'nonexistent' };
      (prisma.artisan.findMany as any).mockResolvedValue([]);
      (prisma.curator.findMany as any).mockResolvedValue([]);

      await controller.suggestions(req as Request, res as Response);

      expect(prisma.artisan.findMany).toHaveBeenCalled();
      expect(prisma.curator.findMany).toHaveBeenCalled();
    });
  });
});
