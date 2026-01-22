import { Request, Response } from "express";
import BaseController from "./BaseController";
import { ApiResource } from 'src/resources/index';
import AccountLinkResource from "src/resources/AccountLinkResource";
import AccountLinkCollection from "src/resources/AccountLinkCollection";
import { prisma } from 'src/db';
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { accountLinkValidationRules } from 'src/utils/profileValidators';

/**
 * AccountLinkingController - Manages social and external account linking
 * Supports Google, Facebook, GitHub, Apple, Twitter, LinkedIn
 */
export default class extends BaseController {
    /**
     * Get all linked accounts for current user
     */
    getLinkedAccounts = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            const { take, skip, meta } = this.pagination(req);

            const [accounts, total] = await Promise.all([
                prisma.accountLink.findMany({
                    where: { userId },
                    orderBy: { linkedAt: 'desc' },
                    take,
                    skip,
                }),
                prisma.accountLink.count({ where: { userId } }),
            ]);

            ApiResource(new AccountLinkCollection(req, res, {
                data: accounts,
                pagination: meta(total, accounts.length),
            }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Linked accounts retrieved',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Link a social account
     */
    linkAccount = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            RequestError.abortIf(!userId, 'Unauthorized', 401);

            // Validate input
            const errors = await this.validateAsync(req, accountLinkValidationRules);
            if (Object.keys(errors).length > 0) {
                RequestError.abortIf(true, 'Validation failed', 422);
            }

            const { provider, providerUserId, accessToken, refreshToken, expiresAt } = req.body;

            // Check if account is already linked
            const existing = await prisma.accountLink.findUnique({
                where: {
                    userId_provider: {
                        userId,
                        provider: provider as string,
                    },
                },
            });

            if (existing) {
                // Update existing link
                const updated = await prisma.accountLink.update({
                    where: { id: existing.id },
                    data: {
                        accessToken,
                        refreshToken,
                        expiresAt: expiresAt ? new Date(expiresAt) : null,
                        isVerified: true,
                    },
                });

                // Log account link update
                await logAuditEvent(userId, 'ACCOUNT_LINK', {
                    req,
                    entityType: 'AccountLink',
                    entityId: updated.id,
                    statusCode: 200,
                    metadata: { provider, action: 'update_link' },
                });

                ApiResource(new AccountLinkResource(req, res, { data: updated }))
                    .json()
                    .status(200)
                    .additional({
                        status: 'success',
                        message: 'Account link updated',
                        code: 200,
                    });
                return;
            }

            // Create new link
            const accountLink = await prisma.accountLink.create({
                data: {
                    userId,
                    provider: provider as string,
                    providerUserId,
                    accessToken,
                    refreshToken,
                    expiresAt: expiresAt ? new Date(expiresAt) : null,
                    providerName: req.body.providerName,
                    providerEmail: req.body.providerEmail,
                    isVerified: true,
                },
            });

            // Log account link creation
            await logAuditEvent(userId, 'ACCOUNT_LINK', {
                req,
                entityType: 'AccountLink',
                entityId: accountLink.id,
                statusCode: 201,
                metadata: { provider },
            });

            ApiResource(new AccountLinkResource(req, res, { data: accountLink }))
                .json()
                .status(201)
                .additional({
                    status: 'success',
                    message: 'Account linked successfully',
                    code: 201,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Unlink a social account
     */
    unlinkAccount = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { provider } = req.params;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!provider, 'Provider required', 400);

            // Find the account link
            const accountLink = await prisma.accountLink.findUnique({
                where: {
                    userId_provider: {
                        userId,
                        provider: provider as string,
                    },
                },
            });

            RequestError.abortIf(!accountLink, 'Account link not found', 404);

            // Delete the link
            const deleted = await prisma.accountLink.delete({
                where: { id: accountLink.id },
            });

            // Log account unlink
            await logAuditEvent(userId, 'ACCOUNT_UNLINK', {
                req,
                entityType: 'AccountLink',
                entityId: accountLink.id,
                statusCode: 200,
                metadata: { provider },
            });

            ApiResource(new AccountLinkResource(req, res, { data: {} }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Account unlinked successfully',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Get a specific linked account
     */
    getAccountLink = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { provider } = req.params;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!provider, 'Provider required', 400);

            const accountLink = await prisma.accountLink.findUnique({
                where: {
                    userId_provider: {
                        userId,
                        provider: provider as string,
                    },
                },
            });

            RequestError.abortIf(!accountLink, 'Account link not found', 404);

            ApiResource(new AccountLinkResource(req, res, { data: accountLink }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Account link retrieved',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Check if a provider account is already linked
     */
    checkProviderAvailability = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { provider, providerUserId } = req.body;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!provider, 'Provider required', 400);
            RequestError.abortIf(!providerUserId, 'Provider user ID required', 400);

            // Check if this provider account is already linked to current user
            const ownLink = await prisma.accountLink.findUnique({
                where: {
                    userId_provider: {
                        userId,
                        provider: provider as string,
                    },
                },
            });

            // Check if this provider account is linked to another user
            const otherLink = await prisma.accountLink.findFirst({
                where: {
                    provider: provider as string,
                    providerUserId,
                    userId: { not: userId },
                },
            });

            const data = {
                provider,
                isAvailable: !otherLink,
                alreadyLinkedToYou: !!ownLink,
                linkedByAnother: !!otherLink,
            };

            ApiResource(new AccountLinkResource(req, res, { data }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Provider availability checked',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };

    /**
     * Verify account link ownership
     */
    verifyAccountLink = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            const { linkId, verificationCode } = req.body;

            RequestError.abortIf(!userId, 'Unauthorized', 401);
            RequestError.abortIf(!linkId, 'Link ID required', 400);
            RequestError.abortIf(!verificationCode, 'Verification code required', 400);

            const accountLink = await prisma.accountLink.findFirst({
                where: {
                    id: linkId,
                    userId,
                },
            });

            RequestError.abortIf(!accountLink, 'Account link not found', 404);

            // In a real scenario, verify the code with the provider
            // For now, we'll mark as verified if code is provided
            const updated = await prisma.accountLink.update({
                where: { id: linkId },
                data: { isVerified: true },
            });

            // Log verification
            await logAuditEvent(userId, 'ACCOUNT_LINK', {
                req,
                entityType: 'AccountLink',
                entityId: linkId,
                statusCode: 200,
                metadata: { action: 'verify_link' },
            });

            ApiResource(new AccountLinkResource(req, res, { data: updated }))
                .json()
                .status(200)
                .additional({
                    status: 'success',
                    message: 'Account link verified',
                    code: 200,
                });
        } catch (error) {
            throw error;
        }
    };
}
