import { Request, Response } from "express";
import { ApiResource } from 'src/resources/index';

import BaseController from "../BaseController";
import CategoryCollection from "src/resources/CategoryCollection";
import CategoryResource from "src/resources/CategoryResource";

import { ValidationError } from "src/utils/errors";

import { prisma } from 'src/db';

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
            { where: { id: req.params.id } }
        )

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

    /**
     * Create a new resource in the database
     * 
     * The calling route must recieve a multer.RequestHandler instance
     * 
     * @example router.post('/categorys', upload.none(), new AdminController().create);
     * 
     * @param req 
     * @param res 
     */
    create = async (req: Request, res: Response) => {
        const formData = await this.validateAsync(req, {
            name: 'required|string|unique:category,name|min:3',
            icon: 'nullable|string|min:3',
            description: 'nullable|string|min:10',
        });

        if (await prisma.category.count({ where: { name: formData.name } })) {
            ValidationError.withMessages({ name: [`There is already a category named ${formData.name}`] })
        }

        const data = await prisma.category.create({
            data: formData,
        })

        ApiResource(new CategoryResource(req, res, {
            data,
        }))
            .json()
            .status(201)
            .additional({
                status: 'success',
                message: 'New category created successfully',
                code: 201,
            });
    }

    /**
     * Update a specific resource in the database
     * 
     * @param req 
     * @param res 
     */
    update = async (req: Request, res: Response) => {
        await prisma.category.findFirstOrThrow(
            { where: { id: req.params.id } }
        )

        const formData = await this.validateAsync(req, {
            name: `required|string|unique:category,name,${req.params.id},id|min:3`,
            icon: 'nullable|string|min:3',
            description: 'nullable|string|min:10',
        });

        const data = await prisma.category.update({
            where: { id: req.params.id },
            data: formData,
        })

        ApiResource(new CategoryResource(req, res, {
            data,
        }))
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Category updated successfully',
                code: 202,
            });
    }

    /**
     * Delete a specific resource from the database
     * 
     * @param req 
     * @param res 
     */
    delete = async (req: Request, res: Response) => {
        await prisma.category.findFirstOrThrow(
            { where: { id: req.params.id } }
        )

        await prisma.category.delete(
            { where: { id: req.params.id } }
        )

        ApiResource(new CategoryResource(req, res, {
            data: {},
        }))
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: 'category deleted successfully',
                code: 202,
            });
    }
}
