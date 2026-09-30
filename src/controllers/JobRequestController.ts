import { Request, Response } from "express";

import { JobRequestStatus, Prisma } from "@prisma/client";

import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import JobRequestCollection from "../resources/JobRequestCollection";
import JobRequestResource from "../resources/JobRequestResource";
import { prisma } from "../db";

/**
 * Allowed client-driven job request status transitions.
 * AWARDED is set only when a proposal is accepted and is final.
 */
const ALLOWED_TRANSITIONS: Record<JobRequestStatus, JobRequestStatus[]> = {
  DRAFT: ["OPEN", "CLOSED"],
  OPEN: ["CLOSED"],
  CLOSED: ["OPEN"],
  AWARDED: [],
};

const detailInclude = (userId: string) => ({
  category: { select: { id: true, name: true, icon: true } },
  client: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  engagement: { select: { id: true } },
  proposals: { where: { artisanId: userId }, select: { id: true, status: true } },
  _count: { select: { proposals: true } },
});

/**
 * JobRequestController
 *
 * Client-created job requests (open opportunities) that artisans discover
 * and submit proposals to. Accepted proposals become Engagements.
 */
export default class JobRequestController extends BaseController {
  /**
   * GET /api/job-requests
   * Authenticated discovery feed. Non-owners only see OPEN requests;
   * pass `mine=true` to list the caller's own requests in any status.
   */
  index = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const mine = String(req.query.mine) === "true";
    const { take, skip, meta } = this.pagination(req);

    const where: Prisma.JobRequestWhereInput = mine
      ? { clientId: userId }
      : { status: JobRequestStatus.OPEN, clientId: { not: userId } };

    if (mine && req.query.status) where.status = req.query.status as JobRequestStatus;
    if (req.query.categoryId) where.categoryId = String(req.query.categoryId);
    if (req.query.urgency) where.urgency = req.query.urgency as any;
    if (req.query.location) where.location = { contains: String(req.query.location), mode: "insensitive" };
    // Budget filters match requests whose budget range overlaps the requested range
    if (req.query.minBudget) where.budgetMax = { gte: Number(req.query.minBudget) };
    if (req.query.maxBudget) where.budgetMin = { lte: Number(req.query.maxBudget) };

    const sort = String(req.query.sort ?? "newest");
    const orderBy: Prisma.JobRequestOrderByWithRelationInput[] = {
      newest: [{ createdAt: "desc" as const }],
      oldest: [{ createdAt: "asc" as const }],
      budget_high: [{ budgetMax: { sort: "desc" as const, nulls: "last" as const } }],
      budget_low: [{ budgetMin: { sort: "asc" as const, nulls: "last" as const } }],
    }[sort] ?? [{ createdAt: "desc" }];

    const [data, count] = await prisma.$transaction([
      prisma.jobRequest.findMany({
        where,
        take,
        skip,
        orderBy: [...orderBy, { id: "desc" }],
        include: detailInclude(userId),
      }),
      prisma.jobRequest.count({ where }),
    ]);

