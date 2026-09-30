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

        const user = await prisma.user.findFirst({
            where: { email }
        });

        if (!user) {
            // Timing defense to prevent email enumeration via timing side-channels
            await argon2.hash('dummy-password-timing-defense-string');

            // Return the exact same success response shape as when user exists
            return Resource(req, res, {}).json()
                .status(201)
                .additional({
                    status: 'success',
                    message: 'We have sent instructions to help recover your account to your email address.',
                    code: 201,
                });
        }

        // Track password reset request
        await trackBusinessEvent(EventType.PASSWORD_RESET_REQUESTED, user.id, {
            via: 'email',
        });

        // Invalidate/revoke prior active password reset codes transactionally
        await prisma.passwordCodeResets.updateMany({
            where: { 
                OR: [{ email }, { phone: email }],
                consumedAt: null,
                revokedAt: null
            },
            data: { revokedAt: new Date() }
        });

        const otp = secureOtp();
        const codeHash = hashOtp(otp);
        const expiresAt = addMinutes(new Date(), 15);

        await prisma.passwordCodeResets.create({
            data: {
                code: codeHash,
                email,
                purpose: 'password_reset',
                expiresAt,
                attemptCount: 0,
                ipAddress: req.ip,
            }
        });

        await this.#sendMail(otp, user);

        Resource(req, res, {}).json()
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

        const check = await prisma.passwordCodeResets.findFirst({
            where: {
                OR: [
                    { email },
                    { phone: email },
                ],
                purpose: 'password_reset',
                consumedAt: null,
                revokedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!check) {
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided is invalid or has expired.']
            });
        }

        // Check if expired
        if (check.expiresAt && new Date() > check.expiresAt) {
            await prisma.passwordCodeResets.update({
                where: { id: check.id },
                data: { revokedAt: new Date() }
            });
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided has expired.']
            });
        }

        // Check max attempts
        if (check.attemptCount >= 5) {
            await prisma.passwordCodeResets.update({
                where: { id: check.id },
                data: { revokedAt: new Date() }
            });
            throw new ValidationError("Verification failed", {
                code: ['Too many failed attempts. Please request a new code.']
            });
        }

        // Verify candidate code using constant-time comparison
        const valid = verifyOtpHash(code, check.code);

        if (!valid) {
            await prisma.passwordCodeResets.update({
                where: { id: check.id },
                data: { attemptCount: { increment: 1 } }
            });
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided is invalid.']
            });
        }

        // Consume the code atomically / transactionally (single use enforcement)
        const consumeResult = await prisma.passwordCodeResets.updateMany({
            where: {
                id: check.id,
                consumedAt: null,
                revokedAt: null
            },
            data: {
                consumedAt: new Date(),
                revokedAt: new Date()
            }
        });

        if (consumeResult.count === 0) {
            throw new ValidationError("Verification failed", {
                code: ['This verification code has already been used.']
            });
        }

        if (password) {
            const data = await prisma.user.update({
                where: { email },
                data: { password: await argon2.hash(password) },
            });

            // Invalidate any other active codes for this email
            await prisma.passwordCodeResets.updateMany({
                where: {
                    OR: [{ email }, { phone: email }],
                    consumedAt: null
                },
                data: { consumedAt: new Date(), revokedAt: new Date() }
            });

            return new UserResource(req, res, data).json()
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

    #sendMail = async (otp: string, data: Omit<IUser, 'curator' | 'media'>) => {
        const hashBuffer = await argon2.hash(otp); // Buffer
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
