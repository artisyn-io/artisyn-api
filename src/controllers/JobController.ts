import { Request, Response } from "express";
import { JobStatus } from "@prisma/client";

import BaseController from "./BaseController";
import { RequestError } from "../utils/errors";
import JobCollection from "../resources/JobCollection";
import JobResource from "../resources/JobResource";
import { prisma } from "../db";
import { UserRole } from "@prisma/client";

/**
 * JobController
 *
 * Handles Job lifecycle management for accepted applications.
 * Jobs represent active work engagements between clients and curators.
 * 
 * Endpoints:
 * - GET /api/jobs - List jobs (auth - self only, role dependent)
 * - GET /api/jobs/:id - Get job details (auth - involved parties only)
 * - PUT /api/jobs/:id - Update job (auth - involved parties only)
 * - DELETE /api/jobs/:id - Delete job (auth - admin only or system rule)
 */
export default class JobController extends BaseController {
    /**
     * GET /api/jobs
     * List jobs for the authenticated user
     * - ADMIN: Can see all jobs
     * - CURATOR: Can see jobs where they are the curator
     * - USER: Can see jobs where they are the client
     */
    index = async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const { take, skip, meta } = this.pagination(req);

        // Build where clause based on user role
        let where: any = {};

        // Apply role-based filtering
        if (userRole === UserRole.ADMIN) {
            // Admin can see all jobs - no additional filtering
        } else if (userRole === UserRole.CURATOR) {
            where.curatorId = userId;
        } else {
            // Regular users can only see their own jobs
            where.clientId = userId;
        }

        // Optional status filter
        if (req.query.status) {
            where.status = String(req.query.status).toLowerCase() as JobStatus;
        }

        // Optional listing filter (for curators viewing jobs for specific listings)
        if (req.query.listingId && userRole !== UserRole.USER) {
            where.listingId = String(req.query.listingId);
        }

