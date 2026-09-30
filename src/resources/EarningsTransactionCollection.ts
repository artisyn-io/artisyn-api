import { EarningsTransactionResource, EarningsTransactionRow } from 'src/resources/EarningsTransactionResource';

export interface EarningsTransactionCollectionMeta {
  page: number;
  pageSize: number;
  total: number;
  period: string;
}

export class EarningsTransactionCollection {
  public static make(rows: EarningsTransactionRow[], meta: EarningsTransactionCollectionMeta) {
    const totalPages = meta.pageSize > 0 ? Math.ceil(meta.total / meta.pageSize) : 0;

    return {
      items: rows.map((row) => EarningsTransactionResource.make(row)),
      meta: {
        page: meta.page,
        pageSize: meta.pageSize,
        total: meta.total,
        totalPages,
        period: meta.period,
        hasNextPage: meta.page < totalPages,
        hasPreviousPage: meta.page > 1,
      },
    };
  }
}
