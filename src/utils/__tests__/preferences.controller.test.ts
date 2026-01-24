import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { prisma } from 'src/db';
import argon2 from 'argon2';
import {
  getPreferences,
  updatePreferences,
  resetPreferences,
} from 'src/controllers/PreferencesController';

describe('Preferences Controller', () => {
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
    await prisma.userPreferences.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      // Create preferences for the user
      await prisma.userPreferences.create({
        data: {
          userId: testUserId,
          emailNotifications: true,
          pushNotifications: false,
          theme: 'dark',
          language: 'en',
        },
      });

      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            userId: testUserId,
            emailNotifications: true,
            theme: 'dark',
          }),
        })
      );
    });

    it('should return default preferences if none exist', async () => {
      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getPreferences(req, res);

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

  describe('updatePreferences', () => {
    it('should update user preferences successfully', async () => {
      // Create initial preferences
      await prisma.userPreferences.create({
        data: {
          userId: testUserId,
          emailNotifications: true,
          theme: 'light',
        },
      });

      const req = {
        user: { id: testUserId },
        body: {
          emailNotifications: false,
          theme: 'dark',
          pushNotifications: true,
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await updatePreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            emailNotifications: false,
            theme: 'dark',
            pushNotifications: true,
          }),
        })
      );
    });

    it('should create preferences if they do not exist', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          emailNotifications: true,
          theme: 'dark',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await updatePreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const preferences = await prisma.userPreferences.findUnique({
        where: { userId: testUserId },
      });

      expect(preferences).toBeTruthy();
      expect(preferences?.theme).toBe('dark');
    });

    it('should validate preference values', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          theme: 'invalid-theme',
          language: 'invalid-lang',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await updatePreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });
  });

  describe('resetPreferences', () => {
    it('should reset preferences to defaults', async () => {
      // Create custom preferences
      await prisma.userPreferences.create({
        data: {
          userId: testUserId,
          emailNotifications: false,
          theme: 'dark',
          pushNotifications: false,
        },
      });

      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await resetPreferences(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            emailNotifications: true, // default value
            theme: 'light', // default value
          }),
        })
      );
    });
  });
});