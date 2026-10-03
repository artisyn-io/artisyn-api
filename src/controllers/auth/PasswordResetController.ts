import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { EventType } from '@prisma/client';
import { IUser } from "src/models/interfaces";
import { Password } from "simple-body-validator";
import Resource from 'src/resources/index';
import UserResource from "src/resources/UserResource";
import { ValidationError } from "src/utils/errors";
import argon2 from 'argon2';
import base64url from "base64url";
import { config } from "src/config";
import { addMinutes } from "date-fns";
import { prisma } from 'src/db';
import { secureOtp, hashOtp, verifyOtpHash } from "src/utils/helpers";
import { sendMail } from "src/mailer/mailer";
import { trackBusinessEvent } from 'src/utils/analyticsMiddleware';

/**
 * PasswordResetController
 */
export default class extends BaseController {
    create = async (req: Request, res: Response) => {
        const { email } = this.validate(req, {
            email: 'required|string',
        });
        const startedAt = Date.now();
        const normalizedEmail = String(email).trim().toLowerCase();
        const otp = secureOtp();
        const codeHash = hashOtp(otp);
        const now = new Date();
        const linkHash = await argon2.hash(otp);

        const user = await prisma.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
        });

        if (user) {
            const resendAt = addMinutes(now, 1);
            let issued = false;
            await prisma.$transaction(async (tx) => {
                const cooldown = await tx.user.updateMany({
                    where: {
                        id: user.id,
                        OR: [
                            { passwordResetResendAt: null },
                            { passwordResetResendAt: { lte: now } },
                        ],
                    },
                    data: { passwordResetResendAt: resendAt },
                });
                if (cooldown.count !== 1) return;

                await tx.passwordCodeResets.updateMany({
                    where: { email: normalizedEmail, purpose: 'password_reset', consumedAt: null, revokedAt: null },
                    data: { revokedAt: now },
                });
                await tx.passwordCodeResets.create({
                    data: {
                        code: codeHash,
                        email: normalizedEmail,
                        purpose: 'password_reset',
                        expiresAt: addMinutes(now, 15),
                        attemptCount: 0,
                        ipAddress: req.ip,
                    },
                });
                issued = true;
            });

            if (issued) {
                void trackBusinessEvent(EventType.PASSWORD_RESET_REQUESTED, user.id, { via: 'email' }).catch(() => undefined);
                await this.#sendMail(otp, user, linkHash).catch(() => undefined);
            }
        }

        // Bound the obvious account-existence timing difference. Delivery is
        // intentionally not awaited by #sendMail, so this is a minimum response time.
        const remainingDelay = 500 - (Date.now() - startedAt);
        if (remainingDelay > 0) await new Promise((resolve) => setTimeout(resolve, remainingDelay));

        return Resource(req, res, {}).json()
            .status(201)
            .additional({
                status: 'success',
                message: 'We have sent instructions to help recover your account to your email address.',
                code: 201,
            });
    }

    update = async (req: Request, res: Response) => {
        const { code, email, password } = this.validate(req, {
            email: 'required|string',
            code: 'required|string',
            password: ['nullable', Password.create().min(8).letters().numbers().symbols(1).mixedCase(1).rules(['required', 'confirmed'])]
        });

        const normalizedEmail = String(email).trim().toLowerCase();
        const now = new Date();
        const check = await prisma.passwordCodeResets.findFirst({
            where: {
                email: normalizedEmail,
                purpose: 'password_reset',
                consumedAt: null,
                revokedAt: null,
                expiresAt: { gt: now },
                attemptCount: { lt: 5 },
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!check) {
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided is invalid or has expired.']
            });
        }

        // Verify candidate code using constant-time comparison
        const valid = verifyOtpHash(code, check.code);

        if (!valid) {
            await prisma.passwordCodeResets.updateMany({
                where: {
                    id: check.id,
                    email: normalizedEmail,
                    purpose: 'password_reset',
                    consumedAt: null,
                    revokedAt: null,
                    expiresAt: { gt: now },
                    attemptCount: { lt: 5 },
                },
                data: { attemptCount: { increment: 1 } },
            });
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided is invalid or has expired.']
            });
        }

        const passwordHash = password ? await argon2.hash(password) : undefined;
        let changedUser: Awaited<ReturnType<typeof prisma.user.update>> | undefined;
        const consumed = await prisma.$transaction(async (tx) => {
            const consumeResult = await tx.passwordCodeResets.updateMany({
                where: {
                    id: check.id,
                    email: normalizedEmail,
                    purpose: 'password_reset',
                    consumedAt: null,
                    revokedAt: null,
                    expiresAt: { gt: now },
                    attemptCount: { lt: 5 },
                },
                data: { consumedAt: now },
            });
            if (consumeResult.count !== 1) return false;

            if (passwordHash) {
                changedUser = await tx.user.update({
                    where: { id: (await tx.user.findFirstOrThrow({
                        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
                        select: { id: true },
                    })).id },
                    data: { password: passwordHash },
                });
                await tx.passwordCodeResets.updateMany({
                    where: {
                        email: normalizedEmail,
                        purpose: 'password_reset',
                        id: { not: check.id },
                        consumedAt: null,
                        revokedAt: null,
                    },
                    data: { revokedAt: now },
                });
            }
            return true;
        });

        if (!consumed) {
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided is invalid or has expired.']
            });
        }

        if (changedUser) {
            return new UserResource(req, res, changedUser).json()
                .status(202)
                .additional({
                    status: 'success',
                    message: 'Congratulations, your account password has now been reset successfully, you can proceed to login.',
                    code: 202,
                });
        }

        Resource(req, res, {}).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Verification code is valid',
                code: 202,
            });
    }

    #sendMail = async (otp: string, data: Omit<IUser, 'curator' | 'media'>, hashBuffer: string) => {
        const hashEncoded = base64url.encode(hashBuffer); // URL-safe string
        const link = `${config('app.front_url')}/account/password/reset?token=${hashEncoded.split('|').at(-1)}`

        sendMail({
            to: data?.email!,
            subject: 'Reset Password',
            text: `
                Hi <b>${data.firstName}</b><br/><br/>
                We received a request to reset your password.  <br/>
                Use the code below or click the link to set a new password:
                <hr />
                <b>🔑 Reset Code:</b>
                <h3 style="text-align:center;">${otp}</h3>
                Or click the link below to reset your password:
            `,
            credits: `If you didn’t request this, you can safely ignore this email.<br/>
                Thanks,<br/>
                The ${config('app.name')} Team`,
            data: { ...data, link, linkTitle: 'Reset Password' }
        })
    }
}
