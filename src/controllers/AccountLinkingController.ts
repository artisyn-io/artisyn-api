import { Request, Response } from 'express';

import { AccountLinkProvider } from '@prisma/client';
import BaseController from './BaseController';
import { RequestError } from 'src/utils/errors';
import Resource from '../resources/index';
import { accountLinkValidationRules } from 'src/utils/profileValidators';
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

    // Create the account link
    const accountLink = await prisma.accountLink.create({
      data: {
        userId,
        provider: validated.provider as AccountLinkProvider,
        providerUserId: validated.providerUserId,
        accessToken: validated.accessToken,
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
   * Unlink an account from the user's profile
   */
  async unlinkAccount (req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      throw new RequestError('User not authenticated', 401);
    }

    const { id } = req.params;
    const accountId = Array.isArray(id) ? id[0] : id;

    if (!accountId) {
      throw new RequestError('Invalid account link ID', 400);
    }

    // Find the account link
    const accountLink = await prisma.accountLink.findFirst({
      where: {
        id: accountId,
        userId,
      },
    });

    if (!accountLink) {
      throw new RequestError('Account link not found', 404);
    }

    // Delete the account link
    await prisma.accountLink.delete({
      where: { id: accountId },
    });

    // Log audit event
    await logAuditEvent(userId, 'ACCOUNT_UNLINK', {
      entityType: 'AccountLink',
      entityId: accountId,
      req,
      metadata: {
        provider: accountLink.provider,
      },
    });

    Resource(req, res, {
      data: {
        id: accountLink.id,
        provider: accountLink.provider,
        unlinkedAt: accountLink.updatedAt,
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
      where: { userId },
      select: {
        id: true,
        provider: true,
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
}