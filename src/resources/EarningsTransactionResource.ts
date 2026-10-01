export interface EarningsTransactionRow {
  id: string;
  type: string;
  status: string;
  amountMinorUnits: bigint;
  currency: string;
  description: string | null;
  jobId: string | null;
  tipId: string | null;
  counterpartyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class EarningsTransactionResource {
  public static make(row: EarningsTransactionRow) {
    const base = {
      id: row.id,
      type: row.type,
      status: row.status,
      amountMinorUnits: row.amountMinorUnits.toString(),
      currency: row.currency,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    } as const;

    if (row.type === 'tip') {
      return {
        ...base,
        type: 'tip' as const,
        tipId: row.tipId,
        counterpartyId: row.counterpartyId,
      };
    }

    return {
      ...base,
      type: 'job' as const,
      jobId: row.jobId,
      counterpartyId: row.counterpartyId,
    };
  }
}
