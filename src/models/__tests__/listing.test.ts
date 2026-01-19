import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { UserRole } from '@prisma/client';
// Create a new instance of PrismaClient for testing
import argon2 from 'argon2';
import { prisma } from 'src/db';

describe('Artisan Model', () => {
  let userId: string;
  let categoryId: string;
  let locationId: string;

  // Set up test data
  beforeAll(async () => {
    // Create a user
    const userData = {
      email: 'artisan-test@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Artisan',
      lastName: 'Test',
      role: UserRole.CURATOR,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    userId = user.id;

    // Create a category
    const category = await prisma.category.create({
      data: {
        name: 'Test Category',
        description: 'Category for testing',
      },
    });

    categoryId = category.id;

    // Create a location
    const location = await prisma.location.create({
      data: {
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        latitude: 0,
        longitude: 0,
      },
    });

    locationId = location.id;
  });

  // Clean up after tests
  afterAll(async () => {
    await prisma.artisan.deleteMany();
    await prisma.category.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should create a new artisan with fixed price', async () => {
    const artisanData = {
      name: 'Test Artisan',
      email: 'artisan-test@example.com',
      description: 'This is a test artisan',
      price: 100,
      images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      curatorId: userId,
      categoryId,
      locationId,
      isActive: true,
    };

    const artisan = await prisma.artisan.create({
      data: artisanData,
    });

    expect(artisan).toHaveProperty('id');
    expect(artisan.name).toBe(artisanData.name);
    expect(artisan.email).toBe(artisanData.email);
    expect(artisan.price).toBe(artisanData.price);
    expect(artisan.curatorId).toBe(userId);
    expect(artisan.isActive).toBe(true);
  });

  it('should create a new artisan with price range', async () => {
    const artisanData = {
      name: 'Test Artisan with Range',
      email: 'artisan-test@example.com',
      description: 'This is a test artisan with a price range',
      priceRange: { min: 50, max: 150 },
      images: ['https://example.com/image1.jpg'],
      curatorId: userId,
      categoryId,
      locationId,
      isActive: true,
    };

    const artisan = await prisma.artisan.create({
      data: artisanData,
    });

    expect(artisan).toHaveProperty('id');
    expect(artisan.name).toBe(artisanData.name);
    expect(artisan.email).toBe(artisanData.email);
    expect(artisan.priceRange).toEqual(artisanData.priceRange);
    expect(artisan.price).toBeNull();
  });

  it('should update a artisan', async () => {
    const artisanData = {
      name: 'Artisan to Update',
      email: 'artisan-test@example.com',
      description: 'This artisan will be updated',
      price: 200,
      images: ['https://example.com/image.jpg'],
      curatorId: userId,
      categoryId,
      locationId,
    };

    const artisan = await prisma.artisan.create({
      data: artisanData,
    });

    const updatedArtisan = await prisma.artisan.update({
      where: { id: artisan.id },
      data: {
        name: 'Updated Artisan',
        price: 250,
        isActive: false,
      },
    });

    expect(updatedArtisan.name).toBe('Updated Artisan');
    expect(updatedArtisan.price).toBe(250);
    expect(updatedArtisan.isActive).toBe(false);
  });

  it('should delete a artisan', async () => {
    const artisanData = {
      name: 'Artisan to Delete',
      description: 'This artisan will be deleted',
      price: 300,
      images: ['https://example.com/image.jpg'],
      curatorId: userId,
      categoryId,
      locationId,
    };

    const artisan = await prisma.artisan.create({
      data: artisanData,
    });

    await prisma.artisan.delete({
      where: { id: artisan.id },
    });

    const deletedArtisan = await prisma.artisan.findUnique({
      where: { id: artisan.id },
    });

    expect(deletedArtisan).toBeNull();
  });

  it('should delete artisans when a user is deleted', async () => {
    // Create a new user for this test
    const userData = {
      email: 'artisan-cascade@example.com',
      password: await argon2.hash('password123'),
      firstName: 'Cascade',
      lastName: 'Test',
      role: UserRole.CURATOR,
    };

    const user = await prisma.user.create({
      data: userData,
    });

    // Create a artisan for this user
    await prisma.artisan.create({
      data: {
        name: 'Cascade Test Artisan',
        email: 'artisan-test@example.com',
        description: 'This artisan should be deleted when the user is deleted',
        price: 100,
        images: ['https://example.com/image.jpg'],
        curatorId: user.id,
        categoryId,
        locationId,
      },
    });

    // Delete the user
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Check if the artisan was also deleted (cascade)
    const artisans = await prisma.artisan.findMany({
      where: { curatorId: user.id },
    });

    expect(artisans).toHaveLength(0);
  });
});
