import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ListingOwnerType, UserRole } from "@prisma/client";
import app from "../index";
import { generateAccessToken } from "../utils/helpers";
import { prisma } from "../db";
import request from "supertest";

describe("Finder Listings API Integration Tests", () => {
  let finderToken: string;
  let curatorToken: string;
  let adminToken: string;
  let finderId: string;
  let curatorId: string;
  let adminId: string;
  let categoryId: string;
  let locationId: string;
  let finderListingId: string;

  beforeAll(async () => {
    // Cleanup potential stale data from aborted runs
    await prisma.tip.deleteMany();
    await prisma.review.deleteMany();
    await prisma.artisan.deleteMany();
    await prisma.personalAccessToken.deleteMany();
    await prisma.curator.deleteMany();
    await prisma.user.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.category.deleteMany();
    await prisma.location.deleteMany();

    // 1. Setup Data: Create Category & Location
    const category = await prisma.category.create({
      data: { name: "Test Category" },
    });
    categoryId = category.id;
    const location = await prisma.location.create({
      data: {
        city: "Test City",
        state: "TS",
        country: "Testland",
        latitude: 0,
        longitude: 0,
      },
    });
    locationId = location.id;

    // 2. Setup Users: Finder (USER role), Curator, and Admin
    const finder = await prisma.user.create({
      data: {
        email: "finder@test.com",
        password: "hash",
        firstName: "F",
        lastName: "T",
        role: UserRole.USER,
      },
    });
    finderId = finder.id;

    const curator = await prisma.user.create({
      data: {
        email: "curator@test.com",
        password: "hash",
        firstName: "C",
        lastName: "T",
        role: UserRole.CURATOR,
      },
    });
    curatorId = curator.id;

    const admin = await prisma.user.create({
      data: {
        email: "admin@test.com",
        password: "hash",
        firstName: "A",
        lastName: "T",
        role: UserRole.ADMIN,
      },
    });
    adminId = admin.id;

    // 3. Generate Tokens
    const fAuth = generateAccessToken({
      username: finder.email,
      id: finder.id,
      index: 1,
    });
    finderToken = fAuth.token;
    await prisma.personalAccessToken.create({
      data: {
        token: fAuth.token,
        name: "Test",
        userId: finder.id,
        expiresAt: new Date(fAuth.jwt.exp! * 1000),
      },
    });

    const cAuth = generateAccessToken({
      username: curator.email,
      id: curator.id,
      index: 2,
    });
    curatorToken = cAuth.token;
    await prisma.personalAccessToken.create({
      data: {
        token: cAuth.token,
        name: "Test",
        userId: curator.id,
        expiresAt: new Date(cAuth.jwt.exp! * 1000),
      },
    });

    const aAuth = generateAccessToken({
      username: admin.email,
      id: admin.id,
      index: 3,
    });
    adminToken = aAuth.token;
    await prisma.personalAccessToken.create({
      data: {
        token: aAuth.token,
        name: "Test",
        userId: admin.id,
        expiresAt: new Date(aAuth.jwt.exp! * 1000),
      },
    });

    // 4. Create Initial Finder Listing
    const listing = await prisma.artisan.create({
      data: {
        name: "Finder Listing",
        description: "Test Desc",
        phone: "123",
        categoryId,
        locationId,
        curatorId: finderId,
        ownerType: ListingOwnerType.FINDER,
        isActive: true,
        images: ["http://test.com/image.jpg"],
      },
    });
    finderListingId = listing.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.artisan.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.deleteMany();
    await prisma.location.deleteMany();
  });

  // =========================================================================
  // Authentication & Role Tests
  // =========================================================================

  it("GET /api/finder/listings should deny unauthenticated users (401)", async () => {
    const res = await request(app).get("/api/finder/listings");
    expect(res.status).toBe(401);
  });

  it("GET /api/finder/listings should deny curators (403)", async () => {
    const res = await request(app)
      .get("/api/finder/listings")
      .set("Authorization", `Bearer ${curatorToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/finder/listings should allow finders (200)", async () => {
    const res = await request(app)
      .get("/api/finder/listings")
      .set("Authorization", `Bearer ${finderToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /api/finder/listings should allow admins (200)", async () => {
    const res = await request(app)
      .get("/api/finder/listings")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  // =========================================================================
  // CRUD Operations Tests
  // =========================================================================

  it("POST /api/finder/listings should allow finders to create listings (201)", async () => {
    const res = await request(app)
      .post("/api/finder/listings")
      .set("Authorization", `Bearer ${finderToken}`)
      .send({
        name: "New Finder Listing",
        phone: "555-5555",
        description: "A newly created listing by finder",
        categoryId,
        locationId,
        images: ["http://example.com/img.jpg"],
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("New Finder Listing");
    expect(res.body.data.ownerType).toBe(ListingOwnerType.FINDER);
  });

  it("POST /api/finder/listings should deny curators (403)", async () => {
    const res = await request(app)
      .post("/api/finder/listings")
      .set("Authorization", `Bearer ${curatorToken}`)
      .send({
        name: "Fail Listing",
        phone: "123",
        description: "Desc",
        categoryId,
        locationId,
        images: ["http://test.com"],
      });
    expect(res.status).toBe(403);
  });

  it("GET /api/finder/listings should return only finder-owned listings", async () => {
    // Create a curator listing first
    await prisma.artisan.create({
      data: {
        name: "Curator Listing",
        description: "Curator Desc",
        phone: "456",
        categoryId,
        locationId,
        curatorId: curatorId,
        ownerType: ListingOwnerType.CURATOR,
        isActive: true,
        images: ["http://test.com/image.jpg"],
      },
    });

    const res = await request(app)
      .get("/api/finder/listings")
      .set("Authorization", `Bearer ${finderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // Should only return finder listings
    const allFinderOwned = res.body.data.every(
      (listing: any) => listing.curatorId === finderId
    );
    expect(allFinderOwned).toBe(true);
  });

  it("GET /api/finder/listings/:id should return a specific finder listing", async () => {
    const res = await request(app)
      .get(`/api/finder/listings/${finderListingId}`)
      .set("Authorization", `Bearer ${finderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(finderListingId);
    expect(res.body.data.name).toBe("Finder Listing");
  });

  it("GET /api/finder/listings/:id should return 404 for non-owned listing", async () => {
    // Create another finder user and their listing
    const otherFinder = await prisma.user.create({
      data: {
        email: "otherfinder@test.com",
        password: "hash",
        firstName: "O",
        lastName: "F",
        role: UserRole.USER,
      },
    });
    const otherListing = await prisma.artisan.create({
      data: {
        name: "Other Finder Listing",
        description: "Other Desc",
        phone: "789",
        categoryId,
        locationId,
        curatorId: otherFinder.id,
        ownerType: ListingOwnerType.FINDER,
        isActive: true,
        images: ["http://test.com/image.jpg"],
      },
    });

    // First finder tries to access second finder's listing
    const res = await request(app)
      .get(`/api/finder/listings/${otherListing.id}`)
      .set("Authorization", `Bearer ${finderToken}`);

    expect(res.status).toBe(404);

    // Cleanup
    await prisma.artisan.delete({ where: { id: otherListing.id } });
    await prisma.user.delete({ where: { id: otherFinder.id } });
  });

  it("PUT /api/finder/listings/:id should allow finder to update their listing (202)", async () => {
    const res = await request(app)
      .put(`/api/finder/listings/${finderListingId}`)
      .set("Authorization", `Bearer ${finderToken}`)
      .send({
        name: "Updated Finder Listing",
        phone: "999",
      });

    expect(res.status).toBe(202);
    expect(res.body.data.name).toBe("Updated Finder Listing");
  });

  it("PUT /api/finder/listings/:id should deny update to non-owned listing (404)", async () => {
    // Create another finder user and their listing
    const otherFinder = await prisma.user.create({
      data: {
        email: "otherfinder2@test.com",
        password: "hash",
        firstName: "O",
        lastName: "F",
        role: UserRole.USER,
      },
    });
    const otherListing = await prisma.artisan.create({
      data: {
        name: "Other Finder Listing 2",
        description: "Other Desc",
        phone: "789",
        categoryId,
        locationId,
        curatorId: otherFinder.id,
        ownerType: ListingOwnerType.FINDER,
        isActive: true,
        images: ["http://test.com/image.jpg"],
      },
    });

    // First finder tries to update second finder's listing
    const res = await request(app)
      .put(`/api/finder/listings/${otherListing.id}`)
      .set("Authorization", `Bearer ${finderToken}`)
      .send({
        name: "Hacked Listing",
      });

    expect(res.status).toBe(404);

    // Cleanup
    await prisma.artisan.delete({ where: { id: otherListing.id } });
    await prisma.user.delete({ where: { id: otherFinder.id } });
  });

  it("DELETE /api/finder/listings/:id should allow finder to delete their listing (202)", async () => {
    // Create a temporary listing to delete
    const tempListing = await prisma.artisan.create({
      data: {
        name: "To Delete",
        description: "...",
        phone: "1",
        categoryId,
        locationId,
        curatorId: finderId,
        ownerType: ListingOwnerType.FINDER,
        isActive: true,
        images: ["http://test.com/image.jpg"],
      },
    });

    const res = await request(app)
      .delete(`/api/finder/listings/${tempListing.id}`)
      .set("Authorization", `Bearer ${finderToken}`);

    expect(res.status).toBe(202);

    // Verify deletion
    const check = await prisma.artisan.findUnique({
      where: { id: tempListing.id },
    });
    expect(check).toBeNull();
  });

  it("DELETE /api/finder/listings/:id should deny deletion of non-owned listing (404)", async () => {
    // Create another finder user and their listing
    const otherFinder = await prisma.user.create({
      data: {
        email: "otherfinder3@test.com",
        password: "hash",
        firstName: "O",
        lastName: "F",
        role: UserRole.USER,
      },
    });
    const otherListing = await prisma.artisan.create({
      data: {
        name: "Other Finder Listing 3",
        description: "Other Desc",
        phone: "789",
        categoryId,
        locationId,
        curatorId: otherFinder.id,
        ownerType: ListingOwnerType.FINDER,
        isActive: true,
        images: ["http://test.com/image.jpg"],
      },
    });

    // First finder tries to delete second finder's listing
    const res = await request(app)
      .delete(`/api/finder/listings/${otherListing.id}`)
      .set("Authorization", `Bearer ${finderToken}`);

    expect(res.status).toBe(404);

    // Verify listing still exists
    const check = await prisma.artisan.findUnique({
      where: { id: otherListing.id },
    });
    expect(check).not.toBeNull();

    // Cleanup
    await prisma.artisan.delete({ where: { id: otherListing.id } });
    await prisma.user.delete({ where: { id: otherFinder.id } });
  });

  // =========================================================================
  // Pagination Tests
  // =========================================================================

  it("GET /api/finder/listings should include pagination meta", async () => {
    const res = await request(app)
      .get("/api/finder/listings?page=1&limit=5")
      .set("Authorization", `Bearer ${finderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.pagination).toBeDefined();
    expect(res.body.meta.pagination.perPage).toBe(5);
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  it("POST /api/finder/listings should validate required fields (422)", async () => {
    const res = await request(app)
      .post("/api/finder/listings")
      .set("Authorization", `Bearer ${finderToken}`)
      .send({
        // Missing required fields
        name: "Test",
      });

    expect(res.status).toBe(422);
  });

  it("POST /api/finder/listings should validate email format (422)", async () => {
    const res = await request(app)
      .post("/api/finder/listings")
      .set("Authorization", `Bearer ${finderToken}`)
      .send({
        name: "Test Listing",
        phone: "123",
        description: "Desc",
        categoryId,
        locationId,
        images: ["http://test.com"],
        email: "invalid-email",
      });

    expect(res.status).toBe(422);
  });
});
