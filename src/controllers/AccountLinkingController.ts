import { Request, Response } from 'express';
import { prisma } from 'src/db';
import { validateAsync } from 'src/utils/validator';
import { accountLinkValidationRules } from 'src/utils/profileValidators';
import { RequestError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { AccountLinkProvider } from '@prisma/client';

/**
 * Link a new account (Google, Facebook, etc.) to the user's profile
 */
export const linkAccount = async (req: Request, res: Response) => {
  try {
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
    await logAuditEvent(userId, 'ACCOUNT_LINKED', {
      entityType: 'AccountLink',
      entityId: accountLink.id,
      req,
      metadata: {
        provider: validated.provider,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Account linked successfully',
      data: {
        id: accountLink.id,
        provider: accountLink.provider,
        linkedAt: accountLink.createdAt,
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
 * Unlink an account from the user's profile
 */
export const unlinkAccount = async (req: Request, res: Response) => {
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
    await logAuditEvent(userId, 'ACCOUNT_UNLINKED', {
      entityType: 'AccountLink',
      entityId: accountId,
      req,
      metadata: {
        provider: accountLink.provider,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Account unlinked successfully',
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
 * Get all linked accounts for the user
 */
export const getLinkedAccounts = async (req: Request, res: Response) => {
  try {
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

    res.status(200).json({
      status: 'success',
      data: linkedAccounts,
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
 * Update access token for a linked account (for token refresh)
 */
export const updateAccountToken = async (req: Request, res: Response) => {
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
export const checkProviderLinked = async (req: Request, res: Response) => {
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