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

    if (existingLink && !existingLink.unlinkedAt) {
      throw new RequestError(
        `${validated.provider} account is already linked to your profile`,
        409
      );
    }

    let accountLink;
    if (existingLink) {
      // Relink previously unlinked account
      accountLink = await prisma.accountLink.update({
        where: { id: existingLink.id },
        data: {
          providerUserId: validated.providerUserId,
          accessToken: validated.accessToken,
          refreshToken: validated.refreshToken ?? null,
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
          providerEmail: validated.providerEmail ?? null,
          providerName: validated.providerName ?? null,
          metadata: validated.metadata ?? null,
          unlinkedAt: null, // Clear unlinkedAt to relink
          isVerified: false, // Reset verification on relink
        },
      });
    } else {
      // Create new account link
      accountLink = await prisma.accountLink.create({
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
    }

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
      .status(202)
      .additional({
        status: 'success',
        message: 'Account linked successfully',
        code: 202,
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

    if (accountLink.unlinkedAt) {
      throw new RequestError('Account is already unlinked', 400);
    }

    // Update the account link to mark as unlinked
    const updatedLink = await prisma.accountLink.update({
      where: { id: accountLink.id },
      data: { unlinkedAt: new Date() },
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
        unlinkedAt: updatedLink.unlinkedAt,
      }
    })
      .json()
      .status(202)
      .additional({
        status: 'success',
        message: 'Account unlinked successfully',
        code: 202,
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

    const linkedAccounts = await prisma.accountLink.findMany({
      where: { 
        userId,
        unlinkedAt: null, // Only return active links
      },
      select: {
        id: true,
        provider: true,
        providerEmail: true,
        providerName: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    Resource(req, res, {
      data: linkedAccounts
    })
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

      const { id } = req.params;
      const accountId = Array.isArray(id) ? id[0] : id;

      if (!accountId) {
        throw new RequestError('Invalid account link ID', 400);
      }

      const { accessToken } = req.body;

      if (!accessToken) {
        throw new RequestError('Access token is required', 400);
      }

      // Find and verify ownership
      const accountLink = await prisma.accountLink.findFirst({
        where: {
          id: accountId,
          userId,
        },
      });

      if (!accountLink) {
        throw new RequestError('Account link not found', 404);
      }

      // Update the token
      const updated = await prisma.accountLink.update({
        where: { id: accountId },
        data: { accessToken },
      });

      res.status(200).json({
        status: 'success',
        message: 'Access token updated successfully',
        data: {
          id: updated.id,
          provider: updated.provider,
        },
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

      res.status(200).json({
        status: 'success',
        data: {
          provider: providerValue,
          isLinked: !!accountLink,
          linkedAt: accountLink?.createdAt || null,
        },
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
      if (existingLink.unlinkedAt) {
        // Previously unlinked by this user, available for relinking
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
            message: 'Provider account is available for relinking',
            code: 200,
          });
      } else {
        // Currently linked
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
