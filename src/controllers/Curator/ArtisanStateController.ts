import { Prisma, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import Resource from 'src/resources/index';
import { trackBusinessEvent } from 'src/utils/analyticsMiddleware';
import { EventType } from '@prisma/client';
import { prisma } from 'src/db';

/**
 * Curator/ArtisanStateController
 */
export default class extends BaseController {
    /**
     * Set the activation status of a specific resource in the database
     * 
     * @param req 
     * @param res 
     */
    activation = async (req: Request, res: Response) => {
        const { active: isActive } = this.validate(req, {
            active: 'required|boolean',
        });

        const data = await prisma.artisan.update({
            data: { isActive },
            where: {
                id: String(req.params.id ?? '-'),
                archivedAt: null,
                curator: {
                    id: req.user?.id
                }
            },
        })

        // Track artisan activation/deactivation
        await trackBusinessEvent(EventType.ADMIN_ACTION, req.user?.id, {
            action: isActive ? 'artisan_activate' : 'artisan_deactivate',
            artisanId: data.id,
        });
 
        Resource(req, res, { data })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: `Artisan ${!isActive ? 'de' : ''}activated successfully.`,
                code: 202,
            });
    }

    /**
     * Perform action on bulk resources in the database
     * 
     * @param req 
     * @param res 
     */
    bulk = async (req: Request, res: Response) => {
        const { ids, action } = this.validate(req, {
            ids: 'required|array',
            'ids.*': 'required|exists:artisan,id',
            action: 'required|string|in:delete,archive,unarchive,activate,deactivate'
        });

        let count = 0
        let build: Prisma.ArtisanUpdateArgs['data'] = {}

        if (action == 'archive' || action == 'unarchive')
            build = { archivedAt: action == 'archive' ? new Date() : null }
        else if (action == 'activate' || action == 'deactivate')
            build = { isActive: action == 'activate' }

        if (action === 'delete') {
            await prisma.artisan.deleteMany({
                where: { id: { in: ids } }
            });
        } else {
            ({ count } = await prisma.artisan.updateMany({
                data: build,
                where: { id: { in: ids } }
            }));
        }

        // Track bulk artisan admin action
        await trackBusinessEvent(EventType.ADMIN_ACTION, req.user?.id, {
            action: `artisan_bulk_${action}`,
            affectedIds: ids,
            updatedCount: count,
        });
 
        Resource(req, res, {
            data: await prisma.artisan.findMany({
                where: { id: { in: ids } }
            })
        })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: `${count} artisan(s) have been ${action}d.`,
                code: 202,
            });
    }
}
