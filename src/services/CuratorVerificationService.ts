import { prisma } from '../db';
import { VerificationStatus, EventType } from '@prisma/client';
import { RequestError } from '../utils/errors';
import { sendMail } from '../mailer/mailer';
import { trackBusinessEvent } from '../utils/analyticsMiddleware';
import StorageService from '../utils/StorageService';

export interface SubmitVerificationApplicationData {
    curatorId: string;
    documents: Array<{
        file: Express.Multer.File;
        documentType: string;
        documentName: string;
    }>;
    metadata?: any;
}

export interface ReviewApplicationData {
    applicationId: string;
    adminId: string;
    status: VerificationStatus.VERIFIED | VerificationStatus.REJECTED;
    notes?: string;
}

export class CuratorVerificationService {
    private static readonly MAX_FILE_SIZE = 250 * 1024;
    private static readonly ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
    ];

    static async submitApplication(data: SubmitVerificationApplicationData) {
        const { curatorId, documents, metadata } = data;

        const curator = await prisma.curator.findUnique({
            where: { id: curatorId },
            include: { user: true }
        });

        if (!curator) {
            throw new RequestError('Curator not found', 404);
        }

        const existingPendingApplication = await prisma.curatorVerificationApplication.findFirst({
            where: {
                curatorId,
                status: VerificationStatus.PENDING
            }
        });

        if (existingPendingApplication) {
            throw new RequestError('You already have a pending verification application', 400);
        }

        if (!documents || documents.length === 0) {
            throw new RequestError('At least one document is required', 400);
        }

        for (const doc of documents) {
            this.validateDocument(doc.file);
        }

        const application = await prisma.curatorVerificationApplication.create({
            data: {
                curatorId,
                status: VerificationStatus.PENDING,
                metadata: metadata || {},
                submittedAt: new Date()
            }
        });

        const uploadedDocs = [];
        for (const doc of documents) {
            const uploadResult = await StorageService.upload(doc.file, {
                folder: 'verification-documents',
                tags: ['curator_verification', curatorId]
            });

            const media = await prisma.media.create({
                data: {
                    filename: uploadResult.path.split('/').pop()!,
                    originalName: doc.file.originalname,
                    mimeType: doc.file.mimetype,
                    size: doc.file.size,
                    path: uploadResult.path,
                    url: uploadResult.url,
                    provider: uploadResult.provider,
                    userId: curator.userId,
                    tags: ['curator_verification', curatorId],
                    metadata: uploadResult.metadata
                }
            });

            const verificationDoc = await prisma.curatorVerificationDocument.create({
                data: {
                    applicationId: application.id,
                    mediaId: media.id,
                    documentType: doc.documentType,
                    documentName: doc.documentName
                }
            });

            uploadedDocs.push(verificationDoc);

            trackBusinessEvent(EventType.CURATOR_VERIFICATION_DOCUMENT_UPLOADED, curator.userId, {
                applicationId: application.id,
                documentType: doc.documentType,
                documentName: doc.documentName
            });
        }

        await prisma.curatorVerificationHistory.create({
            data: {
                curatorId,
                applicationId: application.id,
                action: 'SUBMITTED',
                status: VerificationStatus.PENDING,
                performedBy: curator.userId,
                metadata: {
                    documentCount: documents.length
                }
            }
        });

        trackBusinessEvent(EventType.CURATOR_VERIFICATION_SUBMITTED, curator.userId, {
            applicationId: application.id,
            documentCount: documents.length
        });

        await sendMail({
            to: curator.user.email,
            subject: 'Verification Application Submitted',
            text: `
                <h2>Hello ${curator.user.firstName},</h2>
                <p>Your curator verification application has been submitted successfully.</p>
                <p>Our team will review your application and documents. You will receive an email notification once the review is complete.</p>
                <p>Thank you for your patience!</p>
            `,
            caption: 'Application Submitted'
        });

        return await prisma.curatorVerificationApplication.findUnique({
            where: { id: application.id },
            include: {
                documents: {
                    include: {
                        media: true
                    }
                }
            }
        });
    }

    static async getApplicationStatus(curatorId: string) {
        const applications = await prisma.curatorVerificationApplication.findMany({
            where: { curatorId },
            include: {
                documents: {
                    include: {
                        media: true
                    }
                }
            },
            orderBy: { submittedAt: 'desc' }
        });

        const history = await prisma.curatorVerificationHistory.findMany({
            where: { curatorId },
            orderBy: { createdAt: 'desc' }
        });

        return {
            applications,
            history
        };
    }

    static async listPendingApplications(page: number = 1, limit: number = 15, filters?: any) {
        const skip = (page - 1) * limit;

        const where: any = {
            status: filters?.status || VerificationStatus.PENDING
        };

        if (filters?.submittedAfter) {
            where.submittedAt = { gte: new Date(filters.submittedAfter) };
        }

        if (filters?.submittedBefore) {
            where.submittedAt = { ...where.submittedAt, lte: new Date(filters.submittedBefore) };
        }

        const [applications, total] = await Promise.all([
            prisma.curatorVerificationApplication.findMany({
                where,
                skip,
                take: limit,
                include: {
                    curator: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    firstName: true,
                                    lastName: true,
                                    avatar: true
                                }
                            }
                        }
                    },
                    documents: {
                        include: {
                            media: true
                        }
                    }
                },
                orderBy: { submittedAt: 'desc' }
            }),
            prisma.curatorVerificationApplication.count({ where })
        ]);

        return {
            applications,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async getApplicationById(applicationId: string, adminId?: string) {
        const application = await prisma.curatorVerificationApplication.findUnique({
            where: { id: applicationId },
            include: {
                curator: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                avatar: true,
                                bio: true,
                                phone: true
                            }
                        }
                    }
                },
                documents: {
                    include: {
                        media: true
                    }
                },
                history: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!application) {
            throw new RequestError('Application not found', 404);
        }

        if (adminId) {
            trackBusinessEvent(EventType.CURATOR_VERIFICATION_VIEWED, adminId, {
                applicationId,
                curatorId: application.curatorId
            });

            await prisma.curatorVerificationHistory.create({
                data: {
                    curatorId: application.curatorId,
                    applicationId: application.id,
                    action: 'VIEWED',
                    performedBy: adminId,
                    metadata: {
                        viewedAt: new Date()
                    }
                }
            });
        }

        return application;
    }

    static async reviewApplication(data: ReviewApplicationData) {
        const { applicationId, adminId, status, notes } = data;

        const application = await prisma.curatorVerificationApplication.findUnique({
            where: { id: applicationId },
            include: {
                curator: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (!application) {
            throw new RequestError('Application not found', 404);
        }

        if (application.status !== VerificationStatus.PENDING) {
            throw new RequestError('This application has already been reviewed', 400);
        }

        const [updatedApplication, updatedCurator] = await prisma.$transaction([
            prisma.curatorVerificationApplication.update({
                where: { id: applicationId },
                data: {
                    status,
                    reviewedAt: new Date(),
                    reviewedBy: adminId,
                    rejectionReason: status === VerificationStatus.REJECTED ? notes : null
                },
                include: {
                    documents: {
                        include: {
                            media: true
                        }
                    }
                }
            }),
            prisma.curator.update({
                where: { id: application.curatorId },
                data: {
                    verificationStatus: status,
                    verifiedAt: status === VerificationStatus.VERIFIED ? new Date() : null
                }
            })
        ]);

        await prisma.curatorVerificationHistory.create({
            data: {
                curatorId: application.curatorId,
                applicationId: application.id,
                action: status === VerificationStatus.VERIFIED ? 'APPROVED' : 'REJECTED',
                status,
                performedBy: adminId,
                notes,
                metadata: {
                    reviewedAt: new Date()
                }
            }
        });

        const eventType = status === VerificationStatus.VERIFIED 
            ? EventType.CURATOR_VERIFICATION_APPROVED 
            : EventType.CURATOR_VERIFICATION_REJECTED;

        trackBusinessEvent(eventType, adminId, {
            applicationId,
            curatorId: application.curatorId,
            notes
        });

        const emailSubject = status === VerificationStatus.VERIFIED
            ? 'Curator Verification Approved'
            : 'Curator Verification Application Update';

        const emailText = status === VerificationStatus.VERIFIED
            ? `
                <h2>Congratulations ${application.curator.user.firstName}!</h2>
                <p>Your curator verification application has been <strong>approved</strong>.</p>
                <p>You now have full access to all curator features and your profile will be marked as verified.</p>
                <p>Thank you for being part of the Artisyn community!</p>
            `
            : `
                <h2>Hello ${application.curator.user.firstName},</h2>
                <p>Thank you for submitting your curator verification application.</p>
                <p>After careful review, we are unable to approve your application at this time.</p>
                ${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ''}
                <p>You may submit a new application with updated documentation if you wish to reapply.</p>
                <p>If you have any questions, please contact our support team.</p>
            `;

        await sendMail({
            to: application.curator.user.email,
            subject: emailSubject,
            text: emailText,
            caption: status === VerificationStatus.VERIFIED ? 'Approved' : 'Application Update'
        });

        return updatedApplication;
    }

    private static validateDocument(file: Express.Multer.File) {
        if (file.size > this.MAX_FILE_SIZE) {
            throw new RequestError(
                `File ${file.originalname} exceeds maximum size of 250KB`,
                400
            );
        }

        if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            throw new RequestError(
                `File ${file.originalname} has invalid type. Allowed types: PDF, JPEG, PNG, WebP`,
                400
            );
        }
    }
}
