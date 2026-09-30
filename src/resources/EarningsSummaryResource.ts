export interface EarningsSummaryPayload {
  period: string;
  currency: string;
  totalMinorUnits: string;
  totalCount: number;
  tipsMinorUnits: string;
  tipsCount: number;
  jobsMinorUnits: string;
  jobsCount: number;
}

export class EarningsSummaryResource {
  public static make(payload: EarningsSummaryPayload) {
    return {
      period: payload.period,
      currency: payload.currency,
      totalMinorUnits: payload.totalMinorUnits,
      totalCount: payload.totalCount,
      tips: {
        minorUnits: payload.tipsMinorUnits,
        count: payload.tipsCount,
      },
      jobs: {
        minorUnits: payload.jobsMinorUnits,
        count: payload.jobsCount,
      },
    };
  }
}
