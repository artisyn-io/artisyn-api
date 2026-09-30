import { Request, Response } from "express";
import { RequestError, ValidationError } from "src/utils/errors";
import { differenceInMinutes, addMinutes } from "date-fns";
import { generateAccessToken, secureOtp, hashOtp, verifyOtpHash } from "src/utils/helpers";

import BaseController from "src/controllers/BaseController";
import { EventType } from '@prisma/client';
import { IUser } from "src/models/interfaces";
import { Password } from "simple-body-validator";
import { UAParser } from 'ua-parser-js';
import UserResource from "src/resources/UserResource";
import argon2 from 'argon2';
import base64url from "base64url";
import { config } from "src/config";
import { prisma } from 'src/db';
import { sendMail } from "src/mailer/mailer";
import { trackBusinessEvent } from 'src/utils/analyticsMiddleware';

/**
 * RegisterController
 */
export default class extends BaseController {
    /**
     * Create a new resource in the database
     * 
     * The calling route must recieve a multer.RequestHandler instance
     * 
     * @example router.post('/users', upload.none(), new AdminController().create);
     * 
     * @param req 
     * @param res 
     */
    create = async (req: Request, res: Response) => {
        const formData = await this.validateAsync(req, {
            firstName: 'required|string',
            lastName: 'required|string',
            email: 'required|email|unique:user',
            type: 'nullable|string|in:finder,curator',
            experience: 'nullable|required_if:type,curator|integer|min:0',
            specialties: 'nullable|required_if:type,curator|array',
            'specialties.*': 'required|string',
            password: [
                Password.create()
                    .min(8).letters()
                    .numbers()
                    .symbols(1)
                    .mixedCase(1)
                    .rules(['required', 'confirmed'])
            ],
        });

        formData.password = await argon2.hash(formData.password)
        const otp = secureOtp();
        const otpHash = hashOtp(otp);
        const expiresAt = addMinutes(new Date(), 15); // 15 minutes expiry

        /**
         * Create the user account
         */
        const data = await prisma.user.create({
            data: Object.assign({}, formData, {
                emailVerificationCode: otpHash,
                emailVerificationExpiresAt: expiresAt,
                emailVerificationAttemptCount: 0,
                emailVerificationConsumedAt: null,
                emailVerificationRevokedAt: null,
                emailVerificationResendAt: addMinutes(new Date(), 1), // 1 minute resend cooldown
                updatedAt: new Date(),
                type: undefined,
                experience: undefined,
                specialties: undefined,
                curator: formData.type === 'curator' ? {
                    create: {
                        specialties: formData.specialties,
                        experience: formData.experience,
                    }
                } : undefined
            }),
            include: {
                curator: formData.type === 'curator'
            }
        })

        const { device, ua } = UAParser(req.headers['user-agent']);
        const { token, jwt } = generateAccessToken({ username: data.email, id: data.id, index: Math.random() });

        await prisma.personalAccessToken.create({
            data: {
                token,
                name: `${device.type ?? ua.split('/').at(0)} ${device.model ?? ua.split('/').at(-1)}`,
                userId: data.id,
                expiresAt: addMinutes(new Date(), 60), // fallback if jwt.exp missing
            }
        })

        await this.#sendMail(otp, data)

        // Track user signup for analytics
        trackBusinessEvent(EventType.USER_SIGNUP, data.id, {
            isCurator: formData.type === 'curator',
        });

        new UserResource(req, res, data).json()
            .status(201)
            .additional({
                status: 'success',
                message: 'Congratulations, your registration has been completed successfully.',
                code: 201,
                token,
            });
    }

