import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import DataExportController from '../../src/controllers/DataExportController';

const prisma = new PrismaClient();

jest.mock('../../src/utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
}));

describe('DataExportController - Cancel Account Deletion', () => {
  let controller: DataExportController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeAll(async () => {
    // Create a dummy user for the test
    await prisma.user.upsert({
      where: { id: 'test-user-id' },
      update: {},
      create: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
      },
    });
  });

  beforeEach(() => {
    controller = new DataExportController();
    mockReq = {
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(async () => {
    await prisma.pendingDeletion.deleteMany({
      where: { userId: 'test-user-id' },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({
      where: { id: 'test-user-id' },
    });
    await prisma.$disconnect();
  });

  it('should successfully cancel deletion using email-link token (no auth required)', async () => {
    const token = 'random-cancel-token-123';
    
    await prisma.pendingDeletion.create({
      data: {
        userId: 'test-user-id',
        token,
        scheduledAt: new Date(Date.now() + 86400000),
      },
    });

    mockReq.body = { token };
    // Notice no req.user is set, simulating unauthenticated state

    await controller.cancelAccountDeletion(mockReq as Request, mockRes as Response);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        message: 'Account deletion cancelled. Your account is safe.',
      })
    );

    const pending = await prisma.pendingDeletion.findUnique({ where: { token } });
    expect(pending).toBeNull();
  });

  it('should successfully cancel deletion using in-app flow (requires auth)', async () => {
    await prisma.pendingDeletion.create({
      data: {
        userId: 'test-user-id',
        token: 'another-token',
        scheduledAt: new Date(Date.now() + 86400000),
      },
    });

    mockReq.user = { id: 'test-user-id' } as any;
    mockReq.body = {}; // No token provided

    await controller.cancelAccountDeletion(mockReq as Request, mockRes as Response);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        message: 'Account deletion cancelled. Your account is safe.',
      })
    );

    const pending = await prisma.pendingDeletion.findUnique({ where: { userId: 'test-user-id' } });
    expect(pending).toBeNull();
  });

  it('should fail in-app flow if not authenticated', async () => {
    mockReq.body = {}; // No token provided
    // No req.user set

    await expect(controller.cancelAccountDeletion(mockReq as Request, mockRes as Response)).rejects.toThrow('Unauthorized');
  });

  it('should fail if token is invalid', async () => {
    mockReq.body = { token: 'invalid-token' };

    await expect(controller.cancelAccountDeletion(mockReq as Request, mockRes as Response)).rejects.toThrow('No pending deletion request found');
  });

  it('should fail if authenticated user tries to cancel anothers deletion', async () => {
    await prisma.pendingDeletion.create({
      data: {
        userId: 'test-user-id',
        token: 'token-abc',
        scheduledAt: new Date(Date.now() + 86400000),
      },
    });

    mockReq.user = { id: 'other-user-id' } as any;
    mockReq.body = { token: 'token-abc' };

    await expect(controller.cancelAccountDeletion(mockReq as Request, mockRes as Response)).rejects.toThrow('Forbidden');
  });
});
