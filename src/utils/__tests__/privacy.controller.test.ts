import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { prisma } from 'src/db';
import argon2 from 'argon2';
import {
  getPrivacySettings,
  updatePrivacySettings,
  deleteUserData,
} from 'src/controllers/PrivacyController';

describe('Privacy Controller', () => {
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
    await prisma.privacySettings.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe('getPrivacySettings', () => {
    it('should return privacy settings for a user', async () => {
      // Create privacy settings
      await prisma.privacySettings.create({
        data: {
          userId: testUserId,
          profileVisibility: 'PUBLIC',
          showEmail: false,
          showPhone: false,
        },
      });

      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getPrivacySettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            userId: testUserId,
            profileVisibility: 'PUBLIC',
            showEmail: false,
          }),
        })
      );
    });

    it('should return default privacy settings if none exist', async () => {
      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getPrivacySettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            userId: testUserId,
          }),
        })
      );
    });
  });

  describe('updatePrivacySettings', () => {
    it('should update privacy settings successfully', async () => {
      // Create initial settings
      await prisma.privacySettings.create({
        data: {
          userId: testUserId,
          profileVisibility: 'PUBLIC',
          showEmail: true,
        },
      });

      const req = {
        user: { id: testUserId },
        body: {
          profileVisibility: 'PRIVATE',
          showEmail: false,
          showLocation: false,
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await updatePrivacySettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            profileVisibility: 'PRIVATE',
            showEmail: false,
          }),
        })
      );
    });

    it('should create privacy settings if they do not exist', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          profileVisibility: 'PRIVATE',
          showEmail: false,
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await updatePrivacySettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const settings = await prisma.privacySettings.findUnique({
        where: { userId: testUserId },
      });

      expect(settings).toBeTruthy();
      expect(settings?.profileVisibility).toBe('PRIVATE');
    });

    it('should validate privacy setting values', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          profileVisibility: 'PRIVATE',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await updatePrivacySettings(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data successfully', async () => {
      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await deleteUserData(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
        })
      );
    });
  });
});