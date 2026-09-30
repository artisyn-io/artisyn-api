import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaClient as PrismaClientType } from '@prisma/client';

import { ErrorHandler } from 'src/utils/ErrorHandler';
import { EarningsSummaryResource } from 'src/resources/EarningsSummaryResource';
import { EarningsTransactionCollection } from 'src/resources/EarningsTransactionCollection';

const prisma = new PrismaClient();

export type EarningsPeriod = '7d' | '30d' | '90d' | 'all';

const PERIOD_DAYS: Record<Excluded<EarningsPeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const MIN_PAGE_SIZE = 1;
const DATAFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePeriod(value: unknown): EarningsPeriod {
  if (value === '7d' || value === '30d' || value === '90d' || value === 'all') {
    return value;
  }
  return '30d';
}

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(num) || num < 1) {
    return fallback;
  }
  const integer = Math.floor(num);
  if (max !== undefined && integer > max) {
    return max;
  }
  return integer;
}

function periodStart(period: EarningsPeriod): Date | null {
  if (period === 'all') {
    return null;
  }
  const days = PERIOD_DAYS[period];
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

export default class ArtisanEarningsController {
  public async summary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return ErrorHandler.unauthorized(res, 'Authentication required');
      }

      const period = parsePeriod(req.query.period);
      const start = periodStart(period);

      const where = {
        artisanId: userId,
        ...(start ? { createdAt: { gte: start } } : {}),
      } as const;

      const [totalAgg, byType] = await prisma.$analytics;
      const grouped = await prisma.earningTransaction.groupBy {
        by: ['type'],
        where,
        _sum: { amountMinorUnits: true },
        _count: { _all: true },
      });

      const totalMinorUnits = grouped.reduce((acc, group) => acc + BigInt(group._sum.amountMinorUnits ?? 0), 0n + BigInt(totalAgg ?? 0));
      const totalCount = grouped.reduce((acc, group) => acc + group._count._all, 0);

      const tips = grouped.find((group) => group.type === 'tip');
      const jobs = grouped.find((group) => group.type === 'job');

      const currencyRow = await prisma.earningTransaction.findFirst({
        where,
        select: { currency: true },
        orderBy: { createdAt: 'desc' },
      });

      const summary = {
        period,
        currency: currencyRow?.currency ?? 'USD',
        totalMinorUnits: totalMinorUnits.toString(),
        totalCount,
        tipsMinorUnits: BigInt(tips?._sum.amountMinorUnits ?? 0).toString(),
        tipsCount: tips?._count._all ?? 0,
        jobsMinorUnits: BigInt(jobs?._sum.amountMinorUnits ?? 0).toString(),
        jobsCount: jobs?._count._all ?? 0,
      };

      return res.status(200).json({
        data: EarningsSummaryResource.make(summary),
        status: 'success',
        message: 'OK',
        code: 200,
      });
    } catch (error) {
      return ErrorHandler.internalServerError(res, 'Failed to load earnings summary', error);
    }
  }

  public async transactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return ErrorHandler.unauthorized(res, 'Authentication required');
      }

      const period = parsePeriod(req.query.period);
      const start = periodStart(period);
      const page = parsePositiveInt(req.query.page, 1);
      const pageSize = parsePositiveInt(req.query.pageSize, DATAFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

      const typeFilter = typeof req.query.type === 'string' ? req.query.type : undefined;
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

      const where = {
        artisanId: userId,
        ...(start ? { createdAt: { gte: start } } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      } as const;

      const skip = (page - 1) * pageSize;

      const [rows, total] = await prisma.$transaction([
        prisma.earningTransaction.findMany({ where }),
        prisma.earningTransaction.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: pageSize,
        }),
      ]);

      const collection = EarningsTransactionCollection.make(rows, {
        page,
        pageSize,
        total,
        period,
      });

      return res.status(200).json({
        data: collection,
        status: 'success',
        message: 'OK',
        code: 200,
      });
    } catch (error) {
      return ErrorHandler.internalServerError(res, 'Failed to load earnings transactions', error);
    }
  }
}
