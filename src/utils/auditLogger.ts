import { prisma } from 'src/db';
import type { Request } from 'express';

/**
 * Log audit events for sensitive operations
 * Supports GDPR compliance tracking
 */
export async function logAuditEvent(
    userId: string | undefined | null,
    action: string,
    options: {
        entityType?: string;
        entityId?: string;
        oldValues?: any;
        newValues?: any;
        req?: Request;
        statusCode?: number;
        errorMessage?: string;
        metadata?: any;
    } = {}
) {
    try {
        // Extract IP and User Agent
        const ipAddress = options.req?.ip || options.req?.socket?.remoteAddress;
        const userAgent = options.req?.get('user-agent');

        await prisma.auditLog.create({
            data: {
                userId: userId || undefined,
                action,
                entityType: options.entityType,
                entityId: options.entityId,
                oldValues: options.oldValues,
                newValues: options.newValues,
                ipAddress,
                userAgent,
                statusCode: options.statusCode,
                errorMessage: options.errorMessage,
                metadata: options.metadata,
            },
        });
    } catch (error) {
        // Log error but don't throw - audit logging shouldn't break operations
        console.error('Failed to log audit event:', error);
    }
}

/**
 * Get audit logs for a specific user with pagination
 */
export async function getUserAuditLogs(
    userId: string,
    options: {
        action?: string;
        skip?: number;
        take?: number;
    } = {}
) {
    const where: any = { userId };
    if (options.action) {
        where.action = options.action;
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: options.skip,
            take: options.take,
        }),
        prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
}
