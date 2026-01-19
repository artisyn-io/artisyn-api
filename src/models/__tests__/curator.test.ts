import { PrismaClient, UserRole, VerificationStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import argon2 from 'argon2';
// Create a new instance of PrismaClient for testing
import { prisma } from 'src/db';

describe('Curator Model', () => {
  let userId: string;

  // Set up a user for testing
  beforeAll(async () => {
    const userData = {
      email: 'curator-test@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Curator',
      lastName: 'Test',
      role: UserRole.CURATOR,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    userId = user.id;
  });

  // Clean up after tests
  afterAll(async () => {
    await prisma.curator.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should create a new curator profile', async () => {
    const curatorData = {
      userId,
      verificationStatus: VerificationStatus.PENDING,
      specialties: ['Woodworking', 'Furniture'],
      experience: 5,
      portfolio: 'https://example.com/portfolio',
      certificates: ['https://example.com/certificate1'],
    };

    const curator = await prisma.curator.create({
      data: curatorData,
    });

    expect(curator).toHaveProperty('id');
    expect(curator.userId).toBe(userId);
    expect(curator.verificationStatus).toBe(VerificationStatus.PENDING);
    expect(curator.specialties).toEqual(curatorData.specialties);
    expect(curator.experience).toBe(curatorData.experience);
  });

  it('should not allow duplicate curator profiles for the same user', async () => {
    const curatorData = {
      userId,
      verificationStatus: VerificationStatus.PENDING,
      specialties: ['Woodworking', 'Furniture'],
      experience: 5,
    };

    await expect(
      prisma.curator.create({
        data: curatorData,
      })
    ).rejects.toThrow();
  });

  it('should update a curator profile', async () => {
    const curator = await prisma.curator.findUnique({
      where: { userId },
    });

    if (!curator) {
      throw new Error('Curator not found');
    }

    const updatedCurator = await prisma.curator.update({
      where: { id: curator.id },
      data: {
        verificationStatus: VerificationStatus.VERIFIED,
        experience: 10,
        verifiedAt: new Date(),
      },
    });

    expect(updatedCurator.verificationStatus).toBe(VerificationStatus.VERIFIED);
    expect(updatedCurator.experience).toBe(10);
    expect(updatedCurator.verifiedAt).not.toBeNull();
  });

  it('should delete a curator profile when the user is deleted', async () => {
    // Create a new user and curator for this test
    const userData = {
      email: 'curator-delete@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Delete',
      lastName: 'Test',
      role: UserRole.CURATOR,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    await prisma.curator.create({
      data: {
        userId: user.id,
        verificationStatus: VerificationStatus.PENDING,
        specialties: ['Testing'],
        experience: 1,
      },
    });

    // Delete the user
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Check if the curator was also deleted (cascade)
    const deletedCurator = await prisma.curator.findUnique({
      where: { userId: user.id },
    });

    expect(deletedCurator).toBeNull();
  });
});
