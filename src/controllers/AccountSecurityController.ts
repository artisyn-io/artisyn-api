import { Request, Response } from 'express';

import argon2 from 'argon2';

import BaseController from 'src/controllers/BaseController';
import { RequestError, ValidationError } from 'src/utils/errors';
import { logAuditEvent } from 'src/utils/auditLogger';
import { prisma } from 'src/db';
import { verifySecondFactor } from 'src/services/TwoFactorService';
import {
    buildOtpAuthUrl,
    decryptSecret,
    encryptSecret,
    generateRecoveryCodes,
    generateTotpSecret,
    hashRecoveryCode,
    verifyTotp,
} from 'src/utils/totp';

/**
 * AccountSecurityController
 *
 * Authenticated security operations for the settings screen:
 * password change, TOTP two-factor enrollment and session management.
 */
export default class AccountSecurityController extends BaseController {
    /**
     * PUT /api/account/password
     */
    changePassword = async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const { currentPassword, password } = req.body;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        RequestError.assertFound(user, 'User not found', 404);

        if (!(await argon2.verify(user!.password, String(currentPassword)))) {
            await logAuditEvent(userId, 'PASSWORD_CHANGE', {
                req, statusCode: 422, errorMessage: 'Invalid current password',
            });
            throw new ValidationError('Password change failed', {
                currentPassword: ['The current password is incorrect'],
            });
        }

        await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { password: await argon2.hash(password) } }),
            // Sign out every other session after a password change
            prisma.personalAccessToken.deleteMany({ where: { userId, token: { not: req.authToken } } }),
        ]);

        await logAuditEvent(userId, 'PASSWORD_CHANGE', { req, entityType: 'User', entityId: userId, statusCode: 202 });

        res.status(202).json({ data: {}, status: 'success', message: 'Password changed successfully.', code: 202 });
    };

    /**
     * POST /api/account/2fa/setup
     * Begin TOTP enrollment. 2FA is not enabled until confirmed.
     */
    beginTwoFactor = async (req: Request, res: Response) => {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        RequestError.assertFound(user, 'User not found', 404);
        RequestError.abortIf(user!.twoFactorEnabled, 'Two-factor authentication is already enabled', 409);

        const secret = generateTotpSecret();

        await prisma.user.update({
            where: { id: user!.id },
            data: { twoFactorSecret: encryptSecret(secret), twoFactorLastStep: null },
        });

        res.status(200).json({
            data: { secret, otpauthUrl: buildOtpAuthUrl(secret, user!.email) },
            status: 'success',
            message: 'Scan the secret with your authenticator app and confirm with a code.',
            code: 200,
        });
    };

    /**
     * POST /api/account/2fa/confirm
     * Confirm enrollment with a valid TOTP code; returns recovery codes once.
     */
    confirmTwoFactor = async (req: Request, res: Response) => {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        RequestError.abortIf(!user?.twoFactorSecret, 'Two-factor setup has not been started', 400);
        RequestError.abortIf(user!.twoFactorEnabled, 'Two-factor authentication is already enabled', 409);

        const step = verifyTotp(decryptSecret(user!.twoFactorSecret!), String(req.body.code), user!.twoFactorLastStep);
        if (step === null) {
            throw new ValidationError('Invalid code', { code: ['The authentication code is invalid or expired'] });
        }

        const recoveryCodes = generateRecoveryCodes();

        await prisma.$transaction([
            prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user!.id } }),
            prisma.twoFactorRecoveryCode.createMany({
                data: recoveryCodes.map((code) => ({ userId: user!.id, codeHash: hashRecoveryCode(code) })),
            }),
            prisma.user.update({
                where: { id: user!.id },
                data: { twoFactorEnabled: true, twoFactorConfirmedAt: new Date(), twoFactorLastStep: step },
            }),
            prisma.userPreferences.updateMany({ where: { userId: user!.id }, data: { twoFactorEnabled: true } }),
        ]);

        await logAuditEvent(user!.id, 'TWO_FACTOR_ENABLE', { req, entityType: 'User', entityId: user!.id, statusCode: 200 });

        res.status(200).json({
            data: { twoFactorEnabled: true, recoveryCodes },
            status: 'success',
            message: 'Two-factor authentication enabled. Store your recovery codes safely; they will not be shown again.',
            code: 200,
        });
    };

    /**
     * POST /api/account/2fa/disable
     * Requires the current password and a TOTP or recovery code.
     */
    disableTwoFactor = async (req: Request, res: Response) => {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        RequestError.abortIf(!user?.twoFactorEnabled, 'Two-factor authentication is not enabled', 400);

        const passwordOk = await argon2.verify(user!.password, String(req.body.password ?? ''));
        const factorOk = passwordOk && await verifySecondFactor(user!, req.body);

        if (!passwordOk || !factorOk) {
            throw new ValidationError('Unable to disable two-factor authentication', {
                code: ['Invalid password or authentication code'],
            });
        }

        await prisma.$transaction([
            prisma.twoFactorRecoveryCode.deleteMany({ where: { userId: user!.id } }),
            prisma.user.update({
                where: { id: user!.id },
                data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorConfirmedAt: null, twoFactorLastStep: null },
            }),
            prisma.userPreferences.updateMany({ where: { userId: user!.id }, data: { twoFactorEnabled: false } }),
        ]);

        await logAuditEvent(user!.id, 'TWO_FACTOR_DISABLE', { req, entityType: 'User', entityId: user!.id, statusCode: 200 });

        res.status(200).json({
            data: { twoFactorEnabled: false },
            status: 'success',
            message: 'Two-factor authentication disabled.',
            code: 200,
        });
    };

    /**
     * GET /api/account/sessions
     */
    listSessions = async (req: Request, res: Response) => {
        const sessions = await prisma.personalAccessToken.findMany({
            where: { userId: req.user!.id },
            orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
        });

        res.status(200).json({
            data: sessions.map((s) => ({
                id: s.id,
                name: s.name,
                ipAddress: s.ipAddress,
                userAgent: s.userAgent,
                lastUsedAt: s.lastUsedAt,
                expiresAt: s.expiresAt,
                createdAt: s.createdAt,
                current: s.token === req.authToken,
            })),
            status: 'success',
            message: 'OK',
            code: 200,
        });
    };

    /**
     * DELETE /api/account/sessions/:id
     */
    revokeSession = async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const { count } = await prisma.personalAccessToken.deleteMany({
            where: { id: String(req.params.id), userId },
        });

        RequestError.abortIf(count === 0, 'Session not found', 404);

        await logAuditEvent(userId, 'SESSION_REVOKE', {
            req, entityType: 'PersonalAccessToken', entityId: String(req.params.id), statusCode: 202,
        });

        res.status(202).json({ data: {}, status: 'success', message: 'Session revoked.', code: 202 });
    };

    /**
     * DELETE /api/account/sessions
     * Revoke every session except the current one.
     */
    revokeOtherSessions = async (req: Request, res: Response) => {
        const userId = req.user!.id;
        const { count } = await prisma.personalAccessToken.deleteMany({
            where: { userId, token: { not: req.authToken } },
        });

        await logAuditEvent(userId, 'SESSION_REVOKE', { req, statusCode: 202, metadata: { scope: 'others', count } });

        res.status(202).json({ data: { revoked: count }, status: 'success', message: 'Other sessions revoked.', code: 202 });
    };
}
