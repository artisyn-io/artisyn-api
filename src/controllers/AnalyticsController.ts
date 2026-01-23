import { Request, Response } from 'express';

import { ApiResource } from '../resources/index';
import AnalyticsEventCollection from '../resources/AnalyticsEventCollection';
import AnalyticsSummaryResource from '../resources/AnalyticsSummaryResource';
import AnalyticsService from '../resources/AnalyticsService';
import BaseController from './BaseController';
import { EventType } from '@prisma/client';

/**
 * AnalyticsController
 * Exposes API endpoints for retrieving analytics data
 * Implements filtering, pagination, and aggregation capabilities
 */
export default class extends BaseController {
    /**
     * Get all analytics events with filtering and pagination
     * GET /api/admin/analytics
     * 
     * @param req 
     * @param res 
     */
    index = async (req: Request, res: Response) => {
        const { take, skip, meta } = this.pagination(req);

        const eventType = req.query.eventType as EventType | undefined;
        const startDate = req.query.startDate
            ? new Date(req.query.startDate as string)
            : undefined;
        const endDate = req.query.endDate
            ? new Date(req.query.endDate as string)
            : undefined;
        const endpoint = req.query.endpoint as string | undefined;

        const { events, total } = await AnalyticsService.getEvents({
            eventType,
            startDate,
            endDate,
            endpoint,
            take,
            skip,
        });

        ApiResource(new AnalyticsEventCollection(req, res, {
            data: events,
            pagination: meta(total, events.length)
        }))
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Analytics events retrieved successfully',
                code: 200,
            });
    };

    /**
     * Get analytics summary/dashboard
     * GET /api/admin/analytics/summary
     * 
     * @param req 
     * @param res 
     */
    summary = async (req: Request, res: Response) => {
        const startDate = req.query.startDate
            ? new Date(req.query.startDate as string)
            : undefined;
        const endDate = req.query.endDate
            ? new Date(req.query.endDate as string)
            : undefined;

        const summaryData = await AnalyticsService.getSummary({ startDate, endDate });

        ApiResource(new AnalyticsSummaryResource(req, res, {
            data: summaryData,
        }))
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Analytics summary retrieved successfully',
                code: 200,
            });
    };

    /**
     * Get aggregated reports
     * GET /api/admin/analytics/aggregations
     * 
     * @param req 
     * @param res 
     */
    aggregations = async (req: Request, res: Response) => {
        const periodType = req.query.periodType as string | undefined;
        const eventType = req.query.eventType as EventType | undefined;
        const startDate = req.query.startDate
            ? new Date(req.query.startDate as string)
            : undefined;
        const endDate = req.query.endDate
            ? new Date(req.query.endDate as string)
            : undefined;

        const aggregations = await AnalyticsService.getAggregations({
            periodType,
            eventType,
            startDate,
            endDate,
        });

        ApiResource(new AnalyticsEventCollection(req, res, {
            data: aggregations,
        }))
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Analytics aggregations retrieved successfully',
                code: 200,
            });
    };

    /**
     * Trigger aggregation generation
     * POST /api/admin/analytics/aggregate
     * 
     * @param req 
     * @param res 
     */
    create = async (req: Request, res: Response) => {
        const periodType = (req.body.periodType || 'daily') as
            | 'hourly'
            | 'daily'
            | 'weekly'
            | 'monthly';

        const result = await AnalyticsService.generateAggregation(periodType);

        ApiResource(new AnalyticsSummaryResource(req, res, {
            data: result,
        }))
            .json()
            .status(201)
            .additional({
                status: 'success',
                message: `${periodType} aggregation generated successfully`,
                code: 201,
            });
    };

    /**
     * Clean up old analytics data (GDPR compliance)
     * DELETE /api/admin/analytics/cleanup
     * 
     * @param req 
     * @param res 
     */
    delete = async (req: Request, res: Response) => {
        const retentionDays = parseInt(req.query.retentionDays as string) || 90;

        const result = await AnalyticsService.cleanupOldData(retentionDays);

        ApiResource(new AnalyticsSummaryResource(req, res, {
            data: result,
        }))
            .json()
            .status(202)
            .additional({
                status: 'success',
                message: `Analytics data older than ${retentionDays} days cleaned up`,
                code: 202,
            });
    };

    /**
     * Get available event types for filtering
     * GET /api/admin/analytics/event-types
     * 
     * @param req 
     * @param res 
     */
    eventTypes = async (req: Request, res: Response) => {
        ApiResource(new AnalyticsSummaryResource(req, res, {
            data: Object.values(EventType),
        }))
            .json()
            .status(200)
            .additional({
                status: 'success',
                message: 'Event types retrieved successfully',
                code: 200,
            });
    };
}
