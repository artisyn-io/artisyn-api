import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import Resource from 'src/resources/index';
import { trackBusinessEvent } from 'src/utils/analyticsMiddleware';
import { EventType } from "@prisma/client";

import { prisma } from 'src/db';

/**
 * Curator/ArtisanContactController
 * Handles contact information access with analytics tracking
 */
export default class extends BaseController {
    /**
     * Get contact information for a specific artisan
     * Tracks access for analytics (CONTACT_INFO_ACCESSED event)
     * 
     * @param req 
     * @param res 
     */
    show = async (req: Request, res: Response) => {
        const artisan = await prisma.artisan.findFirstOrThrow({
            where: {
                id: String(req.params.id || '-'),
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                curatorId: true,
            },
        });

        // Track contact info access for analytics
        trackBusinessEvent(EventType.CONTACT_INFO_ACCESSED, req.user?.id, {
            artisanId: artisan.id,
            curatorId: artisan.curatorId,
            accessedFields: {
                email: !!artisan.email,
                phone: !!artisan.phone,
            },
        });

        Resource(req, res, {
            data: {
                id: artisan.id,
                name: artisan.name,
                email: artisan.email,
                phone: artisan.phone,
            },
        })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Contact information retrieved successfully',
                code: 200,
            });
    }
}
