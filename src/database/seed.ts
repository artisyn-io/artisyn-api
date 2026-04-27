import { UserRole, VerificationStatus } from '@prisma/client';

import argon2 from 'argon2';
import { prisma } from 'src/db';

async function main () {
  console.log('Starting seed...');

  // Note: When running with `prisma db push --force-reset` in CI,
  // the database is already clean, so we don't need to delete existing data.
  // The delete operations below are only needed for local development
  // when re-running seed on an existing database.
  
  // For CI/production with fresh databases, skip deletion entirely
  if (process.env.NODE_ENV === 'test' || process.env.CI) {
    console.log('Skipping data deletion (fresh database detected)');
  } else {
    // Clear existing data (in order to respect foreign key constraints)
    // Delete leaf nodes first (models with foreign keys to other models)
    try {
      // Level 1: No foreign keys or only reference other leaf nodes
      await prisma.analyticsEvent.deleteMany();
      await prisma.dataExportRequest.deleteMany();
      await prisma.personalAccessToken.deleteMany();
      await prisma.passwordCodeResets.deleteMany();
      await prisma.pendingDeletion.deleteMany();
      await prisma.media.deleteMany();
      
      // Level 2: Reference Reviews
      await prisma.reviewResponse.deleteMany();
      await prisma.reviewReport.deleteMany();
      
      // Level 3: Reference Users and Artisans
      await prisma.tip.deleteMany();
      await prisma.review.deleteMany();
      await prisma.job.deleteMany();
      await prisma.application.deleteMany();
      
      // Level 4: Reference Users, Categories, Locations
      await prisma.artisan.deleteMany();
      await prisma.curator.deleteMany();
      
      // Level 5: Reference Categories
      await prisma.subcategory.deleteMany();
      
      // Level 6: No foreign keys or standalone
      await prisma.category.deleteMany();
      await prisma.location.deleteMany();
      
      // Level 7: Delete last - referenced by almost everything
      await prisma.user.deleteMany();
      
      console.log('Cleared existing data');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('Note: Could not clear all data:', errorMessage);
    }
  }

  // Create admin user
  const adminPassword = await argon2.hash('admin123');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@artisyn.io',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    },
  });

  console.log('Created admin user:', admin.id);

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Woodworking',
        description: 'Handcrafted wooden items and furniture',
        icon: 'woodworking.svg',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Textiles',
        description: 'Handmade clothing, fabrics, and textile arts',
        icon: 'textiles.svg',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Ceramics',
        description: 'Pottery, ceramic art, and functional items',
        icon: 'ceramics.svg',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Jewelry',
        description: 'Handcrafted jewelry and accessories',
        icon: 'jewelry.svg',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Home Services',
        description: 'Skilled services for home maintenance and improvement',
        icon: 'home-services.svg',
      },
    }),
  ]);

  console.log('Created categories');

  // Create subcategories
  const subcategories = await Promise.all([
    // Woodworking subcategories
    prisma.subcategory.create({
      data: {
        name: 'Furniture',
        description: 'Custom-made furniture pieces',
        categoryId: categories[0].id,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Decorative Items',
        description: 'Wooden decorative items for home',
        categoryId: categories[0].id,
      },
    }),
    // Textiles subcategories
    prisma.subcategory.create({
      data: {
        name: 'Clothing',
        description: 'Handmade clothing items',
        categoryId: categories[1].id,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Home Textiles',
        description: 'Textiles for home decoration',
        categoryId: categories[1].id,
      },
    }),
    // Ceramics subcategories
    prisma.subcategory.create({
      data: {
        name: 'Pottery',
        description: 'Handcrafted pottery items',
        categoryId: categories[2].id,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Ceramic Art',
        description: 'Artistic ceramic pieces',
        categoryId: categories[2].id,
      },
    }),
    // Jewelry subcategories
    prisma.subcategory.create({
      data: {
        name: 'Necklaces',
        description: 'Handcrafted necklaces',
        categoryId: categories[3].id,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Rings',
        description: 'Custom-made rings',
        categoryId: categories[3].id,
      },
    }),
    // Home Services subcategories
    prisma.subcategory.create({
      data: {
        name: 'Plumbing',
        description: 'Plumbing services',
        categoryId: categories[4].id,
      },
    }),
    prisma.subcategory.create({
      data: {
        name: 'Carpentry',
        description: 'Carpentry services',
        categoryId: categories[4].id,
      },
    }),
  ]);

  console.log('Created subcategories');

  // Create locations
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        city: 'New York',
        state: 'NY',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.0060,
      },
    }),
    prisma.location.create({
      data: {
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        latitude: 34.0522,
        longitude: -118.2437,
      },
    }),
    prisma.location.create({
      data: {
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        latitude: 41.8781,
        longitude: -87.6298,
      },
    }),
  ]);

  console.log('Created locations');

  // Create regular users
  const userPassword = await argon2.hash('password123');
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'user1@example.com',
        password: userPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        bio: 'I love finding unique handcrafted items.',
        location: {
          connect: {
            id: locations[0].id,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'user2@example.com',
        password: userPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        role: UserRole.USER,
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        bio: 'Supporting local artisans is my passion.',
        location: {
          connect: {
            id: locations[1].id,
          },
        },
      },
    }),
  ]);

  console.log('Created regular users');

  // Create curator users
  const curatorUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'curator1@example.com',
        password: userPassword,
        firstName: 'Michael',
        lastName: 'Johnson',
        role: UserRole.CURATOR,
        walletAddress: '0x2345678901abcdef2345678901abcdef23456789',
        bio: 'Master woodworker with 15 years of experience.',
        location: {
          connect: {
            id: locations[0].id,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'curator2@example.com',
        password: userPassword,
        firstName: 'Emily',
        lastName: 'Williams',
        role: UserRole.CURATOR,
        walletAddress: '0x3456789012abcdef3456789012abcdef34567890',
        bio: 'Textile artist specializing in sustainable fabrics.',
        location: {
          connect: {
            id: locations[1].id,
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        email: 'curator3@example.com',
        password: userPassword,
        firstName: 'David',
        lastName: 'Brown',
        role: UserRole.CURATOR,
        walletAddress: '0x4567890123abcdef4567890123abcdef45678901',
        bio: 'Ceramic artist with a focus on functional pottery.',
        location: {
          connect: {
            id: locations[2].id,
          },
        },
      },
    }),
  ]);

  console.log('Created curator users');

  // Create curator profiles
  const curators = await Promise.all([
    prisma.curator.create({
      data: {
        userId: curatorUsers[0].id,
        verificationStatus: VerificationStatus.VERIFIED,
        specialties: ['Furniture', 'Cabinetry'],
        experience: 15,
        portfolio: 'https://portfolio.michaeljohnson.com',
        certificates: ['https://certs.woodworking.org/cert123'],
        verifiedAt: new Date(),
      },
    }),
    prisma.curator.create({
      data: {
        userId: curatorUsers[1].id,
        verificationStatus: VerificationStatus.VERIFIED,
        specialties: ['Sustainable Textiles', 'Natural Dyes'],
        experience: 8,
        portfolio: 'https://emilywilliams.textile.art',
        certificates: ['https://certs.textilearts.org/cert456'],
        verifiedAt: new Date(),
      },
    }),
    prisma.curator.create({
      data: {
        userId: curatorUsers[2].id,
        verificationStatus: VerificationStatus.PENDING,
        specialties: ['Functional Pottery', 'Ceramic Sculpture'],
        experience: 12,
        portfolio: 'https://davidbrown.ceramics.com',
        certificates: [],
      },
    }),
  ]);

  console.log('Created curator profiles');

  // Create artisans
  const artisans = await Promise.all([
    prisma.artisan.create({
      data: {
        name: 'Artisan 1',
        type: 'PERSON',
        phone: '+2349012345678',
        email: 'artisan1@example.com',
        description: 'Handcrafted dining table made from reclaimed oak. Can be customized to your specifications.',
        price: 1200,
        images: [
          'https://example.com/images/table1.jpg',
          'https://example.com/images/table2.jpg',
        ],
        curatorId: curatorUsers[0].id,
        categoryId: categories[0].id,
        subcategoryId: subcategories[0].id,
        locationId: locations[0].id,
      },
    }),
    prisma.artisan.create({
      data: {
        name: 'Artisan 2',
        type: 'PERSON',
        phone: '+2349012345679',
        email: 'artisan2@example.com',
        description: 'Cozy blanket made from 100% natural wool, handwoven using traditional techniques.',
        price: 250,
        images: [
          'https://example.com/images/blanket1.jpg',
          'https://example.com/images/blanket2.jpg',
        ],
        curatorId: curatorUsers[1].id,
        categoryId: categories[1].id,
        subcategoryId: subcategories[3].id,
        locationId: locations[1].id,
      },
    }),
    prisma.artisan.create({
      data: {
        name: 'Artisan 3',
        type: 'PERSON',
        phone: '+2349012345610',
        email: 'artisan3@example.com',
        description: 'Complete dinner set including plates, bowls, and cups. Each piece is handmade and glazed.',
        priceRange: { min: 180, max: 350 },
        images: [
          'https://example.com/images/ceramics1.jpg',
          'https://example.com/images/ceramics2.jpg',
        ],
        curatorId: curatorUsers[2].id,
        categoryId: categories[2].id,
        subcategoryId: subcategories[4].id,
        locationId: locations[2].id,
      },
    }),
  ]);

  console.log('Created artisans');

  // Create reviews
  const reviews = await Promise.all([
    prisma.review.create({
      data: {
        rating: 5,
        comment: 'Absolutely beautiful work! The table is exactly what I wanted.',
        authorId: users[0].id,
        targetId: curatorUsers[0].id,
        artisanId: artisans[0].id,
      },
    }),
    prisma.review.create({
      data: {
        rating: 4,
        comment: 'The blanket is very cozy and well-made. Shipping was a bit slow.',
        authorId: users[1].id,
        targetId: curatorUsers[1].id,
        artisanId: artisans[1].id,
      },
    }),
  ]);

  console.log('Created reviews');

  // Create tips
  const tips = await Promise.all([
    prisma.tip.create({
      data: {
        amount: 50,
        currency: 'ETH',
        message: 'Thank you for the amazing table!',
        status: 'COMPLETED',
        senderId: users[0].id,
        receiverId: curatorUsers[0].id,
        artisanId: artisans[0].id,
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
    }),
    prisma.tip.create({
      data: {
        amount: 25,
        currency: 'ETH',
        message: 'Love the blanket!',
        status: 'COMPLETED',
        senderId: users[1].id,
        receiverId: curatorUsers[1].id,
        artisanId: artisans[1].id,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      },
    }),
  ]);

  console.log('Created tips');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
