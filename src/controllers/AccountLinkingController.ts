import { Request, Response } from 'express';

import { AccountLinkProvider } from '@prisma/client';
import BaseController from './BaseController';
import { RequestError } from 'src/utils/errors';
import Resource from '../resources/index';
import { accountLinkValidationRules, accountLinkVerifyValidationRules, checkAvailabilityValidationRules } from 'src/utils/profileValidators';
import { logAuditEvent } from 'src/utils/auditLogger';
import { prisma } from 'src/db';
import { validateAsync } from 'src/utils/validator';

export default class AccountLinkingController extends BaseController {

  /**
   * Link a new account (Google, Facebook, etc.) to the user's profile
   */
  async linkAccount (req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new RequestError('User not authenticated', 401);
    }

    const validated = await validateAsync(req.body, accountLinkValidationRules);

    // Check if this provider is already linked
    const existingLink = await prisma.accountLink.findFirst({
      where: {
        userId,
        provider: validated.provider as AccountLinkProvider,
      },
    });

    if (existingLink) {
      throw new RequestError(
        `${validated.provider} account is already linked to your profile`,
        400
      );
    }

    // Create the account link with full OAuth metadata
    const accountLink = await prisma.accountLink.create({
      data: {
        userId,
        provider: validated.provider as AccountLinkProvider,
        providerUserId: validated.providerUserId,
        accessToken: validated.accessToken,
        refreshToken: validated.refreshToken ?? null,
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        providerEmail: validated.providerEmail ?? null,
        providerName: validated.providerName ?? null,
        metadata: validated.metadata ?? null,
      },
    });

    // Log audit event
    await logAuditEvent(userId, 'ACCOUNT_LINK', {
      entityType: 'AccountLink',
      entityId: accountLink.id,
      req,
      metadata: {
        provider: validated.provider,
      },
    });

