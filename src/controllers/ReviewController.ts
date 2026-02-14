import { EventType, Prisma, ReportStatus, ReviewStatus } from "@prisma/client";
import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { RequestError } from "src/utils/errors";
import ReviewCollection from "src/resources/ReviewCollection";
import ReviewResource from "src/resources/ReviewResource";
import { prisma } from "src/db";
import { trackBusinessEvent } from "src/utils/analyticsMiddleware";

/**
 * ReviewController
 *
 * Handles review and rating operations including:
 * - CRUD operations for reviews
 * - Review moderation (admin only)
 * - Curator responses to reviews
 * - Abuse reporting and resolution
 * - Rating aggregation and statistics
 */
export default class extends BaseController {
  /**
   * List all reviews with filtering and pagination
   * Approved reviews are visible to everyone
   * Authors can see their own pending/rejected reviews
   * Admins can see all reviews
   *
   * GET /api/reviews
   */
  index = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    const { take, skip, meta } = this.pagination(req);

    // Build filter conditions
    const filters: Prisma.ReviewWhereInput = {};

    // Filter by author
    if (req.query.authorId) {
      filters.authorId = req.query.authorId as string;
    }

    // Filter by target (curator)
    if (req.query.targetId) {
      filters.targetId = req.query.targetId as string;
    }

    // Filter by artisan
    if (req.query.artisanId) {
      filters.artisanId = req.query.artisanId as string;
    }

    // Filter by rating
    if (req.query.rating) {
      filters.rating = parseInt(req.query.rating as string);
    }

    // Filter by status (admin only, or own reviews)
    if (req.query.status && isAdmin) {
      filters.status = req.query.status as ReviewStatus;
    } else if (!isAdmin) {
      // Non-admins can only see approved reviews OR their own reviews (if authenticated)
      if (userId) {
        filters.OR = [{ status: ReviewStatus.APPROVED }, { authorId: userId }];
      } else {
        // Unauthenticated users can only see approved reviews
        filters.status = ReviewStatus.APPROVED;
      }
    }