    update = async (req: Request, res: Response) => {
        const { code, resend } = this.validate(req, {
            code: 'required_unless:resend,true|string',
            resend: 'required_without:code|boolean',
        });

        if (resend) {
            return this.#resend(req, res)
        }

        if (req.user?.emailVerifiedAt) {
            throw new RequestError("Your account is already verified.", 429);
        }

        // Check if code is expired
        if (req.user?.emailVerificationExpiresAt && new Date() > req.user.emailVerificationExpiresAt) {
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided has expired.']
            });
        }

        // Check if code was already consumed
        if (req.user?.emailVerificationConsumedAt) {
            throw new ValidationError("Verification failed", {
                code: ['This verification code has already been used.']
            });
        }

        // Check if code was revoked
        if (req.user?.emailVerificationRevokedAt) {
            throw new ValidationError("Verification failed", {
                code: ['This verification code has been revoked.']
            });
        }

        // Check max attempts
        if ((req.user?.emailVerificationAttemptCount ?? 0) >= 5) {
            throw new ValidationError("Too many attempts", {
                code: ['Too many verification attempts. Please request a new code.']
            });
        }

        // Verify the OTP hash using constant-time comparison
        let valid = false
        if (req.user?.emailVerificationCode) {
            valid = verifyOtpHash(code, req.user.emailVerificationCode)
        }

        if (!valid) {
            // Increment attempt count
            await prisma.user.update({
                where: { id: req.user?.id },
                data: {
                    emailVerificationAttemptCount: {
                        increment: 1
                    }
                }
            });
            
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided is invalid.']
            });
        }

        // Consume the code atomically
        const updatedUser = await prisma.user.update({
            where: { id: req.user?.id },
            data: {
                emailVerifiedAt: new Date(),
                emailVerificationConsumedAt: new Date(),
                emailVerificationCode: null,
                emailVerificationExpiresAt: null,
                emailVerificationAttemptCount: 0,
            },
        })

        new UserResource(req, res, updatedUser).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Congratulations, your account has now been verified successfully.',
                code: 202,
            });
    }

    #resend = async (req: Request, res: Response) => {
        // Check resend cooldown
        if (req.user?.emailVerificationResendAt && new Date() < req.user.emailVerificationResendAt) {
            const waitSeconds = Math.ceil((req.user.emailVerificationResendAt.getTime() - Date.now()) / 1000);
            throw new ValidationError("Please wait before resending", {
                resend: [`Please wait ${waitSeconds} seconds before requesting a new code.`]
            });
        }

        const otp = secureOtp();
        const otpHash = hashOtp(otp);
        const expiresAt = addMinutes(new Date(), 15);
        const resendCooldown = addMinutes(new Date(), 1);

        const data = await prisma.user.update({
            where: { id: req.user?.id },
            data: {
                emailVerificationCode: otpHash,
                emailVerificationExpiresAt: expiresAt,
                emailVerificationAttemptCount: 0,
                emailVerificationConsumedAt: null,
                emailVerificationRevokedAt: null,
                emailVerificationResendAt: resendCooldown,
            },
        })

        await this.#sendMail(otp, data)

        new UserResource(req, res, data).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Verification code resent successfully.',
                code: 202,
            });
    }

    #sendMail = async (otp: string, data: Omit<IUser, 'curator' | 'media'>) => {
        const hashBuffer = await argon2.hash(otp); // Buffer
        const hashEncoded = base64url.encode(hashBuffer); // URL-safe string
        const link = `${config('app.front_url')}/account/verify/email?token=${hashEncoded.split('|').at(-1)}`

        sendMail({
            to: data?.email!,
            subject: 'Verify your account',
            text: `
                Hi <b>${data.firstName}</b><br/><br/>
                Thank you for signing up! To complete your registration, please verify your email address using the code or link below:
                <hr />
                <b>Your Verification Code (OTP):</b>
                <h3 style="text-align:center;">${otp}</h3>
                Or click the link below to verify instantly:
            `,
            credits: `If you didn't request this, you can safely ignore this email.<br/>
                Thanks,<br/>
                The ${config('app.name')} Team`,
            data: { ...data, link, linkTitle: 'Verify Account' }
        })
    }
}