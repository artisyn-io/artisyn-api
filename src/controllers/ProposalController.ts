import { Request, Response } from "express";

import { JobRequestStatus, Prisma, ProposalStatus } from "@prisma/client";

import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import { prisma } from "../db";

const proposalInclude = {
  artisan: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  engagement: { select: { id: true, status: true } },
} satisfies Prisma.ProposalInclude;

/**
 * ProposalController
 *
 * Artisan proposals against client job requests.
 * - Artisans create/withdraw their own proposals (one per request)
 * - Only the request owner can accept or reject proposals
 * - Accepting a proposal atomically awards the request, rejects competing
 *   pending proposals and creates exactly one Engagement
 */
export default class ProposalController extends BaseController {
  /**
   * POST /api/job-requests/:id/proposals
   */
  create = async (req: Request, res: Response) => {
    const artisanId = req.user!.id;
    const jobRequest = await prisma.jobRequest.findUnique({ where: { id: String(req.params.id) } });

    if (!jobRequest || jobRequest.status === JobRequestStatus.DRAFT) {
      throw new RequestError("Job request not found", 404);
    }
    RequestError.abortIf(jobRequest.clientId === artisanId, "You cannot submit a proposal to your own job request", 403);
    RequestError.abortIf(jobRequest.status !== JobRequestStatus.OPEN, "This job request is not accepting proposals", 409);

    try {
      const proposal = await prisma.proposal.create({
        data: {
          jobRequestId: jobRequest.id,
          artisanId,
          message: req.body.message,
          proposedAmount: req.body.proposedAmount ?? null,
          estimatedDuration: req.body.estimatedDuration ?? null,
        },
        include: proposalInclude,
      });

      res.status(201).json({ data: proposal, status: "success", message: "Proposal submitted successfully", code: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new RequestError("You have already submitted a proposal for this job request", 409);
      }
      throw error;
    }
  };

  /**
   * GET /api/job-requests/:id/proposals
   * The owner sees all proposals; artisans only see their own.
   */
  index = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const jobRequest = await prisma.jobRequest.findUnique({ where: { id: String(req.params.id) } });
    RequestError.assertFound(jobRequest, "Job request not found", 404);

    const { take, skip, meta } = this.pagination(req);
    const where: Prisma.ProposalWhereInput = { jobRequestId: jobRequest!.id };
    if (jobRequest!.clientId !== userId) where.artisanId = userId;

    const [data, count] = await prisma.$transaction([
      prisma.proposal.findMany({ where, take, skip, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: proposalInclude }),
      prisma.proposal.count({ where }),
    ]);

    res.status(200).json({
      data,
      meta: { pagination: meta(count, data.length) },
      status: "success",
      message: "Proposals retrieved successfully",
      code: 200,
    });
  };

  /**
   * POST /api/job-requests/:id/proposals/:proposalId/withdraw
   */
  withdraw = async (req: Request, res: Response) => {
    const proposal = await this.findProposal(req);
    RequestError.abortIf(proposal.artisanId !== req.user!.id, "Only the proposing artisan can withdraw this proposal", 403);

    await this.transition(proposal.id, ProposalStatus.WITHDRAWN);
    await this.respond(res, proposal.id, "Proposal withdrawn");
  };

  /**
   * POST /api/job-requests/:id/proposals/:proposalId/reject
   */
  reject = async (req: Request, res: Response) => {
    const proposal = await this.findProposal(req);
    RequestError.abortIf(proposal.jobRequest.clientId !== req.user!.id, "Only the request owner can reject proposals", 403);

    await this.transition(proposal.id, ProposalStatus.REJECTED);
    await this.respond(res, proposal.id, "Proposal rejected");
  };

  /**
   * POST /api/job-requests/:id/proposals/:proposalId/accept
   */
  accept = async (req: Request, res: Response) => {
    const proposal = await this.findProposal(req);
    const { jobRequest } = proposal;
    RequestError.abortIf(jobRequest.clientId !== req.user!.id, "Only the request owner can accept proposals", 403);

    try {
      await prisma.$transaction(async (tx) => {
        // Conditional updates make concurrent accepts fail instead of double-awarding
        const awarded = await tx.jobRequest.updateMany({
          where: { id: jobRequest.id, status: JobRequestStatus.OPEN },
          data: { status: JobRequestStatus.AWARDED, closedAt: new Date() },
        });
        RequestError.abortIf(awarded.count === 0, "This job request is no longer open", 409);

        const accepted = await tx.proposal.updateMany({
          where: { id: proposal.id, status: ProposalStatus.PENDING },
          data: { status: ProposalStatus.ACCEPTED },
        });
        RequestError.abortIf(accepted.count === 0, "Only pending proposals can be accepted", 409);

        await tx.proposal.updateMany({
          where: { jobRequestId: jobRequest.id, id: { not: proposal.id }, status: ProposalStatus.PENDING },
          data: { status: ProposalStatus.REJECTED },
        });

        await tx.engagement.create({
          data: {
            jobRequestId: jobRequest.id,
            proposalId: proposal.id,
            clientId: jobRequest.clientId,
            artisanId: proposal.artisanId,
            agreedAmount: proposal.proposedAmount,
          },
        });
      });
    } catch (error) {
      // Unique constraint on Engagement.jobRequestId is the final race guard
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new RequestError("This job request has already been awarded", 409);
      }
      throw error;
    }

    await this.respond(res, proposal.id, "Proposal accepted and engagement created");
  };

  private findProposal = async (req: Request) => {
    const proposal = await prisma.proposal.findFirst({
      where: { id: String(req.params.proposalId), jobRequestId: String(req.params.id) },
      include: { jobRequest: true },
    });
    RequestError.assertFound(proposal, "Proposal not found", 404);

    return proposal!;
  };

  private transition = async (id: string, status: ProposalStatus) => {
    const { count } = await prisma.proposal.updateMany({
      where: { id, status: ProposalStatus.PENDING },
      data: { status },
    });
    RequestError.abortIf(count === 0, "Only pending proposals can be updated", 409);
  };

  private respond = async (res: Response, id: string, message: string) => {
    const proposal = await prisma.proposal.findUnique({ where: { id }, include: proposalInclude });
    res.status(200).json({ data: proposal, status: "success", message, code: 200 });
  };
}
