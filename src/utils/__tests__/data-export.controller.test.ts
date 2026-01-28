import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { prisma } from 'src/db';
import argon2 from 'argon2';
import {
  requestDataExport,
  getDataExportStatus,
  downloadDataExport,
} from 'src/controllers/DataExportController';

describe('Data Export Controller', () => {
  let testUserId: string;
  let testUser: any;

  beforeEach(async () => {
    // Create a test user before each test
    testUserId = `test-user-${Date.now()}`;
    testUser = await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@test.com`,
        password: await argon2.hash('test-password'),
        firstName: 'Test',
        lastName: 'User',
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.dataExportRequest.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe('requestDataExport', () => {
    it('should create a data export request in CSV format', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          format: 'csv',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await requestDataExport(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            format: 'csv',
            userId: testUserId,
          }),
        })
      );
    });

    it('should create a data export request in JSON format', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          format: 'json',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await requestDataExport(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            format: 'json',
            userId: testUserId,
          }),
        })
      );
    });

    it('should reject invalid format', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          format: 'xml',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await requestDataExport(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });
  });

  describe('getDataExportStatus', () => {
    it('should return the status of a data export request', async () => {
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: testUserId,
          format: 'csv',
          status: 'PENDING',
        },
      });

      const req = {
        user: { id: testUserId },
        params: { id: exportRequest.id },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getDataExportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            id: exportRequest.id,
            status: 'PENDING',
          }),
        })
      );
    });

    it('should return 404 for non-existent export request', async () => {
      const req = {
        user: { id: testUserId },
        params: { id: 'non-existent-id' },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getDataExportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('downloadDataExport', () => {
    it('should download completed export', async () => {
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: testUserId,
          format: 'csv',
          status: 'COMPLETED',
        },
      });

      const req = {
        user: { id: testUserId },
        params: { id: exportRequest.id },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        download: vi.fn(),
      } as unknown as Response;

      await downloadDataExport(req, res);

      expect(res.download).toHaveBeenCalled();
    });

    it('should fail for pending export', async () => {
      const exportRequest = await prisma.dataExportRequest.create({
        data: {
          userId: testUserId,
          format: 'csv',
          status: 'PENDING',
        },
      });

      const req = {
        user: { id: testUserId },
        params: { id: exportRequest.id },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await downloadDataExport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('not ready'),
        })
      );
    });
  });
});