import crypto from "crypto";
import { Request, Response } from "express";

import { Prisma, SupportTicketStatus } from "@prisma/client";

import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import SupportTicketResource, { transformSupportTicket } from "../resources/SupportTicketResource";
import { logAuditEvent } from "../utils/auditLogger";
import { notifySupportTicket } from "../services/notificationService";
import { prisma } from "../db";

const personSelect = { select: { id: true, firstName: true, lastName: true } };

const detailInclude = {
  requester: personSelect,
  messages: { orderBy: { createdAt: "asc" as const }, include: { author: personSelect } },
} satisfies Prisma.SupportTicketInclude;

/**
 * Human-readable, stable ticket reference, e.g. SUP-260930-4F7K2Q
 */
const generateReference = () => {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `SUP-${date}-${crypto.randomBytes(4).readUInt32BE().toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
};

/**
 * SupportTicketController
 *
 * Public contact submissions and authenticated support tickets.
 * Only the requester and admins (support staff) can read a ticket.
 */
export default class SupportTicketController extends BaseController {
  /**
   * POST /api/contact
   * Anonymous contact form submission (rate-limited, honeypot-protected).
   */
  contact = async (req: Request, res: Response) => {
    const { name, email, subject, message, category } = req.body;

    const ticket = await this.createTicket({
      name, email, subject, category, source: "contact",
      messages: { create: { body: message } },
    });

    res.status(201).json({
      data: { reference: ticket.reference, status: ticket.status, createdAt: ticket.createdAt },
      status: "success",
      message: "Your message has been received.",
      code: 201,
    });
  };

  /**
   * POST /api/support/tickets
   */
  create = async (req: Request, res: Response) => {
    const user = req.user!;
    const { subject, message, category, jobId, listingId } = req.body;

    await this.assertReferencesBelongTo(user.id, jobId, listingId);

    const ticket = await this.createTicket({
      requester: { connect: { id: user.id } },
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      subject,
      category,
      jobId,
      listingId,
      source: "app",
      messages: { create: { body: message, author: { connect: { id: user.id } } } },
    });

    new SupportTicketResource(req, res, ticket)
      .json()
      .status(201)
      .additional({ status: "success", message: "Support ticket created successfully", code: 201 });
  };

  /**
   * GET /api/support/tickets
   * Users see their own tickets; admins see all tickets.
   */
  index = async (req: Request, res: Response) => {
    const user = req.user!;
    const { take, skip, meta } = this.pagination(req);
    const where: Prisma.SupportTicketWhereInput = user.role === "ADMIN" ? {} : { requesterId: user.id };

    if (req.query.status) where.status = req.query.status as SupportTicketStatus;

    const [data, count] = await prisma.$transaction([
      prisma.supportTicket.findMany({
        where, take, skip,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { requester: personSelect },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    res.status(200).json({
      data: data.map(transformSupportTicket),
      meta: { pagination: meta(count, data.length) },
      status: "success",
      message: "Support tickets retrieved successfully",
      code: 200,
    });
  };

  /**
   * GET /api/support/tickets/:id
   */
  show = async (req: Request, res: Response) => {
    const ticket = await this.findAccessible(req);

    new SupportTicketResource(req, res, ticket)
      .json()
      .status(200)
      .additional({ status: "success", message: "Support ticket retrieved successfully", code: 200 });
  };

  /**
   * POST /api/support/tickets/:id/messages
   */
  reply = async (req: Request, res: Response) => {
    const user = req.user!;
    const ticket = await this.findAccessible(req);
    const isStaff = user.role === "ADMIN";

    RequestError.abortIf(ticket.status === SupportTicketStatus.CLOSED, "This ticket is closed", 409);

    await prisma.$transaction([
      prisma.supportTicketMessage.create({
        data: { ticketId: ticket.id, authorId: user.id, body: req.body.message, isStaff },
      }),
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: isStaff
            ? SupportTicketStatus.AWAITING_USER
            : ticket.status === SupportTicketStatus.OPEN ? SupportTicketStatus.OPEN : SupportTicketStatus.IN_PROGRESS,
        },
      }),
    ]);

    const updated = await prisma.supportTicket.findUnique({ where: { id: ticket.id }, include: detailInclude });

    new SupportTicketResource(req, res, updated!)
      .json()
      .status(201)
      .additional({ status: "success", message: "Reply added successfully", code: 201 });
  };

  /**
   * PATCH /api/support/tickets/:id
   * Admin triage of status and priority (audited).
   */
  triage = async (req: Request, res: Response) => {
    const user = req.user!;
    RequestError.abortIf(user.role !== "ADMIN", "Only support staff can triage tickets", 403);

    const ticket = await prisma.supportTicket.findUnique({ where: { id: String(req.params.id) } });
    RequestError.assertFound(ticket, "Support ticket not found", 404);

    const { status, priority } = req.body;
    const updated = await prisma.supportTicket.update({
      where: { id: ticket!.id },
      data: { status, priority },
      include: detailInclude,
    });

    await logAuditEvent(user.id, "SUPPORT_TICKET_UPDATE", {
      req,
      entityType: "SupportTicket",
      entityId: ticket!.id,
      oldValues: { status: ticket!.status, priority: ticket!.priority },
      newValues: { status: updated.status, priority: updated.priority },
      statusCode: 200,
    });

    new SupportTicketResource(req, res, updated)
      .json()
      .status(200)
      .additional({ status: "success", message: "Support ticket updated successfully", code: 200 });
  };

  private createTicket = async (data: Omit<Prisma.SupportTicketCreateInput, "reference">) => {
    const ticket = await prisma.supportTicket.create({
      data: { ...data, reference: generateReference() },
      include: detailInclude,
    });

    notifySupportTicket(ticket).catch(() => undefined);

    return ticket;
  };

  private findAccessible = async (req: Request) => {
    const user = req.user!;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: String(req.params.id) },
      include: detailInclude,
    });

    // Respond with 404 (not 403) so ticket existence is not leaked
    if (!ticket || (ticket.requesterId !== user.id && user.role !== "ADMIN")) {
      throw new RequestError("Support ticket not found", 404);
    }

    return ticket;
  };

  private assertReferencesBelongTo = async (userId: string, jobId?: string, listingId?: string) => {
    if (jobId) {
      const job = await prisma.job.findFirst({
        where: { id: jobId, OR: [{ applicantId: userId }, { listing: { curatorId: userId } }] },
        select: { id: true },
      });
      RequestError.abortIf(!job, "Referenced job not found", 422);
    }

    if (listingId) {
      const listing = await prisma.artisan.findFirst({
        where: { id: listingId, OR: [{ curatorId: userId }, { applications: { some: { applicantId: userId } } }] },
        select: { id: true },
      });
      RequestError.abortIf(!listing, "Referenced listing not found", 422);
    }
  };
}
