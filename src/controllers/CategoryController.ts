import { Request, Response } from "express";
import { ApiResource } from '../resources/index';

import CategoryCollection from "../resources/CategoryCollection";
import CategoryResource from "../resources/CategoryResource";
import BaseController from "./BaseController";

import { prisma } from '../db';
import { trackBusinessEvent } from '../utils/analyticsMiddleware';
import { EventType } from '@prisma/client';

/**
 * Admin/CategoryController
 */
export default class extends BaseController {
    /**
     * Get all resource from the database
     * 
     * @param req 
     * @param res 
     */
    index = async (req: Request, res: Response) => {
        const { take, skip, meta } = this.pagination(req)

        const orderBy = {
            id: 'id',
            name: 'name',
        }[String(req.query.orderBy ?? 'id')] ?? 'id';

        const query = {
            where: req.query.search ? { name: { contains: <string>req.query.search } } : {}
        }

        const [data, total] = await Promise.all([
            prisma.category.findMany({
                ...query,
                orderBy: { [orderBy]: req.query.orderDir === 'desc' ? 'desc' : 'asc' },
                take,
                skip,
            }),
            prisma.category.count(query)
        ])

        ApiResource(new CategoryCollection(req, res, {
            data,
            pagination: meta(total, data.length)
        }))
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'OK',
                code: 200,
            });
    }

    /**
     * Get a specific resource from the database
     * 
     * @param req 
     * @param res 
     */
    show = async (req: Request, res: Response) => {

        const category = await prisma.category.findFirstOrThrow(
            { where: { id: String(req.params.id) } }
        )

        // Track category view for analytics
        trackBusinessEvent(EventType.CATEGORY_VIEWED, req.user?.id, {
            categoryId: category.id,
            categoryName: category.name,
        });

        ApiResource(new CategoryResource(req, res, {
            data: category,
        }))
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'OK',
                code: 200,
            });
    }
}
