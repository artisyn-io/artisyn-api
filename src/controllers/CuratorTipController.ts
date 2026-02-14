import { EventType, TipStatus } from "@prisma/client";
import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { RequestError } from "src/utils/errors";
import TipResource from "src/resources/TipResource";
import { prisma } from "src/db";
import { trackBusinessEvent } from "src/utils/analyticsMiddleware";

/**
 * CuratorTipController
 *
 * Handles tip creation for curators
 */
export default class extends BaseController {
    /**
     * Create a tip for a specific curator
     *
     * POST /api/curator/:id/tips
     *
     * @param req
     * @param res
     */
    create = async (req: Request, res: Response) => {
        const senderId = req.user?.id!;
        const curatorId = String(req.params.id || "-");

        const data = await this.validateAsync(req, {
            amount: "required|numeric|min:0.000001",
            currency: "nullable|string|in:XLM,USDC,ETH",
            message: "nullable|string|max:500",
            artisan_id: "nullable|exists:artisan,id",
            tx_hash: "nullable|string",
        });

        // Find curator
        const curator = await prisma.curator.findUnique({
            where: { id: curatorId },
            include: {
                user: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        RequestError.assertFound(curator, "Curator not found", 404);

        const receiverId = curator!.userId;

        // Prevent self-tipping
        RequestError.abortIf(
            receiverId === senderId,
            "Cannot send a tip to yourself",
            422
        );

        // If artisan_id provided, validate it belongs to this curator
        if (data.artisan_id) {
            const artisan = await prisma.artisan.findFirst({
                where: {
                    id: data.artisan_id,
                    curatorId: receiverId,
                },
            });
            RequestError.abortIf(
                !artisan,
                "Artisan not found or does not belong to this curator",
                404
            );
        }

        const tip = await prisma.tip.create({
            data: {
                amount: parseFloat(data.amount),
                currency: data.currency || "XLM",
                message: data.message,
                status: data.tx_hash ? TipStatus.COMPLETED : TipStatus.PENDING,
                senderId: senderId,
                receiverId: receiverId,
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
                message: "Tip sent to curator successfully",
                code: 201,
            });
    };
}
