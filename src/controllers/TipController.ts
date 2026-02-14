import { EventType, Prisma, TipStatus } from "@prisma/client";
import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { RequestError } from "src/utils/errors";
import TipCollection from "src/resources/TipCollection";
import TipResource from "src/resources/TipResource";
import { prisma } from "src/db";
import { trackBusinessEvent } from "src/utils/analyticsMiddleware";

/**
 * TipController
 *
 * Handles peer-to-peer tip operations with strict access rules:
 * - Users can only see their own sent/received tips
 * - Admins can see all tips
 * - Sender or recipient can view specific tip details
 */
export default class extends BaseController {
    /**
     * List all tips for the authenticated user (sent and received)
     * Admin users can see all tips in the system
     *
     * GET /api/tips
     *
     * @param req
     * @param res
     */
    index = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const isAdmin = req.user?.role === "ADMIN";

        const { take, skip, meta } = this.pagination(req);

        // Build filter conditions
        const statusFilter = req.query.status
            ? { status: req.query.status as TipStatus }
            : {};

        // Filter by type: sent, received, or all
        const typeFilter = req.query.type as string;

        let whereCondition: Prisma.TipWhereInput = {};

        if (isAdmin) {
            // Admins can see all tips
            whereCondition = { ...statusFilter };
        } else {
            // Regular users can only see their own tips
            if (typeFilter === "sent") {
                whereCondition = { senderId: userId, ...statusFilter };
            } else if (typeFilter === "received") {
                whereCondition = { receiverId: userId, ...statusFilter };
            } else {
                // Default: show both sent and received tips
                whereCondition = {
                    OR: [{ senderId: userId }, { receiverId: userId }],
                    ...statusFilter,
                };
            }
        }

        const orderBy = {
            id: "id",
            amount: "amount",
            createdAt: "createdAt",
        }[String(req.query.orderBy ?? "createdAt")] ?? "createdAt";

        const [data, total] = await Promise.all([
            prisma.tip.findMany({
                take,
                skip,
                where: whereCondition,
                orderBy: {
                    [orderBy]: req.query.orderDir === "asc" ? "asc" : "desc",
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true,
                        },
                    },
                    receiver: {
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
                },
            }),
            prisma.tip.count({ where: whereCondition }),
        ]);


        new TipCollection(req, res, {
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
     * Get a specific tip by ID
     * Only sender, recipient, or admin can view
     *
     * GET /api/tips/:id
     *
     * @param req
     * @param res
     */
    show = async (req: Request, res: Response) => {
        const tipId = String(req.params.id || "-");
        const userId = req.user?.id;
        const isAdmin = req.user?.role === "ADMIN";

        const tip = await prisma.tip.findUnique({
            where: { id: tipId },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                receiver: {
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
            },
        });

        RequestError.assertFound(tip, "Tip not found", 404);

        // Access control: only sender, recipient, or admin can view
        const canAccess =
            isAdmin || tip!.senderId === userId || tip!.receiverId === userId;
        RequestError.assertFound(canAccess, "Access denied", 403);

        new TipResource(req, res, tip!)
            .json()
            .status(200)
            .additional({
                status: "success",
                message: "OK",
                code: 200,
            });
    };

    /**
     * Create a new tip (peer-to-peer)
     *
     * POST /api/tips
     *
     * @param req
     * @param res
     */
    create = async (req: Request, res: Response) => {
        const senderId = req.user?.id!;

        const data = await this.validateAsync(req, {
            amount: "required|numeric|min:0.000001",
            currency: "nullable|string|in:XLM,USDC,ETH",
            message: "nullable|string|max:500",
            receiver_id: "required|exists:user,id",
            artisan_id: "nullable|exists:artisan,id",
            tx_hash: "nullable|string",
        });

        // Prevent self-tipping
        RequestError.abortIf(
            data.receiver_id === senderId,
            "Cannot send a tip to yourself",
            422
        );

        // Validate receiver exists and is not the sender
        const receiver = await prisma.user.findUnique({
            where: { id: data.receiver_id },
        });
        RequestError.assertFound(receiver, "Recipient not found", 404);

        // If artisan_id provided, validate it exists
        if (data.artisan_id) {
            const artisan = await prisma.artisan.findUnique({
                where: { id: data.artisan_id },
            });
            RequestError.assertFound(artisan, "Artisan not found", 404);
        }

        const tip = await prisma.tip.create({
            data: {
                amount: parseFloat(data.amount),
                currency: data.currency || "XLM",
                message: data.message,
                status: data.tx_hash ? TipStatus.COMPLETED : TipStatus.PENDING,
                senderId: senderId,
                receiverId: data.receiver_id,
                artisanId: data.artisan_id || null,
                txHash: data.tx_hash || null,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                receiver: {
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
            },
        });

        // Track tip sent event
        trackBusinessEvent(EventType.TIP_SENT, senderId, {
            tipId: tip.id,
            amount: tip.amount,
            currency: tip.currency,
            receiverId: tip.receiverId,
            artisanId: tip.artisanId,
        });

        new TipResource(req, res, tip)
            .json()
            .status(201)
            .additional({
                status: "success",
                message: "Tip created successfully",
                code: 201,
            });
    };

    /**
     * Update tip status (for blockchain transaction confirmation)
     * Only the sender can update, and only PENDING tips can be updated
     *
     * PUT /api/tips/:id
     *
     * @param req
     * @param res
     */
    update = async (req: Request, res: Response) => {
        const tipId = String(req.params.id || "-");
        const userId = req.user?.id;
        const isAdmin = req.user?.role === "ADMIN";

        const existingTip = await prisma.tip.findUnique({
            where: { id: tipId },
        });

        RequestError.assertFound(existingTip, "Tip not found", 404);

        // Only sender or admin can update
        const canUpdate = isAdmin || existingTip!.senderId === userId;
        RequestError.assertFound(canUpdate, "Access denied", 403);

        // Only PENDING tips can be updated to COMPLETED or CANCELLED
        RequestError.abortIf(
            existingTip!.status !== TipStatus.PENDING,
            "Only pending tips can be updated",
            422
        );

        const data = await this.validateAsync(req, {
            status: "nullable|string|in:COMPLETED,CANCELLED",
            tx_hash: "nullable|string",
        });

        // If tx_hash is provided, status should be COMPLETED
        const newStatus = data.tx_hash
            ? TipStatus.COMPLETED
            : data.status
                ? (data.status as TipStatus)
                : existingTip!.status;

        const tip = await prisma.tip.update({
            where: { id: tipId },
            data: {
                status: newStatus,
                txHash: data.tx_hash || existingTip!.txHash,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                },
                receiver: {
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
            },
        });

        new TipResource(req, res, tip)
            .json()
            .status(202)
            .additional({
                status: "success",
                message: "Tip updated successfully",
                code: 202,
            });
    };
}
