import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { ArtisanType, PrismaClient, Prisma } from "@prisma/client";
import Resource from 'src/resources/index';
import { regex } from "simple-body-validator";
import { validate } from "src/utils/validator";

import { prisma } from 'src/db';

/**
 * Curator/ArtisanController
 */
export default class extends BaseController {
    /**
     * Get all resource from the database
     * 
     * @param req 
     * @param res 
     */
    index = async (req: Request, res: Response) => {

        // Build the search query
        const search = req.query.search ? {
            OR: [
                { name: { contains: <string>req.query.search } },
                { category: { name: { contains: <string>req.query.search } } },
                {
                    location: {
                        OR: [
                            { address: { contains: <string>req.query.search } },
                            { country: { contains: <string>req.query.search } },
                            { state: { contains: <string>req.query.search } },
                            { city: { contains: <string>req.query.search } },
                        ]
                    }
                }]
        } : {}

        // Validate the filter query
        const _in = req.query.filterBy === 'type' ? '|in:BUSINESS,PERSON' : ''
        const { filter, filters: filtersJson, filterBy }: { filter: string, filterBy: string, filters: string } = validate(req.query, {
            filter: `nullable|required_with:filterBy|string${_in}`,
            filters: `nullable|json`,
            filterBy: ['nullable', 'string', 'in:type,archived,isActive,isVerified,category,country,state,city']
        })

        const defaultQuery = {
            archivedAt: filterBy === 'archived' && filter === 'true' ? { not: null } : null,
        }

        // Build the filter query
        const filters = (filterBy?: string, value?: string) => {
            value ??= filter
            if (!value) return defaultQuery;
            if (filterBy === 'priceRange') {
                const PRICE_RANGE_REGEX = /^\d{1,3}(,\d{3})*(\.\d{1,2})?-\d{1,3}(,\d{3})*(\.\d{1,2})?$/;

                if (!PRICE_RANGE_REGEX.test(value)) return defaultQuery;
                const [gteStr, lteStr] = value.split('-');
                const gte = parseFloat(gteStr.replace(/,/g, '')); // Remove commas
                const lte = parseFloat(lteStr.replace(/,/g, '')); // Remove commas
                if (isNaN(gte) || isNaN(lte) || gte > lte) return defaultQuery;
                return { priceRange: { gte, lte } };
            }

            type QM = Prisma.QueryMode

            return {
                type: { type: <ArtisanType>value },
                isVerified: { isVerified: value === 'true' },
                isActive: { isActive: value === 'true' },
                category: { category: { name: { equals: <string>value, mode: <QM>'insensitive' } } },
                country: { location: { country: { equals: <string>value, mode: <QM>'insensitive' } } },
                state: { location: { state: { equals: <string>value, mode: <QM>'insensitive' } } },
                city: { location: { city: { equals: <string>value, mode: <QM>'insensitive' } } },
            }[filterBy ?? 'none'] ?? defaultQuery;
        };

        const filterArgs = filters(filterBy)
        let filterArgsList: (typeof filterArgs)[] = []

        // Validate the filters query array
        if (filtersJson) {
            const { filters: filterList }: { filters: { [k: string]: string }[] } = validate({ filters: JSON.parse(filtersJson) }, {
                filters: ['required', 'array'],
                'filters.*.*': ['required', 'string'],
                'filters.*.type': ['nullable', 'in:BUSINESS,PERSON'],
            })

            filterArgsList = filterList.map(e => filters(Object.keys(e).at(0), Object.values(e).at(0)))
        }

        const where = Object.assign({}, search, {
            curator: {
                id: req.user?.id,
            },
            ...filterArgs,
            AND: filterArgsList
        })

        const orderBy = {
            id: 'id',
            name: 'name',
        }[String(req.query.orderBy ?? 'id')] ?? 'id';

        const { take, skip, meta } = this.pagination(req)

        const [data, total] = await Promise.all([
            prisma.artisan.findMany({
                take,
                skip,
                where,
                orderBy: { [orderBy]: req.query.orderDir === 'desc' ? 'desc' : 'asc' },
                include: {
                    category: true,
                    location: true,
                },
            }),
            prisma.artisan.count({ where })
        ])

        Resource(req, res, {
            data,
            pagination: meta(total, data.length)
        })
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
        Resource(req, res, {
            data: await prisma.artisan.findFirstOrThrow(
                {
                    where: {
                        id: String(req.params.id || '-'),
                        curator: {
                            id: req.user?.id
                        }
                    },
                    include: {
                        category: true,
                        location: true,
                    },
                }
            ),
        })
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
     * @example router.post('/artisans', upload.none(), new AdminController().create);
     * 
     * @param req 
     * @param res 
     */
    create = async (req: Request, res: Response) => {
        const data = await prisma.artisan.create({
            data: await this.buildData(req),
            include: {
                category: true,
                location: true,
            },
        })

        Resource(req, res, { data })
            .json()
            .status(201)
            .additional({
                status: 'success',
                message: 'New artisan created successfully',
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

        const data = await prisma.artisan.update({
            data: await this.buildData(req),
            where: {
                id: String(req.params.id || '-'),
                curator: {
                    id: req.user?.id
                }
            },
            include: {
                category: true,
                location: true,
            },
        })

        Resource(req, res, { data })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Artisan updated successfully',
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
        const { archive } = this.validate(req, {
            archive: 'nullable|boolean',
        });

        let data = {}
        if (archive) {
            data = await prisma.artisan.update({
                data: { archivedAt: new Date() },
                where: {
                    id: String(req.params.id || '-'),
                    curator: {
                        id: req.user?.id
                    }
                },
            })
        } else {
            await prisma.artisan.delete({
                where: {
                    id: String(req.params.id || '-'),
                    curator: {
                        id: req.user?.id
                    }
                }
            })
        }

        Resource(req, res, { data })
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: `Artisan ${archive ? 'archived' : 'deleted'} successfully.`,
                code: 202,
            });
    }

    buildData = async (req: Request) => {

        const data = await this.validateAsync(req, {
            name: `required|string|unique:artisan|min:3`,
            email: 'nullable|required_without:phone|email|unique:artisan',
            phone: 'nullable|required_without:email|unique:artisan',
            price: 'nullable|string|min:0',
            price_range: ['nullable', 'string', regex(/^\d{1,3}(,\d{3})*(\.\d{1,2})?-\d{1,3}(,\d{3})*(\.\d{1,2})?$/)],
            type: 'nullable|string|in:PERSON,BUSINESS',
            description: 'required|string|min:10',
            category_id: 'required|exists:category,id',
            country: 'required|string',
            state: 'required|string',
            city: 'required|string',
            address: 'nullable|required_if:type,BUSINESS',
        });

        return Object.assign({}, data, {
            curator: { connect: { id: req.user?.id! } },
            category: { connect: { id: data.category_id } },
            priceRange: (data.price_range ?? '').replaceAll(' ', '').split('-').map((e: string) => parseFloat(e)),
            price: parseFloat(data.price ?? '0'),
            price_range: undefined,
            category_id: undefined,
            address: undefined,
            country: undefined,
            state: undefined,
            city: undefined,
            location: {
                create: {
                    address: data.address?.trim(),
                    country: data.country?.trim(),
                    state: data.state?.trim(),
                    city: data.city?.trim(),
                    latitude: 0,
                    longitude: 0,
                }
            }
        })
    }
}
