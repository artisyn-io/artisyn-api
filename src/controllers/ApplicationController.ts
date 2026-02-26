import { Request, Response } from "express";
import { ApplicationStatus } from "@prisma/client";

import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import ApplicationCollection from "../resources/ApplicationCollection";
import ApplicationResource from "../resources/ApplicationResource";
import { prisma } from "../db";

/**
 * ApplicationController
 *
 * Handles listing applications management for Artisan owners.
 * Enables owners to:
 * - View all applications for their listings
 * - Accept/reject applications
 * - Track application status
 */
export default class ApplicationController extends BaseController {
  /**
   * GET /api/listings/:listingId/applications
   * List all applications for a specific listing (owner only)
   */
  index = async (req: Request, res: Response) => {
    const listingId = String(req.params.listingId);
    const userId = req.user?.id;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    // Fetch listing to verify ownership
    const listing = await prisma.artisan.findUnique({
      where: { id: listingId },
      select: { id: true, curatorId: true }
    });

    if (!listing) {
      throw new RequestError("Listing not found", 404);
    }

    // Check ownership - only the listing owner can view applications
    if (listing.curatorId !== userId) {
      throw new RequestError("Unauthorized access to this listing", 403);
    }

    const { take, skip, meta } = this.pagination(req);

    // Fetch applications with filtering
    const where: any = { listingId };

    // Optional status filter
    if (req.query.status) {
      where.status = String(req.query.status).toUpperCase() as ApplicationStatus;
    }

    const [data, count] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          applicant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              phone: true
            }
          }
        }
      }),
      prisma.application.count({ where })
    ]);

    new ApplicationCollection(req, res, {
      data,
      pagination: meta(count, data.length)
    })
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'Applications retrieved successfully',
        code: 200
      });
  };

  /**
   * GET /api/applications/:id
   * Get a specific application (owner or applicant only)
   */
  show = async (req: Request, res: Response) => {
    const applicationId = String(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            description: true,
            curatorId: true
          }
        },
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            phone: true
          }
        }
      }
    });

    if (!application) {
      throw new RequestError("Application not found", 404);
    }

    // Check authorization - only listing owner or applicant can view
    const isOwner = application.listing.curatorId === userId;
    const isApplicant = application.applicantId === userId;

    if (!isOwner && !isApplicant) {
      throw new RequestError("Unauthorized access to this application", 403);
    }

    new ApplicationResource(req, res, application)
      .json()
      .status(200);
  };

  /**
   * PUT /api/applications/:id/status
   * Update application status (owner only)
   * Allowed transitions:
   * - PENDING -> ACCEPTED
   * - PENDING -> REJECTED
   * - Any status -> WITHDRAWN (applicant only)
   */
  updateStatus = async (req: Request, res: Response) => {
    const applicationId = String(req.params.id);
    const userId = req.user?.id;
    const { status } = req.body;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    // Validate status value
    const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'];
    if (!validStatuses.includes(status)) {
      throw new RequestError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400
      );
    }

    // Fetch application with relationships
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        listing: {
          select: {
            id: true,
            curatorId: true
          }
        }
      }
    });

    if (!application) {
      throw new RequestError("Application not found", 404);
    }

    // Authorization checks
    const isOwner = application.listing.curatorId === userId;
    const isApplicant = application.applicantId === userId;

    // Only applicant can withdraw
    if (status === 'WITHDRAWN' && !isApplicant) {
      throw new RequestError(
        "Only the applicant can withdraw their application",
        403
      );
    }

    // Only owner can accept/reject
    if ((status === 'ACCEPTED' || status === 'REJECTED') && !isOwner) {
      throw new RequestError(
        "Only the listing owner can accept or reject applications",
        403
      );
    }

    // Validate state transitions
    this.validateStateTransition(application.status, status as ApplicationStatus);

    // Update application status
    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { status: status as ApplicationStatus },
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            description: true,
            curatorId: true
          }
        },
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            phone: true
          }
        }
      }
    });

    new ApplicationResource(req, res, updated)
      .json()
      .additional({
        status: 'success',
        message: `Application status updated to ${status}`,
        code: 200
      })
      .status(200);
  };

  /**
   * Validate state transitions
   * Rules:
   * - PENDING can go to ACCEPTED, REJECTED, or WITHDRAWN
   * - ACCEPTED cannot change
   * - REJECTED cannot change
   * - WITHDRAWN cannot change
   */
  private validateStateTransition(
    currentStatus: ApplicationStatus,
    newStatus: ApplicationStatus
  ): void {
    const allowedTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      PENDING: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
      ACCEPTED: [],
      REJECTED: [],
      WITHDRAWN: []
    };

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new RequestError(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        400
      );
    }
  }
}