    Resource(req, res, {
      data: {
        id: accountLink.id,
        provider: accountLink.provider,
        providerEmail: accountLink.providerEmail,
        providerName: accountLink.providerName,
        isVerified: accountLink.isVerified,
        linkedAt: accountLink.createdAt,
      }
    })
      .json()
      .status(201)
      .additional({
        status: 'success',
        message: 'Account linked successfully',
        code: 201,
      });
  };

  /**
   * Unlink an account from the user's profile by provider name
   */
  async unlinkAccount (req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new RequestError('User not authenticated', 401);
    }

    const { provider } = req.params;
    const providerValue = Array.isArray(provider) ? provider[0] : provider;

    if (!providerValue) {
      throw new RequestError('Invalid provider', 400);
    }

    // Validate provider is a valid AccountLinkProvider
    const validProviders = Object.values(AccountLinkProvider);
    if (!validProviders.includes(providerValue as AccountLinkProvider)) {
      throw new RequestError('Invalid provider', 400);
    }

    // Find the account link by provider
    const accountLink = await prisma.accountLink.findFirst({
      where: {
        userId,
        provider: providerValue as AccountLinkProvider,
      },
    });

    if (!accountLink) {
      throw new RequestError('Account link not found', 404);
    }

    // Delete the account link
    await prisma.accountLink.delete({
      where: { id: accountLink.id },
    });

    // Log audit event
    await logAuditEvent(userId, 'ACCOUNT_UNLINK', {
      entityType: 'AccountLink',
      entityId: accountLink.id,
      req,
      metadata: {
        provider: accountLink.provider,
      },
    });

    Resource(req, res, {
      data: {
        id: accountLink.id,
        provider: accountLink.provider,
        unlinkedAt: new Date(),
      }
    })
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'Account unlinked successfully',
        code: 200,
      });
  };

  /**
   * Get all linked accounts for the user
   */
  async getLinkedAccounts (req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new RequestError('User not authenticated', 401);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 15));
    const offset = (page - 1) * limit;

    const total = await prisma.accountLink.count({
      where: { userId },
    });

    const linkedAccounts = await prisma.accountLink.findMany({
      where: { userId },
      orderBy: { linkedAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        userId: true,
        provider: true,
        providerEmail: true,
        providerName: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result = Object.assign(linkedAccounts, {
      pagination: {
        perPage: limit,
        total,
        from: linkedAccounts.length ? offset + 1 : 0,
        to: linkedAccounts.length ? offset + linkedAccounts.length : 0,
      },
    });

    new AccountLinkCollection(req, res, result)
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'OK',
        code: 200,
      });
  };

  /**
   * Update access token for a linked account (for token refresh)
   */
  async updateAccountToken (req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new RequestError('User not authenticated', 401);
      }

      const { provider } = req.params;
      const providerValue = Array.isArray(provider) ? provider[0] : provider;

      if (!providerValue) {
        throw new RequestError('Invalid provider', 400);
      }

      const validProviders = Object.values(AccountLinkProvider);
      if (!validProviders.includes(providerValue as AccountLinkProvider)) {
        throw new RequestError('Invalid provider', 400);
      }

      const { accessToken, refreshToken, expiresAt } = req.body;

      if (!accessToken || typeof accessToken !== 'string') {
        throw new RequestError('Access token is required', 400);
      }

      const accountLink = await prisma.accountLink.findFirst({
        where: {
          userId,
          provider: providerValue as AccountLinkProvider,
        },
      });

      if (!accountLink) {
        throw new RequestError('Account link not found', 404);
      }

      const updateData: Record<string, any> = { accessToken };
      if (refreshToken !== undefined) {
        updateData.refreshToken = refreshToken;
      }
      if (expiresAt !== undefined) {
        const expiresAtDate = new Date(expiresAt);
        if (Number.isNaN(expiresAtDate.getTime())) {
          throw new RequestError('Invalid expiresAt value', 400);
        }
        updateData.expiresAt = expiresAtDate;
      }

      const updated = await prisma.accountLink.update({
        where: { id: accountLink.id },
        data: updateData,
      });

      new AccountLinkResource(req, res, updated)
        .json()
        .status(200)
        .additional({
          status: 'success',
          message: 'Access token updated successfully',
          code: 200,
        });
    } catch (error) {
      if (error instanceof RequestError) {
        return res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      throw error;
    }
  };

  /**
   * Check if a specific provider is linked
   */
  async checkProviderLinked (req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new RequestError('User not authenticated', 401);
      }

      const { provider } = req.params;
      const providerValue = Array.isArray(provider) ? provider[0] : provider;

      if (!providerValue) {
        throw new RequestError('Invalid provider', 400);
      }

      // Validate provider is a valid AccountLinkProvider
      const validProviders = Object.values(AccountLinkProvider);
      if (!validProviders.includes(providerValue as AccountLinkProvider)) {
        throw new RequestError('Invalid provider', 400);
      }

      const accountLink = await prisma.accountLink.findFirst({
        where: {
          userId,
          provider: providerValue as AccountLinkProvider,
        },
      });

      if (!accountLink) {
        throw new RequestError('Account link not found', 404);
      }

      const responseData = {
        userId: accountLink.userId,
        provider: accountLink.provider,
        providerUserId: accountLink.providerUserId,
        providerEmail: accountLink.providerEmail,
        providerName: accountLink.providerName,
        isVerified: accountLink.isVerified,
        linkedAt: accountLink.linkedAt,
        unlinkedAt: accountLink.unlinkedAt,
        accessToken: accountLink.accessToken ? '***' : undefined,
        refreshToken: accountLink.refreshToken ? '***' : undefined,
        expiresAt: accountLink.expiresAt,
      };

      Resource(req, res, { data: responseData })
        .json()
        .status(200)
        .additional({
          status: 'success',
          message: 'Account link retrieved',
          code: 200,
        });
    } catch (error) {
      if (error instanceof RequestError) {
        return res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      throw error;
    }
  };

  /**
   * Check if a provider account (by providerUserId) is available to link
   * Distinguishes between "already linked to you" and "linked by another user"
   */
  async checkAvailability (req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new RequestError('User not authenticated', 401);
    }

    const validated = await validateAsync(req.body, checkAvailabilityValidationRules);

    const existingLink = await prisma.accountLink.findFirst({
      where: {
        provider: validated.provider as AccountLinkProvider,
        providerUserId: validated.providerUserId,
      },
    });

    if (!existingLink) {
      return Resource(req, res, {
        data: {
          available: true,
          provider: validated.provider,
          providerUserId: validated.providerUserId,
        }
      })
        .json()
        .status(200)
        .additional({
          status: 'success',
          message: 'Provider account is available',
          code: 200,
        });
    }

    if (existingLink.userId === userId) {
      return Resource(req, res, {
        data: {
          available: false,
          reason: 'already_linked_to_you',
          provider: validated.provider,
          providerUserId: validated.providerUserId,
        }
      })
        .json()
        .status(200)
        .additional({
          status: 'success',
          message: 'Provider account is already linked to your profile',
          code: 200,
        });
    }

    return Resource(req, res, {
      data: {
        available: false,
        reason: 'linked_by_another_user',
        provider: validated.provider,
        providerUserId: validated.providerUserId,
      }
    })
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'Provider account is already linked by another user',
        code: 200,
      });
  };

  /**
   * Verify an account link (mark isVerified = true)
   */
  async verifyAccountLink (req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new RequestError('User not authenticated', 401);
    }

    const validated = await validateAsync(req.body, accountLinkVerifyValidationRules);

    const accountLink = await prisma.accountLink.findFirst({
      where: {
        userId,
        provider: validated.provider as AccountLinkProvider,
      },
    });

    if (!accountLink) {
      throw new RequestError('Account link not found', 404);
    }

    if (accountLink.isVerified) {
      throw new RequestError('Account link is already verified', 400);
    }

    const updated = await prisma.accountLink.update({
      where: { id: accountLink.id },
      data: { isVerified: true },
    });

    await logAuditEvent(userId, 'ACCOUNT_LINK', {
      entityType: 'AccountLink',
      entityId: accountLink.id,
      req,
      metadata: {
        provider: validated.provider,
        action: 'verified',
      },
    });

    Resource(req, res, {
      data: {
        id: updated.id,
        provider: updated.provider,
        isVerified: updated.isVerified,
        updatedAt: updated.updatedAt,
      }
    })
      .json()
      .status(200)
      .additional({
        status: 'success',
        message: 'Account link verified successfully',
        code: 200,
      });
  };
}
