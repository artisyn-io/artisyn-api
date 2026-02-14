import { Request, Response } from 'express';

import BaseController from './BaseController';
import { EventType } from '@prisma/client';
import MediaCollection from 'src/resources/MediaCollection';
import MediaResource from 'src/resources/MediaResource';
import { RequestError } from 'src/utils/errors';
import StorageService from 'src/utils/StorageService';
import { prisma } from 'src/db';
import { trackBusinessEvent } from 'src/utils/analyticsMiddleware';

export default class MediaController extends BaseController {
    /**
     * List media files
     */
    public index = async (req: Request, res: Response) => {
        const { take, skip, meta } = this.pagination(req);
        const userId = req.user?.id;

        const where: any = {};
        if (req.user?.role !== 'ADMIN') {
            where.userId = userId;
        }

        if (req.query.tags) {
            const tags = String(req.query.tags).split(',');
            where.tags = { hasSome: tags };
        }

        const [total, data] = await Promise.all([
            prisma.media.count({ where }),
            prisma.media.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        new MediaCollection(req, res, {
            data,
            pagination: meta(total, data.length)
        })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Media files retrieved successfully',
                code: 200,
            });
    };

    /**
     * Upload a file
     */
    public upload = async (req: Request, res: Response) => {
        if (!req.file) {
            throw new RequestError('No file uploaded', 400);
        }

        const formData = await this.validateAsync(req, {
            tags: 'nullable|array',
            'tags.*': 'string',
            folder: 'nullable|string',
            optimize: 'nullable|boolean',
            width: 'nullable|numeric',
            height: 'nullable|numeric',
        });

        const userId = req.user?.id;

        const uploadResult = await StorageService.upload(req.file, {
            folder: formData.folder || 'uploads',
            tags: formData.tags || [],
            optimize: formData.optimize,
            width: formData.width,
            height: formData.height,
        });

        const media = await prisma.media.create({
            data: {
                filename: req.file.filename || uploadResult.url.split('/').pop()!,
                originalName: req.file.originalname,
                mimeType: uploadResult.metadata?.format ? `image/${uploadResult.metadata.format}` : req.file.mimetype,
                size: req.file.size,
                path: uploadResult.path,
                url: uploadResult.url,
                provider: uploadResult.provider,
                userId: userId || null,
                tags: formData.tags || [],
                metadata: {
                    originalname: req.file.originalname,
                    encoding: req.file.encoding,
                    mimetype: req.file.mimetype,
                    ...(uploadResult.metadata || {}),
                },
            },
        });

        // Track media upload
        await trackBusinessEvent(EventType.ADMIN_ACTION, req.user?.id, {
            action: 'media_upload',
            mediaId: media.id,
            tags: media.tags,
        });

        new MediaResource(req, res, {
            data: media,
        })
            .json()
            .status(201)
            .additional({
                status: 'success',
                message: 'File uploaded successfully',
                code: 201,
            });
    };

    /**
     * Upload multiple files
     */
    public uploadBulk = async (req: Request, res: Response) => {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            throw new RequestError('No files uploaded', 400);
        }

        const formData = await this.validateAsync(req, {
            tags: 'nullable|array',
            'tags.*': 'string',
            folder: 'nullable|string',
            optimize: 'nullable|boolean',
            width: 'nullable|numeric',
            height: 'nullable|numeric',
        });

        const userId = req.user?.id;
        const results = [];

        for (const file of req.files) {
            const uploadResult = await StorageService.upload(file as Express.Multer.File, {
                folder: formData.folder || 'uploads',
                tags: formData.tags || [],
                optimize: formData.optimize,
                width: formData.width,
                height: formData.height,
            });

            const media = await prisma.media.create({
                data: {
                    filename: (file as Express.Multer.File).filename || uploadResult.url.split('/').pop()!,
                    originalName: (file as Express.Multer.File).originalname,
                    mimeType: uploadResult.metadata?.format ? `image/${uploadResult.metadata.format}` : (file as Express.Multer.File).mimetype,
                    size: (file as Express.Multer.File).size,
                    path: uploadResult.path,
                    url: uploadResult.url,
                    provider: uploadResult.provider,
                    userId: userId || null,
                    tags: formData.tags || [],
                    metadata: {
                        originalname: (file as Express.Multer.File).originalname,
                        encoding: (file as Express.Multer.File).encoding,
                        mimetype: (file as Express.Multer.File).mimetype,
                        ...(uploadResult.metadata || {}),
                    },
                },
            });
            results.push(media);
        }

        // Track bulk media upload
        await trackBusinessEvent(EventType.ADMIN_ACTION, req.user?.id, {
            action: 'media_upload_bulk',
            count: results.length,
        });

        new MediaCollection(req, res, results)
            .json()
            .status(201)
            .additional({
                status: 'success',
                message: `${results.length} files uploaded successfully`,
                code: 201,
            });
    };

    /**
     * Get media by ID
     */
    public show = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const media = await prisma.media.findUnique({
            where: { id },
        });

        if (!media) {
            throw new RequestError('Media not found', 404);
        }

        // Check if user has permission to see this media
        if (req.user?.role !== 'ADMIN' && media.userId !== req.user?.id) {
            throw new RequestError('Unauthorized access to media', 403);
        }

        new MediaResource(req, res, {
            data: media,
        })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Media retrieved successfully',
                code: 200,
            });
    };

    /**
     * Update media tags/metadata
     */
    public update = async (req: Request, res: Response) => {
        const id = req.params.id as string;

        const media = await prisma.media.findUnique({
            where: { id },
        });

        if (!media) {
            throw new RequestError('Media not found', 404);
        }

        if (req.user?.role !== 'ADMIN' && media.userId !== req.user?.id) {
            throw new RequestError('Unauthorized access to media', 403);
        }

        const formData = await this.validateAsync(req, {
            tags: 'nullable|array',
            'tags.*': 'string',
            metadata: 'nullable|object',
        });

        const updatedMedia = await prisma.media.update({
            where: { id },
            data: {
                tags: formData.tags || media.tags,
                metadata: formData.metadata ? { ...(media.metadata as object), ...formData.metadata } : media.metadata,
            },
        });

        // Track media update
        await trackBusinessEvent(EventType.ADMIN_ACTION, req.user?.id, {
            action: 'media_update',
            mediaId: updatedMedia.id,
        });

        new MediaResource(req, res, {
            data: updatedMedia,
        })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Media updated successfully',
                code: 200,
            });
    };

    /**
     * Delete media
     */
    public destroy = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const media = await prisma.media.findUnique({
            where: { id },
        });

        if (!media) {
            throw new RequestError('Media not found', 404);
        }

        if (req.user?.role !== 'ADMIN' && media.userId !== req.user?.id) {
            throw new RequestError('Unauthorized access to media', 403);
        }

        // Delete from storage
        if (media.path) {
            try {
                await StorageService.delete(media.path);
            } catch (error) {
                console.error('Failed to delete file from storage:', error);
            }
        }

        // Delete from DB
        await prisma.media.delete({
            where: { id },
        });

        // Track media delete
        await trackBusinessEvent(EventType.ADMIN_ACTION, req.user?.id, {
            action: 'media_delete',
            mediaId: id,
        });

        return res.json({
            status: 'success',
            message: 'Media deleted successfully',
            code: 200,
        });
    };
}
