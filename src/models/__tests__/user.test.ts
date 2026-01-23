import { PrismaClient, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import argon2 from 'argon2';
// Create a new instance of PrismaClient for testing
import { prisma } from '../../db';

describe('User Model', () => {
  // Clean up after tests
  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    expect(user).toHaveProperty('id');
    expect(user.email).toBe(userData.email);
    expect(user.firstName).toBe(userData.firstName);
    expect(user.lastName).toBe(userData.lastName);
    expect(user.role).toBe(userData.role);
  });

  it('should not allow duplicate emails', async () => {
    const userData = {
      email: 'duplicate@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Duplicate',
      lastName: 'User',
      role: UserRole.USER,
    };

    await prisma.user.create({
      data: userData,
    });

    await expect(
      prisma.user.create({
        data: userData,
      })
    ).rejects.toThrow();
  });

  it('should update a user', async () => {
    const userData = {
      email: 'update@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Update',
      lastName: 'User',
      role: UserRole.USER,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: 'Updated',
        bio: 'This is a test bio',
      },
    });

    expect(updatedUser.firstName).toBe('Updated');
    expect(updatedUser.bio).toBe('This is a test bio');
  });

  it('should delete a user', async () => {
    const userData = {
      email: 'delete@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Delete',
      lastName: 'User',
      role: UserRole.USER,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    await prisma.user.delete({
      where: { id: user.id },
    });

    const deletedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(deletedUser).toBeNull();
  });
});
