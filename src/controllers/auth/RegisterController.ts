import { Request, Response, response } from "express";
import { RequestError, ValidationError } from "src/utils/errors";
import { constructFrom, differenceInMinutes } from "date-fns";
import { generateAccessToken, secureOtp } from "src/utils/helpers";

import { ApiResource } from 'src/resources/index';
import BaseController from "src/controllers/BaseController";
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
import { EventType } from '@prisma/client';

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

        /**
         * Create the user account
         */
        const data = await prisma.user.create({
            data: Object.assign({}, formData, {
                emailVerificationCode: otp,
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
                expiresAt: constructFrom(jwt.exp!, new Date),
            }
        })

        await this.#sendMail(otp, data)

        // Track user signup for analytics
        trackBusinessEvent(EventType.USER_SIGNUP, data.id, {
            isCurator: formData.type === 'curator',
        });

        ApiResource(new UserResource(req, res, data)).json()
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

        let valid = false

        try {
            valid = await argon2.verify(base64url.decode(code), req.user?.emailVerificationCode!)
        } catch { }

        if (
            differenceInMinutes(new Date(), req.user?.updatedAt!) > 5 ||
            (code !== req.user?.emailVerificationCode && !valid)
        ) {
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided may have expired.']
            });
        }

        const data = await prisma.user.update({
            where: { id: req.user?.id },
            data: {
                updatedAt: new Date(),
                emailVerifiedAt: new Date(),
            },
        })

        ApiResource(new UserResource(req, res, data)).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Congratulations, your account has now been verified successfully.',
                code: 202,
            });
    }

    #resend = async (req: Request, res: Response) => {
        const otp = secureOtp();

        const data = await prisma.user.update({
            where: { id: req.user?.id },
            data: {
                emailVerificationCode: otp,
                updatedAt: new Date()
            },
        })

        await this.#sendMail(otp, data)

        ApiResource(new UserResource(req, res, data)).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Verification code resent successfully.',
                code: 202,
            });
    }

    #sendMail = async (otp: string, data: Omit<IUser, 'curator'>) => {
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
            credits: `If you didn’t request this, you can safely ignore this email.<br/>
                Thanks,<br/>
                The ${config('app.name')} Team`,
            data: { ...data, link, linkTitle: 'Verify Account' }
        })
    }
}
