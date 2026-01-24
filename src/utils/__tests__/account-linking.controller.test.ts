import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { prisma } from 'src/db';
import argon2 from 'argon2';
import {
  linkAccount,
  unlinkAccount,
  getLinkedAccounts,
} from 'src/controllers/AccountLinkingController';

describe('Account Linking Controller', () => {
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
    await prisma.accountLink.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe('linkAccount', () => {
    it('should link a new account successfully', async () => {
      const req = {
        user: { id: testUserId },
        body: {
          provider: 'GOOGLE',
          providerUserId: `provider-${Date.now()}`,
          accessToken: 'test-access-token',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await linkAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            provider: 'GOOGLE',
            userId: testUserId,
          }),
        })
      );
    });

    it('should fail if account is already linked', async () => {
      const providerUserId = `provider-${Date.now()}`;

      // Create existing link
      await prisma.accountLink.create({
        data: {
          userId: testUserId,
          provider: 'GOOGLE',
          providerUserId,
          accessToken: 'existing-token',
        },
      });

      const req = {
        user: { id: testUserId },
        body: {
          provider: 'GOOGLE',
          providerUserId,
          accessToken: 'test-access-token',
        },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await linkAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('already linked'),
        })
      );
    });
  });

  describe('unlinkAccount', () => {
    it('should unlink an account successfully', async () => {
      const accountLink = await prisma.accountLink.create({
        data: {
          userId: testUserId,
          provider: 'GOOGLE',
          providerUserId: `provider-${Date.now()}`,
          accessToken: 'test-token',
        },
      });

      const req = {
        user: { id: testUserId },
        params: { id: accountLink.id },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await unlinkAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
        })
      );

      const deletedLink = await prisma.accountLink.findUnique({
        where: { id: accountLink.id },
      });
      expect(deletedLink).toBeNull();
    });
  });

  describe('getLinkedAccounts', () => {
    it('should return all linked accounts for a user', async () => {
      await prisma.accountLink.createMany({
        data: [
          {
            userId: testUserId,
            provider: 'GOOGLE',
            providerUserId: `google-${Date.now()}`,
            accessToken: 'google-token',
          },
          {
            userId: testUserId,
            provider: 'FACEBOOK',
            providerUserId: `facebook-${Date.now()}`,
            accessToken: 'facebook-token',
          },
        ],
      });

      const req = {
        user: { id: testUserId },
      } as unknown as Request;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      await getLinkedAccounts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.arrayContaining([
            expect.objectContaining({ provider: 'GOOGLE' }),
            expect.objectContaining({ provider: 'FACEBOOK' }),
          ]),
        })
      );
    });
  });
});