        const [data, count] = await prisma.$transaction([
            prisma.job.findMany({
                where,
                take,
                skip,
                orderBy: { createdAt: 'desc' },
                include: {
                    listing: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            curatorId: true
                        }
                    },
                    client: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true
                        }
                    },
                    curator: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            avatar: true
                        }
                    }
                }
            }),
            prisma.job.count({ where })
        ]);

        new JobCollection(req, res, {
            data,
            pagination: meta(count, data.length)
        })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Jobs retrieved successfully',
                code: 200
            });
    };

    /**
     * GET /api/jobs/:id
     * Get job details (involved parties only: client, curator, or admin)
     */
    show = async (req: Request, res: Response) => {
        const jobId = String(req.params.id);
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                application: {
                    select: {
                        id: true,
                        message: true,
                        createdAt: true
                    }
                },
                listing: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        images: true,
                        curatorId: true
                    }
                },
                client: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true
                    }
                },
                curator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatar: true
                    }
                }
            }
        });

        if (!job) {
            throw new RequestError("Job not found", 404);
        }

        // Authorization check - only involved parties can view
        const isAdmin = userRole === UserRole.ADMIN;
        const isClient = job.clientId === userId;
        const isCurator = job.curatorId === userId;

        if (!isAdmin && !isClient && !isCurator) {
            throw new RequestError("Unauthorized access to this job", 403);
        }

        new JobResource(req, res, job)
            .json()
            .status(200);
    };

    /**
     * PUT /api/jobs/:id
     * Update job (involved parties only: client, curator, or admin)
     * 
     * Allowed updates:
     * - status: Update job status (with transition validation)
     * - notes: Add or update notes
     */
    update = async (req: Request, res: Response) => {
        const jobId = String(req.params.id);
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const { status, notes } = req.body;

        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                listing: {
                    select: {
                        curatorId: true
                    }
                }
            }
        });

        if (!job) {
            throw new RequestError("Job not found", 404);
        }

        // Authorization check - only involved parties can update
        const isAdmin = userRole === UserRole.ADMIN;
        const isClient = job.clientId === userId;
        const isCurator = job.curatorId === userId;

        if (!isAdmin && !isClient && !isCurator) {
            throw new RequestError("Unauthorized access to this job", 403);
        }

        // Prepare update data
        const updateData: any = {};

        // Validate and apply status transition if provided
        if (status) {
            this.validateStatusTransition(job.status, status as JobStatus);
            updateData.status = status.toLowerCase() as JobStatus;
        }

        // Update notes if provided
        if (notes !== undefined) {
            updateData.notes = notes;
        }

        // Perform update
        const updated = await prisma.job.update({
            where: { id: jobId },
            data: updateData,
            include: {
                listing: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        curatorId: true
                    }
                },
                client: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true
                    }
                },
                curator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true
                    }
                }
            }
        });

        new JobResource(req, res, updated)
            .json()
            .additional({
                status: 'success',
                message: 'Job updated successfully',
                code: 200
            })
            .status(200);
    };

    /**
     * DELETE /api/jobs/:id
     * Delete job (admin only or system rule)
     * 
     * System rule: Jobs can only be deleted if they are in 'cancelled' status
     * or if both parties agree (implemented via admin action)
     */
    destroy = async (req: Request, res: Response) => {
        const jobId = String(req.params.id);
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            throw new RequestError("Unauthenticated", 401);
        }

        // Only admin can delete jobs
        if (userRole !== UserRole.ADMIN) {
            throw new RequestError("Only administrators can delete jobs", 403);
        }

        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            throw new RequestError("Job not found", 404);
        }

        // System rule: Can only delete cancelled or disputed jobs
        // For completed jobs, a different workflow should be used
        if (job.status !== 'cancelled' && job.status !== 'disputed') {
            throw new RequestError(
                "Jobs can only be deleted if they are cancelled or disputed. " +
                "Complete the job first or cancel it before deletion.",
                400
            );
        }

        await prisma.job.delete({
            where: { id: jobId }
        });

        res.status(202).json({
            data: {
                id: jobId
            },
            status: 'success',
            message: 'Job deleted successfully',
            code: 202
        });
    };

    /**
     * Get jobs by application ID
     * Internal use for checking if a job exists for an application
     */
    getByApplicationId = async (applicationId: string) => {
        return prisma.job.findUnique({
            where: { applicationId }
        });
    };

    /**
     * Create a job from an accepted application
     * Called internally when an application is accepted
     */
    createFromApplication = async (
        applicationId: string,
        listingId: string,
        clientId: string,
        curatorId: string
    ) => {
        // Check if job already exists for this application
        const existingJob = await this.getByApplicationId(applicationId);
        if (existingJob) {
            return existingJob;
        }

        return prisma.job.create({
            data: {
                applicationId,
                listingId,
                clientId,
                curatorId,
                status: JobStatus.active
            },
            include: {
                listing: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        curatorId: true
                    }
                },
                client: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true
                    }
                },
                curator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true
                    }
                }
            }
        });
    };

    /**
     * Validate job status transitions
     * 
     * Allowed transitions:
     * - active -> in_progress, cancelled
     * - in_progress -> completed, cancelled, disputed
     * - completed -> (terminal state, no transitions)
     * - cancelled -> (terminal state, no transitions)
     * - disputed -> completed, cancelled
     */
    private validateStatusTransition(
        currentStatus: JobStatus,
        newStatus: string
    ): void {
        const validStatuses = ['active', 'in_progress', 'completed', 'cancelled', 'disputed'];
        const normalizedNewStatus = newStatus.toLowerCase();

        if (!validStatuses.includes(normalizedNewStatus)) {
            throw new RequestError(
                `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                400
            );
        }

        const allowedTransitions: Record<JobStatus, JobStatus[]> = {
            active: ['in_progress', 'cancelled'],
            in_progress: ['completed', 'cancelled', 'disputed'],
            completed: [], // Terminal state
            cancelled: [], // Terminal state
            disputed: ['completed', 'cancelled']
        };

        const currentAllowed = allowedTransitions[currentStatus];

        if (!currentAllowed.includes(normalizedNewStatus as JobStatus)) {
            throw new RequestError(
                `Cannot transition from '${currentStatus}' to '${normalizedNewStatus}'. ` +
                `Allowed transitions from '${currentStatus}': ${currentAllowed.length > 0 ? currentAllowed.join(', ') : 'none (terminal state)'}`,
                400
            );
        }
    }
}
