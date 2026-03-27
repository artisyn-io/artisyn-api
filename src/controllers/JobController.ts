import { Request, Response } from "express";
import { JobStatus, Prisma, UserRole } from "@prisma/client";

import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import JobCollection from "../resources/JobCollection";
import JobResource from "../resources/JobResource";
import { prisma } from "../db";
import { JsonResource } from "../resources";

export default class JobController extends BaseController {
  /**
   * GET /api/jobs
   * List all jobs for the authenticated user (or curator/admin scope).
   */
  index = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    const { take, skip, meta } = this.pagination(req);
    const where: Prisma.JobWhereInput = {};

    if (req.query.status) {
      const normalizedStatus = String(req.query.status).toUpperCase();
      RequestError.assertFound(
        Object.values(JobStatus).includes(normalizedStatus as JobStatus),
        "Invalid job status filter",
        400
      );
      where.status = normalizedStatus as JobStatus;
    }

    if (role === UserRole.CURATOR) {
      where.listing = { curatorId: userId };
    } else if (role !== UserRole.ADMIN) {
      where.applicantId = userId;
    }

    const [data, total] = await prisma.$transaction([
      prisma.job.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            select: {
              id: true,
              name: true,
              curatorId: true,
            },
          },
          applicant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              phone: true,
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    new JobCollection(req, res, {
      data,
      pagination: meta(total, data.length),
    })
      .json()
      .additional({
        status: "success",
        message: "Jobs retrieved successfully",
        code: 200,
      })
      .status(200);
  };

  /**
   * GET /api/jobs/:id
   * Retrieve a single job (participants or admin only).
   */
  show = async (req: Request, res: Response) => {
    const jobId = String(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            curatorId: true,
          },
        },
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            phone: true,
          },
        },
      },
    });

    if (!job) {
      throw new RequestError("Job not found", 404);
    }

    const isAdmin = req.user?.role === UserRole.ADMIN;
    const isParticipant = job.applicantId === userId || job.listing.curatorId === userId;

    if (!isAdmin && !isParticipant) {
      throw new RequestError("Unauthorized access to this job", 403);
    }

    new JobResource(req, res, job)
      .json()
      .additional({
        status: "success",
        message: "Job retrieved successfully",
        code: 200,
      })
      .status(200);
  };

  /**
   * PUT /api/jobs/:id
   * Update job status (participants only).
   */
  update = async (req: Request, res: Response) => {
    const jobId = String(req.params.id);
    const userId = req.user?.id;
    const normalizedStatus = String(req.body.status).toUpperCase() as JobStatus;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        listing: {
          select: {
            curatorId: true,
          },
        },
      },
    });

    if (!existingJob) {
      throw new RequestError("Job not found", 404);
    }

    const isParticipant = existingJob.applicantId === userId || existingJob.listing.curatorId === userId;
    if (!isParticipant) {
      throw new RequestError("Unauthorized access to this job", 403);
    }

    this.validateStateTransition(existingJob.status, normalizedStatus);

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: normalizedStatus },
      include: {
        listing: {
          select: {
            id: true,
            name: true,
            curatorId: true,
          },
        },
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            phone: true,
          },
        },
      },
    });

    new JobResource(req, res, updatedJob)
      .json()
      .additional({
        status: "success",
        message: `Job status updated to ${normalizedStatus}`,
        code: 200,
      })
      .status(200);
  };

  /**
   * DELETE /api/jobs/:id
   * Remove a job (admin only).
   */
  destroy = async (req: Request, res: Response) => {
    const jobId = String(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      throw new RequestError("Unauthenticated", 401);
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new RequestError("Job not found", 404);
    }

    const isAdmin = req.user?.role === UserRole.ADMIN;
    if (!isAdmin) {
      throw new RequestError("Admin access required", 403);
    }

    await prisma.job.delete({ where: { id: jobId } });

    new JsonResource(req, res, {})
      .json()
      .additional({
        status: "success",
        message: "Job deleted successfully",
        code: 202,
      })
      .status(202);
  };

  /**
   * Validate allowed state transitions for jobs.
   */
  private validateStateTransition(current: JobStatus, next: JobStatus) {
    const allowedTransitions: Record<JobStatus, JobStatus[]> = {
      ACTIVE: ["IN_PROGRESS", "CANCELLED", "DISPUTED"],
      IN_PROGRESS: ["COMPLETED", "CANCELLED", "DISPUTED"],
      COMPLETED: [],
      CANCELLED: [],
      DISPUTED: ["IN_PROGRESS", "CANCELLED"],
    };

    if (!allowedTransitions[current].includes(next)) {
      throw new RequestError(`Cannot transition from ${current} to ${next}`, 400);
    }
  }
}