    const orderBy =
      {
        id: "id",
        rating: "rating",
        createdAt: "createdAt",
      }[String(req.query.orderBy ?? "createdAt")] ?? "createdAt";

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        take,
        skip,
        where: filters,
        orderBy: {
          [orderBy]: req.query.orderDir === "asc" ? "asc" : "desc",
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          artisan: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          response: true,
        },
      }),
      prisma.review.count({ where: filters }),
    ]);


    new ReviewCollection(req, res, {
      data,
      pagination: meta(total, data.length),
    })
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
      });
  };

  /**
   * Get a specific review by ID
   *
   * GET /api/reviews/:id
   */
  show = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const userId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        response: true,
      },
    });

    RequestError.assertFound(review, "Review not found", 404);

    // Access control: approved reviews are public, pending/rejected only visible to author or admin
    const canAccess =
      review!.status === ReviewStatus.APPROVED ||
      review!.authorId === userId ||
      review!.targetId === userId ||
      isAdmin;
    RequestError.assertFound(canAccess, "Access denied", 403);

    new ReviewResource(req, res, review!)
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
      });
  };

  /**
   * Create a new review
   * Reviews start with PENDING status and go through moderation
   *
   * POST /api/reviews
   */
  create = async (req: Request, res: Response) => {
    const authorId = req.user?.id!;

    const data = await this.validateAsync(req, {
      rating: "required|integer|min:1|max:5",
      comment: "nullable|string|max:1000",
      target_id: "required|exists:user,id",
      artisan_id: "nullable|exists:artisan,id",
    });

    // Prevent self-review
    RequestError.abortIf(
      data.target_id === authorId,
      "Cannot review yourself",
      422,
    );

    // Check if user already reviewed this target (optionally for the same artisan)
    const duplicateWhere: {
      authorId: string;
      targetId: string;
      artisanId?: string | null;
    } = {
      authorId,
      targetId: data.target_id,
    };
    // If artisan_id is provided, check for that specific artisan
    // Otherwise, check for reviews without an artisan
    if (data.artisan_id) {
      duplicateWhere.artisanId = data.artisan_id;
    } else {
      duplicateWhere.artisanId = null;
    }
    const existingReview = await prisma.review.findFirst({
      where: duplicateWhere,
    });
    RequestError.abortIf(
      !!existingReview,
      "You have already reviewed this curator" +
      (data.artisan_id ? " for this artisan" : ""),
      422,
    );

    // Validate target is a curator
    const target = await prisma.user.findUnique({
      where: { id: data.target_id },
      include: { curator: true },
    });
    RequestError.abortIf(
      !target || target.role !== "CURATOR",
      "Target must be a curator",
      422,
    );

    // If artisan_id provided, validate it belongs to the target curator
    if (data.artisan_id) {
      const artisan = await prisma.artisan.findUnique({
        where: { id: data.artisan_id },
      });
      RequestError.assertFound(artisan, "Artisan not found", 404);
      RequestError.abortIf(
        artisan!.curatorId !== data.target_id,
        "Artisan does not belong to this curator",
        422,
      );
    }

    const review = await prisma.review.create({
      data: {
        rating: parseInt(data.rating),
        comment: data.comment,
        status: ReviewStatus.PENDING,
        authorId,
        targetId: data.target_id,
        artisanId: data.artisan_id || null,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        response: true,
      },
    });

    // Track review created event (notification trigger)
    trackBusinessEvent(EventType.REVIEW_CREATED, authorId, {
      reviewId: review.id,
      rating: review.rating,
      targetId: review.targetId,
      artisanId: review.artisanId,
    });

    new ReviewResource(req, res, review)
      .json()
      .status(201)
      .additional({
        status: "success",
        message: "Review submitted and pending moderation",
        code: 201,
      });
  };

  /**
   * Update a review (author only, while pending)
   *
   * PUT /api/reviews/:id
   */
  update = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const userId = req.user?.id;

    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    RequestError.assertFound(existingReview, "Review not found", 404);
    RequestError.abortIf(
      existingReview!.authorId !== userId,
      "Access denied",
      403,
    );
    RequestError.abortIf(
      existingReview!.status !== ReviewStatus.PENDING,
      "Cannot update a moderated review",
      422,
    );

    const data = await this.validateAsync(req, {
      rating: "nullable|integer|min:1|max:5",
      comment: "nullable|string|max:1000",
    });

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: data.rating ? parseInt(data.rating) : existingReview!.rating,
        comment:
          data.comment !== undefined ? data.comment : existingReview!.comment,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        response: true,
      },
    });

    trackBusinessEvent(EventType.REVIEW_UPDATED, userId, {
      reviewId: review.id,
      rating: review.rating,
    });

    new ReviewResource(req, res, review)
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "Review updated successfully",
        code: 200,
      });
  };

  /**
   * Delete a review (author or admin only)
   *
   * DELETE /api/reviews/:id
   */
  delete = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const userId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    RequestError.assertFound(existingReview, "Review not found", 404);

    const canDelete = isAdmin || existingReview!.authorId === userId;
    RequestError.assertFound(canDelete, "Access denied", 403);

    await prisma.review.delete({ where: { id: reviewId } });

    res.status(204).send();
  };

  /**
   * Moderate a review (admin only)
   * Approve or reject a pending review
   *
   * PUT /api/reviews/:id/moderate
   */
  moderate = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const adminId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    RequestError.assertFound(isAdmin, "Admin access required", 403);

    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    RequestError.assertFound(existingReview, "Review not found", 404);

    const data = await this.validateAsync(req, {
      status: "required|string|in:APPROVED,REJECTED",
    });

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        status: data.status as ReviewStatus,
        moderatedBy: adminId,
        moderatedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        response: true,
      },
    });

    // Track moderation event
    const eventType =
      data.status === "APPROVED"
        ? EventType.REVIEW_APPROVED
        : EventType.REVIEW_REJECTED;

    trackBusinessEvent(eventType, adminId, {
      reviewId: review.id,
      targetId: review.targetId,
    });

    new ReviewResource(req, res, review)
      .json()
      .status(200)
      .additional({
        status: "success",
        message: `Review ${data.status.toLowerCase()}`,
        code: 200,
      });
  };

  /**
   * Get pending reviews for moderation (admin only)
   *
   * GET /api/reviews/moderation-queue
   */
  moderationQueue = async (req: Request, res: Response) => {
    const isAdmin = req.user?.role === "ADMIN";

    RequestError.assertFound(isAdmin, "Admin access required", 403);

    const { take, skip, meta } = this.pagination(req);

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        take,
        skip,
        where: { status: ReviewStatus.PENDING },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          artisan: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          response: true,
          reports: {
            where: { status: ReportStatus.PENDING },
          },
        },
      }),
      prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    ]);


    new ReviewCollection(req, res, {
      data,
      pagination: meta(total, data.length),
    })
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
      });
  };

  /**
   * Add a response to a review (target curator only)
   * Only approved reviews can be responded to
   *
   * POST /api/reviews/:id/respond
   */
  respond = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const userId = req.user?.id;

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { response: true },
    });

    RequestError.assertFound(review, "Review not found", 404);
    RequestError.abortIf(
      review!.targetId !== userId,
      "Only the reviewed curator can respond",
      403,
    );
    RequestError.abortIf(
      review!.status !== ReviewStatus.APPROVED,
      "Can only respond to approved reviews",
      422,
    );
    RequestError.abortIf(
      !!review!.response,
      "Review already has a response",
      422,
    );

    const data = await this.validateAsync(req, {
      content: "required|string|min:1|max:500",
    });

    const response = await prisma.reviewResponse.create({
      data: {
        reviewId,
        content: data.content,
      },
    });

    const updatedReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        response: true,
      },
    });

    trackBusinessEvent(EventType.REVIEW_RESPONDED, userId, {
      reviewId,
      responseId: response.id,
    });

    new ReviewResource(req, res, updatedReview!)
      .json()
      .status(201)
      .additional({
        status: "success",
        message: "Response added successfully",
        code: 201,
      });
  };

  /**
   * Update a response (target curator only)
   *
   * PUT /api/reviews/:id/respond
   */
  updateResponse = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const userId = req.user?.id;

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { response: true },
    });

    RequestError.assertFound(review, "Review not found", 404);
    RequestError.abortIf(
      review!.targetId !== userId,
      "Only the reviewed curator can update the response",
      403,
    );
    RequestError.assertFound(review!.response, "No response to update", 404);

    const data = await this.validateAsync(req, {
      content: "required|string|min:1|max:500",
    });

    await prisma.reviewResponse.update({
      where: { id: review!.response!.id },
      data: { content: data.content },
    });

    const updatedReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        artisan: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        response: true,
      },
    });

    new ReviewResource(req, res, updatedReview!)
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "Response updated successfully",
        code: 200,
      });
  };

  /**
   * Delete a response (target curator or admin only)
   *
   * DELETE /api/reviews/:id/respond
   */
  deleteResponse = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const userId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { response: true },
    });

    RequestError.assertFound(review, "Review not found", 404);
    RequestError.assertFound(review!.response, "No response to delete", 404);

    const canDelete = isAdmin || review!.targetId === userId;
    RequestError.assertFound(canDelete, "Access denied", 403);

    await prisma.reviewResponse.delete({
      where: { id: review!.response!.id },
    });

    res.status(204).send();
  };

  /**
   * Report a review for abuse
   *
   * POST /api/reviews/:id/report
   */
  report = async (req: Request, res: Response) => {
    const reviewId = String(req.params.id || "-");
    const reporterId = req.user?.id!;

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    RequestError.assertFound(review, "Review not found", 404);

    // Check if user already reported this review
    const existingReport = await prisma.reviewReport.findFirst({
      where: {
        reviewId,
        reporterId,
        status: ReportStatus.PENDING,
      },
    });
    RequestError.abortIf(
      !!existingReport,
      "You have already reported this review",
      422,
    );

    const data = await this.validateAsync(req, {
      reason:
        "required|string|in:SPAM,INAPPROPRIATE,FAKE,HARASSMENT,OFF_TOPIC,OTHER",
      details: "nullable|string|max:500",
    });

    const report = await prisma.reviewReport.create({
      data: {
        reviewId,
        reporterId,
        reason: data.reason,
        details: data.details,
      },
    });

    trackBusinessEvent(EventType.REVIEW_REPORTED, reporterId, {
      reviewId,
      reportId: report.id,
      reason: data.reason,
    });

    res.status(201).json({
      status: "success",
      message: "Report submitted successfully",
      code: 201,
      data: {
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  };

  /**
   * Get pending reports (admin only)
   *
   * GET /api/reviews/reports
   */
  getReports = async (req: Request, res: Response) => {
    const isAdmin = req.user?.role === "ADMIN";

    RequestError.assertFound(isAdmin, "Admin access required", 403);

    const { take, skip, meta } = this.pagination(req);

    const statusFilter = req.query.status
      ? { status: req.query.status as ReportStatus }
      : {};

    const [data, total] = await Promise.all([
      prisma.reviewReport.findMany({
        take,
        skip,
        where: statusFilter,
        orderBy: { createdAt: "asc" },
        include: {
          review: {
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              target: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          reporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.reviewReport.count({ where: statusFilter }),
    ]);

    res.status(200).json({
      status: "success",
      message: "OK",
      code: 200,
      data,
      meta: {
        pagination: meta(total, data.length),
      },
    });
  };

  /**
   * Resolve a report (admin only)
   *
   * PUT /api/reviews/reports/:id
   */
  resolveReport = async (req: Request, res: Response) => {
    const reportId = String(req.params.id || "-");
    const adminId = req.user?.id;
    const isAdmin = req.user?.role === "ADMIN";

    RequestError.assertFound(isAdmin, "Admin access required", 403);

    const existingReport = await prisma.reviewReport.findUnique({
      where: { id: reportId },
    });

    RequestError.assertFound(existingReport, "Report not found", 404);
    RequestError.abortIf(
      existingReport!.status !== ReportStatus.PENDING,
      "Report already resolved",
      422,
    );

    const data = await this.validateAsync(req, {
      status: "required|string|in:DISMISSED,ACTION_TAKEN",
      resolution: "nullable|string|max:500",
    });

    const report = await prisma.reviewReport.update({
      where: { id: reportId },
      data: {
        status: data.status as ReportStatus,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution: data.resolution,
      },
      include: {
        review: true,
      },
    });

    // If action taken, reject the review
    if (data.status === "ACTION_TAKEN") {
      await prisma.review.update({
        where: { id: report.reviewId },
        data: {
          status: ReviewStatus.REJECTED,
          moderatedBy: adminId,
          moderatedAt: new Date(),
        },
      });
    }

    res.status(200).json({
      status: "success",
      message: `Report ${data.status === "DISMISSED" ? "dismissed" : "actioned"}`,
      code: 200,
      data: report,
    });
  };

  /**
   * Get rating aggregation for a curator
   * Calculates average rating and distribution
   *
   * GET /api/reviews/aggregation/:targetId
   */
  aggregation = async (req: Request, res: Response) => {
    const targetId = String(req.params.targetId || "-");

    // Verify target exists
    const target = await prisma.user.findUnique({
      where: { id: targetId },
    });
    RequestError.assertFound(target, "User not found", 404);

    // Get all approved reviews for this target
    const reviews = await prisma.review.findMany({
      where: {
        targetId,
        status: ReviewStatus.APPROVED,
      },
      select: {
        rating: true,
      },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribution[r.rating as keyof typeof distribution]++;
    });

    res.status(200).json({
      status: "success",
      message: "OK",
      code: 200,
      data: {
        targetId,
        totalReviews,
        averageRating: Math.round(averageRating * 100) / 100,
        ratingDistribution: distribution,
      },
    });
  };

  /**
   * Get reviews for a specific artisan
   *
   * GET /api/artisans/:id/reviews
   */
  artisanReviews = async (req: Request, res: Response) => {
    const artisanId = String(req.params.id || "-");

    const artisan = await prisma.artisan.findUnique({
      where: { id: artisanId },
    });
    RequestError.assertFound(artisan, "Artisan not found", 404);

    const { take, skip, meta } = this.pagination(req);

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        take,
        skip,
        where: {
          artisanId,
          status: ReviewStatus.APPROVED,
        },
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          response: true,
        },
      }),
      prisma.review.count({
        where: {
          artisanId,
          status: ReviewStatus.APPROVED,
        },
      }),
    ]);

    // Calculate artisan-specific aggregation
    const allReviews = await prisma.review.findMany({
      where: {
        artisanId,
        status: ReviewStatus.APPROVED,
      },
      select: { rating: true },
    });

    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;


    new ReviewCollection(req, res, {
      data,
      pagination: meta(total, data.length),
    })
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
        meta: {
          averageRating: Math.round(avgRating * 100) / 100,
          totalReviews: total,
        },
      });
  };

  /**
   * Get reviews for a specific curator
   *
   * GET /api/curators/:id/reviews
   */
  curatorReviews = async (req: Request, res: Response) => {
    const curatorId = String(req.params.id || "-");

    const curator = await prisma.user.findUnique({
      where: { id: curatorId },
      include: { curator: true },
    });
    RequestError.assertFound(curator, "Curator not found", 404);
    RequestError.abortIf(
      curator!.role !== "CURATOR",
      "User is not a curator",
      422,
    );

    const { take, skip, meta } = this.pagination(req);

    const [data, total] = await Promise.all([
      prisma.review.findMany({
        take,
        skip,
        where: {
          targetId: curatorId,
          status: ReviewStatus.APPROVED,
        },
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          artisan: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          response: true,
        },
      }),
      prisma.review.count({
        where: {
          targetId: curatorId,
          status: ReviewStatus.APPROVED,
        },
      }),
    ]);

    // Calculate curator-specific aggregation
    const allReviews = await prisma.review.findMany({
      where: {
        targetId: curatorId,
        status: ReviewStatus.APPROVED,
      },
      select: { rating: true },
    });

    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;


    new ReviewCollection(req, res, {
      data,
      pagination: meta(total, data.length),
    })
      .json()
      .status(200)
      .additional({
        status: "success",
        message: "OK",
        code: 200,
        meta: {
          averageRating: Math.round(avgRating * 100) / 100,
          totalReviews: total,
        },
      });
  };
}