    new JobRequestCollection(req, res, { data, pagination: meta(count, data.length) })
      .json()
      .status(200)
      .additional({ status: "success", message: "Job requests retrieved successfully", code: 200 });
  };

  /**
   * POST /api/job-requests
   */
  create = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { title, description, categoryId, budgetMin, budgetMax, currency, location, urgency, status } = req.body;

    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      RequestError.assertFound(category, "Category not found", 404);
    }

    const finalStatus: JobRequestStatus = status ?? JobRequestStatus.DRAFT;
    RequestError.abortIf(finalStatus === JobRequestStatus.CLOSED, "A new job request must be DRAFT or OPEN", 422);

    const jobRequest = await prisma.jobRequest.create({
      data: {
        clientId: userId,
        title,
        description,
        categoryId: categoryId ?? null,
        budgetMin: budgetMin ?? null,
        budgetMax: budgetMax ?? null,
        currency: currency?.toUpperCase(),
        location: location ?? null,
        urgency,
        status: finalStatus,
        publishedAt: finalStatus === JobRequestStatus.OPEN ? new Date() : null,
      },
      include: detailInclude(userId),
    });

    new JobRequestResource(req, res, jobRequest)
      .json()
      .status(201)
      .additional({ status: "success", message: "Job request created successfully", code: 201 });
  };

  /**
   * GET /api/job-requests/:id
   * Owners can view any of their requests; others cannot view drafts.
   */
  show = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const jobRequest = await prisma.jobRequest.findUnique({
      where: { id: String(req.params.id) },
      include: detailInclude(userId),
    });

    if (!jobRequest || (jobRequest.status === JobRequestStatus.DRAFT && jobRequest.clientId !== userId)) {
      throw new RequestError("Job request not found", 404);
    }

    new JobRequestResource(req, res, jobRequest)
      .json()
      .status(200)
      .additional({ status: "success", message: "Job request retrieved successfully", code: 200 });
  };

  /**
   * PUT /api/job-requests/:id
   * Owner updates fields and/or transitions status (DRAFT/OPEN/CLOSED).
   */
  update = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const existing = await this.findOwned(String(req.params.id), userId);

    RequestError.abortIf(existing.status === JobRequestStatus.AWARDED, "Awarded job requests cannot be modified", 409);

    const { title, description, categoryId, budgetMin, budgetMax, currency, location, urgency, status } = req.body;
    const data: Prisma.JobRequestUncheckedUpdateInput = {
      title, description, categoryId, budgetMin, budgetMax, location, urgency,
      currency: currency?.toUpperCase(),
    };

    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      RequestError.assertFound(category, "Category not found", 404);
    }

    if (status && status !== existing.status) {
      if (!ALLOWED_TRANSITIONS[existing.status].includes(status)) {
        throw new RequestError(`Cannot transition from ${existing.status} to ${status}`, 409);
      }
      data.status = status;
      if (status === JobRequestStatus.OPEN) data.publishedAt = existing.publishedAt ?? new Date();
      data.closedAt = status === JobRequestStatus.CLOSED ? new Date() : null;
    }

    // Guard against a concurrent award between the read and the write
    const { count } = await prisma.jobRequest.updateMany({
      where: { id: existing.id, status: existing.status },
      data: data as Prisma.JobRequestUncheckedUpdateManyInput,
    });
    RequestError.abortIf(count === 0, "Job request was modified concurrently, please retry", 409);

    const jobRequest = await prisma.jobRequest.findUnique({ where: { id: existing.id }, include: detailInclude(userId) });

    new JobRequestResource(req, res, jobRequest!)
      .json()
      .status(200)
      .additional({ status: "success", message: "Job request updated successfully", code: 200 });
  };

  /**
   * DELETE /api/job-requests/:id
   * Owner deletes a request that has not been awarded.
   */
  destroy = async (req: Request, res: Response) => {
    const existing = await this.findOwned(String(req.params.id), req.user!.id);

    const { count } = await prisma.jobRequest.deleteMany({
      where: { id: existing.id, status: { not: JobRequestStatus.AWARDED } },
    });
    RequestError.abortIf(count === 0, "Awarded job requests cannot be deleted", 409);

    res.status(202).json({ data: {}, status: "success", message: "Job request deleted successfully", code: 202 });
  };

  /**
   * GET /api/job-requests/engagements
   * Active/completed engagements where the caller is the client or artisan.
   */
  engagements = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { take, skip, meta } = this.pagination(req);
    const where: Prisma.EngagementWhereInput = { OR: [{ clientId: userId }, { artisanId: userId }] };

    if (req.query.status) where.status = String(req.query.status).toUpperCase() as any;

    const [data, count] = await prisma.$transaction([
      prisma.engagement.findMany({
        where,
        take,
        skip,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          jobRequest: { select: { id: true, title: true, description: true, location: true, categoryId: true } },
          client: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          artisan: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      prisma.engagement.count({ where }),
    ]);

    res.status(200).json({
      data: data.map((e) => ({ ...e, type: "engagement", role: e.clientId === userId ? "client" : "artisan" })),
      meta: { pagination: meta(count, data.length) },
      status: "success",
      message: "Engagements retrieved successfully",
      code: 200,
    });
  };

  private findOwned = async (id: string, userId: string) => {
    const jobRequest = await prisma.jobRequest.findUnique({ where: { id } });

    RequestError.assertFound(jobRequest, "Job request not found", 404);
    RequestError.abortIf(jobRequest!.clientId !== userId, "Only the request owner can perform this action", 403);

    return jobRequest!;
  };
}
