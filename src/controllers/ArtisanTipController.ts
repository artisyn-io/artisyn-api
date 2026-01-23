import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { EventType, TipStatus } from "@prisma/client";
import { ApiResource } from "src/resources/index";
import TipResource from "src/resources/TipResource";
import { trackBusinessEvent } from "src/utils/analyticsMiddleware";
import { RequestError } from "src/utils/errors";

import { prisma } from "src/db";

/**
 * ArtisanTipController
 *
 * Handles tip creation for artisans
 * The receiver will be the artisan's curator
 */
export default class extends BaseController {
    /**
     * Create a tip for a specific artisan
     * The receiver will be the artisan's curator
     *
     * POST /api/artisans/:id/tips
     *
     * @param req
     * @param res
     */
    create = async (req: Request, res: Response) => {
        const senderId = req.user?.id!;
        const artisanId = String(req.params.id || "-");

        const data = await this.validateAsync(req, {
            amount: "required|numeric|min:0.000001",
            currency: "nullable|string|in:XLM,USDC,ETH",
            message: "nullable|string|max:500",
            tx_hash: "nullable|string",
        });

        // Find artisan and get the curator (receiver)
        const artisan = await prisma.artisan.findUnique({
            where: { id: artisanId },
            include: {
                curator: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        RequestError.abortIf(!artisan, "Artisan not found", 404);

        const receiverId = artisan!.curatorId;

        // Prevent self-tipping
        RequestError.abortIf(
            receiverId === senderId,
            "Cannot send a tip to yourself",
            422
        );

        const tip = await prisma.tip.create({
            data: {
                amount: parseFloat(data.amount),
                currency: data.currency || "XLM",
                message: data.message,
                status: data.tx_hash ? TipStatus.COMPLETED : TipStatus.PENDING,
                senderId: senderId,
                receiverId: receiverId,
                artisanId: artisanId,
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

        ApiResource(new TipResource(req, res, tip))
            .json()
            .status(201)
            .additional({
                status: "success",
                message: "Tip sent to artisan successfully",
                code: 201,
            });
    };
}
