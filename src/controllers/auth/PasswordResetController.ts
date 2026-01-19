import { Request, Response } from "express";
import { RequestError, ValidationError } from "src/utils/errors";

import { ApiResource } from 'src/resources/index';
import BaseController from "src/controllers/BaseController";
import { IUser } from "src/models/interfaces";
import { Password } from "simple-body-validator";
import Resource from 'src/resources/index';
import UserResource from "src/resources/UserResource";
import argon2 from 'argon2';
import base64url from "base64url";
import { config } from "src/config";
import { differenceInMinutes } from "date-fns";
import { prisma } from 'src/db';
import { secureOtp } from "src/utils/helpers";
import { sendMail } from "src/mailer/mailer";

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
        const { email } = this.validate(req, {
            email: 'required|string',
        });

        const code = secureOtp();

        const user = await prisma.user.findFirst({
            where: { email }
        })

        if (!user) {
            throw new ValidationError("Account Not Found", {
                email: ['We were unable to find your account.']
            });
        }

        await prisma.passwordCodeResets.deleteMany({
            where: { OR: [{ email }, { phone: email }] }
        })

        await prisma.passwordCodeResets.create({
            data: { code, email }
        })

        await this.#sendMail(code, user)

        Resource(req, res, {}).json()
            .status(201)
            .additional({
                status: 'success',
                message: 'We have sent intructions to help recover your account to your email address.',
                code: 201,
            });
    }

    update = async (req: Request, res: Response) => {
        const { code, email, password } = this.validate(req, {
            email: 'required|string',
            code: 'required|string',
            password: [Password.create().min(8).letters().numbers().symbols(1).mixedCase(1).rules(['required', 'confirmed'])]
        });

        const check = await prisma.passwordCodeResets.findFirst({
            where: {
                OR: [
                    { email },
                    { phone: email },
                ]
            }
        })

        if (!check) {
            throw new ValidationError("Something went wrong", {
                email: ['We were unable to find your account.']
            });
        }

        let valid = false

        try {
            valid = await argon2.verify(base64url.decode(code), check.code)
        } catch { }

        if (
            differenceInMinutes(new Date(), check.createdAt!) > 5 ||
            (code !== check.code && !valid)
        ) {
            throw new ValidationError("Verification failed", {
                code: ['The verification code you provided may have expired.']
            });
        }

        if (password) {
            const data = await prisma.user.update({
                where: { email },
                data: { password: await argon2.hash(password) },
            })

            await prisma.passwordCodeResets.deleteMany({
                where: { OR: [{ email }, { phone: email }] }
            })

            ApiResource(new UserResource(req, res, data)).json()
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

    #sendMail = async (otp: string, data: Omit<IUser, 'curator'>) => {
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
