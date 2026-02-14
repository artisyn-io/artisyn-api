import { ReviewStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IUser } from "src/models/interfaces";
import RegisterController from "src/controllers/auth/RegisterController";
import ReviewController from "src/controllers/ReviewController";
import app from "../../index";
import { authenticateToken } from "src/utils/helpers";
import { faker } from "@faker-js/faker";
import multer from "multer";
import { prisma } from "src/db";
import request from "supertest";

describe("Reviews Controller", () => {
  let author: IUser;
  let curator: IUser;
  let admin: IUser;
  let authorToken: string;
  let curatorToken: string;
  let adminToken: string;
  let testReviewId: string;

  const authorEmail = faker.internet.email();
  const curatorEmail = faker.internet.email();
  const adminEmail = faker.internet.email();

  beforeAll(async () => {
    const upload = multer();

    // Review routes (some support optional authentication)
    const reviewController = new ReviewController();
    app.get("/test/reviews", reviewController.index);
    app.get(
      "/test/reviews/moderation-queue",
      authenticateToken,
      reviewController.moderationQueue,
    );
    app.get(
      "/test/reviews/reports",
      authenticateToken,
      reviewController.getReports,
    );
    app.get(
      "/test/reviews/aggregation/:targetId",
      reviewController.aggregation,
    );
    // For testing: we'll use optional auth by always calling authenticateToken but handling missing user in controller
    app.get("/test/reviews/:id", authenticateToken, reviewController.show);
    app.post(
      "/test/reviews",
      authenticateToken,
      upload.none(),
      reviewController.create,
    );
    app.put(
      "/test/reviews/:id",
      authenticateToken,
      upload.none(),
      reviewController.update,
    );
    app.delete("/test/reviews/:id", authenticateToken, reviewController.delete);
    app.put(
      "/test/reviews/:id/moderate",
      authenticateToken,
      upload.none(),
      reviewController.moderate,
    );
    app.post(
      "/test/reviews/:id/respond",
      authenticateToken,
      upload.none(),
      reviewController.respond,
    );
    app.put(
      "/test/reviews/:id/respond",
      authenticateToken,
      upload.none(),
      reviewController.updateResponse,
    );
    app.delete(
      "/test/reviews/:id/respond",
      authenticateToken,
      reviewController.deleteResponse,
    );
    app.post(
      "/test/reviews/:id/report",
      authenticateToken,
      upload.none(),
      reviewController.report,
    );
    app.put(
      "/test/reviews/reports/:id",
      authenticateToken,
      upload.none(),
      reviewController.resolveReport,
    );

    // Create author user (regular user)
    const authorResponse = await request(app).post("/api/auth/signup").send({
      email: authorEmail,
      lastName: faker.person.lastName(),
      firstName: faker.person.firstName(),
      password: "Password123#",
      password_confirmation: "Password123#",
    });

    author = authorResponse.body.data;
    authorToken = authorResponse.body.token;

    // Create curator user
    const curatorResponse = await request(app).post("/api/auth/signup").send({
      email: curatorEmail,
      lastName: faker.person.lastName(),
      firstName: faker.person.firstName(),
      password: "Password123#",
      password_confirmation: "Password123#",
    });

    curator = curatorResponse.body.data;
    curatorToken = curatorResponse.body.token;

    // Update curator role to CURATOR
    await prisma.user.update({
      where: { id: curator.id },
      data: { role: UserRole.CURATOR },
    });

    // Create curator profile
    await prisma.curator.create({
      data: {
        userId: curator.id,
        specialties: ["Art", "Crafts"],
        experience: 5,
      },
    });

    // Create admin user
    const adminResponse = await request(app).post("/api/auth/signup").send({
      email: adminEmail,
      lastName: faker.person.lastName(),
      firstName: faker.person.firstName(),
      password: "Password123#",
      password_confirmation: "Password123#",
    });

    admin = adminResponse.body.data;
    adminToken = adminResponse.body.token;

    // Update admin role
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: UserRole.ADMIN },
    });
  });

  // Clean up after tests
  afterAll(async () => {
    // Delete reviews and related data first (foreign key constraints)
    await prisma.reviewReport.deleteMany({
      where: {
        OR: [
          { reporterId: author?.id },
          { reporterId: curator?.id },
          { reporterId: admin?.id },
        ],
      },
    });

    await prisma.reviewResponse.deleteMany({
      where: {
        review: {
          OR: [{ authorId: author?.id }, { targetId: curator?.id }],
        },
      },
    });

    await prisma.review.deleteMany({
      where: {
        OR: [{ authorId: author?.id }, { targetId: curator?.id }],
      },
    });

    // Delete curator profile
    if (curator?.id) {
      await prisma.curator.deleteMany({ where: { userId: curator.id } });
    }

    // Delete users
    if (author?.id) {
      await prisma.user.delete({ where: { id: author.id } });
    }
    if (curator?.id) {
      await prisma.user.delete({ where: { id: curator.id } });
    }
    if (admin?.id) {
      await prisma.user.delete({ where: { id: admin.id } });
    }
  });

  describe("POST /reviews", () => {
    it("should create a new review", async () => {
      const response = await request(app)
        .post("/test/reviews")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          rating: 5,
          comment: "Great curator!",
          target_id: curator.id,
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.comment).toBe("Great curator!");
      expect(response.body.data.authorId).toBe(author.id);
      expect(response.body.data.targetId).toBe(curator.id);
      expect(response.body.data.status).toBe(ReviewStatus.PENDING);
      expect(response.body.data.id).toBeDefined();

      testReviewId = response.body.data.id;
    });

    it("should prevent self-review", async () => {
      const response = await request(app)
        .post("/test/reviews")
        .set("Authorization", `Bearer ${curatorToken}`)
        .send({
          rating: 5,
          target_id: curator.id,
        });

      expect(response.statusCode).toBe(422);
    });

    it("should validate rating range", async () => {
      const response = await request(app)
        .post("/test/reviews")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          rating: 6,
          target_id: curator.id,
        });

      expect(response.statusCode).toBe(422);
    });

    it("should validate target exists", async () => {
      const response = await request(app)
        .post("/test/reviews")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          rating: 5,
          target_id: "non-existent-uuid-1234",
        });

      expect(response.statusCode).toBe(422);
    });

    it("should prevent duplicate reviews", async () => {
      const response = await request(app)
        .post("/test/reviews")
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          rating: 4,
          target_id: curator.id,
        });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("GET /reviews", () => {
    it("should list reviews", async () => {
      const response = await request(app)
        .get("/test/reviews")
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe("success");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should filter reviews by targetId", async () => {
      const response = await request(app)
        .get(`/test/reviews?targetId=${curator.id}`)
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      response.body.data.forEach((review: any) => {
        expect(review.targetId).toBe(curator.id);
      });
    });

    it("should filter reviews by authorId", async () => {
      const response = await request(app)
        .get(`/test/reviews?authorId=${author.id}`)
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      response.body.data.forEach((review: any) => {
        expect(review.authorId).toBe(author.id);
      });
    });
  });

  describe("GET /reviews/:id", () => {
    it("should return review for author", async () => {
      const response = await request(app)
        .get(`/test/reviews/${testReviewId}`)
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.id).toBe(testReviewId);
    });

    it("should return review for target", async () => {
      const response = await request(app)
        .get(`/test/reviews/${testReviewId}`)
        .set("Authorization", `Bearer ${curatorToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.id).toBe(testReviewId);
    });

    it("should return 404 for non-existent review", async () => {
      const response = await request(app)
        .get("/test/reviews/non-existent-id")
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PUT /reviews/:id", () => {
    it("should update review for author", async () => {
      const response = await request(app)
        .put(`/test/reviews/${testReviewId}`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          rating: 4,
          comment: "Updated comment",
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.rating).toBe(4);
      expect(response.body.data.comment).toBe("Updated comment");
    });

    it("should deny update for non-author", async () => {
      const response = await request(app)
        .put(`/test/reviews/${testReviewId}`)
        .set("Authorization", `Bearer ${curatorToken}`)
        .send({
          rating: 3,
        });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /reviews/:id/moderate", () => {
    it("should approve review (admin only)", async () => {
      const response = await request(app)
        .put(`/test/reviews/${testReviewId}/moderate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "APPROVED",
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.status).toBe(ReviewStatus.APPROVED);
      expect(response.body.data.moderatedBy).toBe(admin.id);
    });

    it("should deny moderation for non-admin", async () => {
      const response = await request(app)
        .put(`/test/reviews/${testReviewId}/moderate`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          status: "REJECTED",
        });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /reviews/:id/respond", () => {
    it("should allow curator to respond to review", async () => {
      const response = await request(app)
        .post(`/test/reviews/${testReviewId}/respond`)
        .set("Authorization", `Bearer ${curatorToken}`)
        .send({
          content: "Thank you for your review!",
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.data.response).toBeDefined();
      expect(response.body.data.response.content).toBe(
        "Thank you for your review!",
      );
    });

    it("should deny response from non-target", async () => {
      const response = await request(app)
        .post(`/test/reviews/${testReviewId}/respond`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          content: "This should fail",
        });

      expect(response.statusCode).toBe(403);
    });

    it("should prevent duplicate response", async () => {
      const response = await request(app)
        .post(`/test/reviews/${testReviewId}/respond`)
        .set("Authorization", `Bearer ${curatorToken}`)
        .send({
          content: "Another response",
        });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("PUT /reviews/:id/respond", () => {
    it("should allow curator to update response", async () => {
      const response = await request(app)
        .put(`/test/reviews/${testReviewId}/respond`)
        .set("Authorization", `Bearer ${curatorToken}`)
        .send({
          content: "Updated response!",
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.data.response.content).toBe("Updated response!");
    });
  });

  describe("POST /reviews/:id/report", () => {
    let secondReviewId: string;

    beforeAll(async () => {
      // Create another review for reporting tests
      const secondReview = await prisma.review.create({
        data: {
          rating: 1,
          comment: "Test review for reporting",
          authorId: admin.id,
          targetId: curator.id,
          status: ReviewStatus.APPROVED,
        },
      });
      secondReviewId = secondReview.id;
    });

    it("should allow user to report a review", async () => {
      const response = await request(app)
        .post(`/test/reviews/${secondReviewId}/report`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          reason: "SPAM",
          details: "This looks like spam",
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.data.reason).toBe("SPAM");
      expect(response.body.data.status).toBe("PENDING");
    });

    it("should prevent duplicate reports", async () => {
      const response = await request(app)
        .post(`/test/reviews/${secondReviewId}/report`)
        .set("Authorization", `Bearer ${authorToken}`)
        .send({
          reason: "FAKE",
        });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("GET /reviews/aggregation/:targetId", () => {
    it("should return rating aggregation for curator", async () => {
      const response = await request(app).get(
        `/test/reviews/aggregation/${curator.id}`,
      );

      expect(response.statusCode).toBe(200);
      expect(response.body.data.targetId).toBe(curator.id);
      expect(response.body.data.totalReviews).toBeDefined();
      expect(response.body.data.averageRating).toBeDefined();
      expect(response.body.data.ratingDistribution).toBeDefined();
    });

    it("should return 404 for non-existent user", async () => {
      const response = await request(app).get(
        "/test/reviews/aggregation/non-existent-id",
      );

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /reviews/moderation-queue", () => {
    it("should return pending reviews for admin", async () => {
      const response = await request(app)
        .get("/test/reviews/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should deny access for non-admin", async () => {
      const response = await request(app)
        .get("/test/reviews/moderation-queue")
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /reviews/reports", () => {
    it("should return reports for admin", async () => {
      const response = await request(app)
        .get("/test/reviews/reports")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should deny access for non-admin", async () => {
      const response = await request(app)
        .get("/test/reviews/reports")
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /reviews/:id", () => {
    it("should deny deletion for non-author", async () => {
      const response = await request(app)
        .delete(`/test/reviews/${testReviewId}`)
        .set("Authorization", `Bearer ${curatorToken}`);

      expect(response.statusCode).toBe(403);
    });

    it("should allow deletion for author", async () => {
      const response = await request(app)
        .delete(`/test/reviews/${testReviewId}`)
        .set("Authorization", `Bearer ${authorToken}`);

      expect(response.statusCode).toBe(204);
    });
  });
});
