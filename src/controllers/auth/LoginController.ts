import { Request, Response } from "express";

import BaseController from "src/controllers/BaseController";
import { EventType } from '@prisma/client';
import { UAParser } from "ua-parser-js";
import UserResource from "src/resources/UserResource";
import { ValidationError } from "src/utils/errors";
import argon2 from 'argon2';
import { constructFrom } from "date-fns";
import { generateAccessToken } from "src/utils/helpers";
import { prisma } from 'src/db';
import { trackBusinessEvent } from 'src/utils/analyticsMiddleware';
import { verifySecondFactor } from 'src/services/TwoFactorService';

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
        const formData = this.validate(req, {
            email: 'required|email',
            password: 'required'
        });

        const user = await prisma.user.findFirst({
            where: {
                email: formData.email,
            },
        })

        if (!user) {
            // Track failed login attempt
            await trackBusinessEvent(EventType.LOGIN_FAILED, undefined, {
                method: 'email',
                email: formData.email,
                reason: 'user_not_found',
            });

            throw new ValidationError("Login failed", {
                email: ['Invalid email address or password']
            });
        }

        const verify = await argon2.verify(user?.password!, formData.password)

        if (!verify) {
            // Track failed login attempt (wrong password)
            await trackBusinessEvent(EventType.LOGIN_FAILED, user.id, {
                method: 'email',
                email: formData.email,
                reason: 'invalid_password',
            });

            throw new ValidationError("Login failed", {
                email: ['Invalid email address or password']
            });
        }

        // Enforce the second factor when TOTP 2FA has been confirmed
        if (user.twoFactorEnabled) {
            const { otp, recoveryCode } = req.body ?? {};

            if (!otp && !recoveryCode) {
                throw new ValidationError("Two-factor authentication required", {
                    otp: ['An authentication code or recovery code is required'],
                });
            }

            if (!(await verifySecondFactor(user, { otp, recoveryCode }))) {
                await trackBusinessEvent(EventType.LOGIN_FAILED, user.id, {
                    method: 'email',
                    email: formData.email,
                    reason: 'invalid_second_factor',
                });

                throw new ValidationError("Login failed", {
                    otp: ['Invalid or expired authentication code'],
                });
            }
        }

        const { device, ua } = UAParser(req.headers['user-agent']);
        const { token, jwt } = generateAccessToken({ username: user?.email!, id: user?.id!, index: Math.random() });
        const deviceName = `${device.type ?? ua.split('/').at(0)} ${device.model ?? ua.split('/').at(-1)}`

        await prisma.personalAccessToken.create({
            data: {
                token,
                name: ['', ' '].includes(deviceName) ? 'Unknown Device' : deviceName,
                userId: user?.id!,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                lastUsedAt: new Date(),
                expiresAt: constructFrom(jwt.exp!, new Date),
            }
        })

        // Track user login for analytics
        trackBusinessEvent(EventType.USER_LOGIN, user?.id, {
            method: 'email',
        });

        new UserResource(req, res, user).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Login Successful.',
                code: 202,
                token,
            });
    }
    /**
     * Authorize an OAuth Login request
     * 
     * @param req 
     * @param res 
     */
    oauth = async (req: Request, res: Response) => {
        const type = String(req.params.type)

        const { device, ua } = UAParser(req.headers['user-agent']);
        const { token, jwt } = generateAccessToken({ username: req.user?.email!, id: req.user?.id!, index: Math.random() });

        await prisma.personalAccessToken.create({
            data: {
                token,
                name: `${device.type ?? ua.split('/').at(0)} ${device.model ?? ua.split('/').at(-1)}`,
                userId: req.user?.id!,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                lastUsedAt: new Date(),
                expiresAt: constructFrom(jwt.exp!, new Date),
            }
        })

        // Track OAuth login for analytics
        trackBusinessEvent(EventType.USER_LOGIN, req.user?.id, {
            method: 'oauth',
            provider: type,
        });

        new UserResource(req, res, req.user).json()
            .status(202)
            .additional({
                status: 'success',
                message: type.titleCase() + ' Login Successful.',
                code: 202,
                token,
            });
    }

    delete = async (req: Request, res: Response) => {
        await prisma.personalAccessToken.delete({ where: { token: req.authToken } })

        new UserResource(req, res, req.user).json()
            .status(202)
            .additional({
                status: 'success',
                message: 'Session closed successfully.',
                code: 202,
            });
    }
}
