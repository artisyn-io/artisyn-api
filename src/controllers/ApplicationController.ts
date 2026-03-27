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
 * Handles listing applications management.
 * - Users can apply to listings, view, and withdraw their applications
 * - Listing owners can view, accept, or reject applications
 */
export default class ApplicationController extends BaseController {
  /**
   * POST /api/applications
   * Authenticated user applies to a listing
   */
  create = async (req: Request, res: Response) => {
    const applicantId = req.user?.id;
    if (!applicantId) throw new RequestError("Unauthenticated", 401);

    const { listingId, message } = req.body as { listingId: string; message?: string };

    const listing = await prisma.artisan.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        curatorId: true,
        isActive: true,
        archivedAt: true,
        name: true,
        description: true
      }
    });

    if (!listing) throw new RequestError("Listing not found", 404);
    if (!listing.isActive || listing.archivedAt) {
      throw new RequestError("Listing is not accepting applications", 400);
    }
    if (listing.curatorId === applicantId) {
      throw new RequestError("You cannot apply to your own listing", 403);
    }

    const existing = await prisma.application.findFirst({
      where: {
        listingId,
        applicantId,
        status: {
          in: [ApplicationStatus.PENDING, ApplicationStatus.ACCEPTED]
        }
      }
    });

    if (existing) {
      throw new RequestError("You already have an active application for this listing", 409);
    }

    const application = await prisma.application.create({
      data: {
        listingId,
        applicantId,
        message: message?.trim() || undefined,
        status: ApplicationStatus.PENDING
      },
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

    new ApplicationResource(req, res, application)
      .json()
      .additional({ status: "success", message: "Application submitted successfully", code: 201 })
      .status(201);
  };

  /**
   * DELETE /api/applications/:id
   * Applicant withdraws/deletes their own pending application
   */
  delete = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new RequestError("Unauthenticated", 401);

    const application = await prisma.application.findUnique({
      where: { id: String(req.params.id) }
    });

    if (!application) throw new RequestError("Application not found", 404);
    if (application.applicantId !== userId) throw new RequestError("Unauthorized", 403);
    if (application.status !== "PENDING") {
      throw new RequestError("Only pending applications can be deleted", 400);
    }

    await prisma.application.delete({ where: { id: application.id } });

    new ApplicationResource(req, res, {})
      .json()
      .additional({ status: "success", message: "Application deleted successfully", code: 202 })
      .status(202);
  };

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

    const listing = await prisma.artisan.findUnique({
      where: { id: listingId },
      select: { id: true, curatorId: true }
    });

    if (!listing) {
      throw new RequestError("Listing not found", 404);
    }

    if (listing.curatorId !== userId) {
      throw new RequestError("Unauthorized access to this listing", 403);
    }

    const { take, skip, meta } = this.pagination(req);
    const where: any = { listingId };

    if (req.query.status) {
      where.status = String(req.query.status).toUpperCase() as ApplicationStatus;
    }

    const [data, count] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
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
          },
          job: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              updatedAt: true
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
        status: "success",
        message: "Applications retrieved successfully",
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
        },
        job: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!application) {
      throw new RequestError("Application not found", 404);
    }

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

    const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"];
    if (!validStatuses.includes(status)) {
      throw new RequestError(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        400
      );
    }

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

    const isOwner = application.listing.curatorId === userId;
    const isApplicant = application.applicantId === userId;

    if (status === "WITHDRAWN" && !isApplicant) {
      throw new RequestError("Only the applicant can withdraw their application", 403);
    }

    if ((status === "ACCEPTED" || status === "REJECTED") && !isOwner) {
      throw new RequestError(
        "Only the listing owner can accept or reject applications",
        403
      );
    }

    this.validateStateTransition(application.status, status as ApplicationStatus);

    const finalApplication = await prisma.$transaction(async (tx) => {
      const updatedApp = await tx.application.update({
        where: { id: applicationId },
        data: { status: status as ApplicationStatus },
        include: {
          listing: {
            select: {
              id: true,
              curatorId: true,
              name: true,
              description: true
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

      if (status === "ACCEPTED") {
        const existingJob = await tx.job.findUnique({
          where: { applicationId }
        });

        if (!existingJob) {
          await tx.job.create({
            data: {
              listingId: updatedApp.listingId,
              applicationId: updatedApp.id,
              applicantId: updatedApp.applicantId
            }
          });
        }
      }

      return tx.application.findUnique({
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
          },
          job: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
    });

    RequestError.assertFound(finalApplication, "Application not found after update", 404);

    new ApplicationResource(req, res, finalApplication)
      .json()
      .additional({
        status: "success",
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
      PENDING: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
      ACCEPTED: [],
      REJECTED: [],
      WITHDRAWN: []
    };

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new RequestError(`Cannot transition from ${currentStatus} to ${newStatus}`, 400);
    }
  }
}
