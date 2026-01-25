import { Request, Response } from "express";
import BaseController from "../BaseController";
import { CuratorVerificationService } from "../../services/CuratorVerificationService";
import { VerificationStatus } from "@prisma/client";
import Resource from '../../resources/index';
import { validate } from "../../utils/validator";
import { RequestError } from "../../utils/errors";

export default class AdminCuratorVerificationController extends BaseController {
    index = async (req: Request, res: Response) => {
        const { page, limit, status, submittedAfter, submittedBefore } = validate(req.query, {
            page: 'nullable|integer|min:1',
            limit: 'nullable|integer|min:1|max:100',
            status: 'nullable|string|in:PENDING,VERIFIED,REJECTED',
            submittedAfter: 'nullable|date',
            submittedBefore: 'nullable|date'
        });

        const result = await CuratorVerificationService.listPendingApplications(
            page || 1,
            limit || 15,
            {
                status: status as VerificationStatus | undefined,
                submittedAfter,
                submittedBefore
            }
        );

        Resource(req, res, {
            data: result.applications,
            pagination: result.pagination
        })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'OK',
                code: 200
            });
    }

    show = async (req: Request, res: Response) => {
        const applicationId = String(req.params.id);

        const application = await CuratorVerificationService.getApplicationById(
            applicationId,
            req.user?.id
        );

        Resource(req, res, { data: application })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'OK',
                code: 200
            });
    }

    approve = async (req: Request, res: Response) => {
        const applicationId = String(req.params.id);

        const { notes } = validate(req.body, {
            notes: 'nullable|string|max:1000'
        });

        const application = await CuratorVerificationService.reviewApplication({
            applicationId,
            adminId: req.user?.id!,
            status: VerificationStatus.VERIFIED,
            notes
        });

        Resource(req, res, { data: application })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Application approved successfully',
                code: 200
            });
    }

    reject = async (req: Request, res: Response) => {
        const applicationId = String(req.params.id);

        const { reason } = validate(req.body, {
            reason: 'required|string|min:10|max:1000'
        });

        const application = await CuratorVerificationService.reviewApplication({
            applicationId,
            adminId: req.user?.id!,
            status: VerificationStatus.REJECTED,
            notes: reason
        });

        Resource(req, res, { data: application })
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Application rejected',
                code: 200
            });
    }
}
