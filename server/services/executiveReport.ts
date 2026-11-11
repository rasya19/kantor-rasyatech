const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const leadStatuses = ['LEAD', 'CONVERTED', 'SOLD', 'LOST'] as const;

export type LeadStatus = typeof leadStatuses[number];
export type ReportPeriod = 'day' | 'week' | 'month';

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && leadStatuses.some((status) => status === value);
}

export function jakartaDateKey(now = new Date()): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function jakartaDayBounds(date: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  if (new Date(utcMidnight).toISOString().slice(0, 10) !== date) return null;
  const start = new Date(utcMidnight - WIB_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function jakartaPeriodBounds(date: string, period: ReportPeriod = 'day'): {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
} | null {
  const day = jakartaDayBounds(date);
  if (!day) return null;
  if (period === 'day') return { ...day, startDate: date, endDate: date };
  const utcDate = new Date(`${date}T00:00:00.000Z`);
  let startDate: string;
  let endDate: string;
  if (period === 'week') {
    const monday = new Date(utcDate.getTime() - ((utcDate.getUTCDay() + 6) % 7) * DAY_MS);
    startDate = monday.toISOString().slice(0, 10);
    endDate = new Date(monday.getTime() + 6 * DAY_MS).toISOString().slice(0, 10);
  } else if (period === 'month') {
    startDate = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), 1)).toISOString().slice(0, 10);
    endDate = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  } else {
    return null;
  }
  const startBounds = jakartaDayBounds(startDate);
  const endBounds = jakartaDayBounds(endDate);
  if (!startBounds || !endBounds) return null;
  return { start: startBounds.start, end: endBounds.end, startDate, endDate };
}

type UsageValue = number | string | { toNumber(): number } | null;
type UsageRow = {
  division: string;
  product?: string | null;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: UsageValue;
  usageAvailable: boolean;
};
type LeadRow = {
  status: string;
  valueIdr: number | null;
  createdAt: Date;
  convertedAt: Date | null;
  soldAt: Date | null;
  lostAt: Date | null;
};

function numericValue(value: UsageValue): number | null {
  if (value === null) return null;
  const result = typeof value === 'object' ? value.toNumber() : Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function isWithin(date: Date | null, start: Date, end: Date): boolean {
  return date !== null && date >= start && date < end;
}

export function buildExecutiveReport(input: {
  date: string;
  period?: ReportPeriod;
  startDate?: string;
  endDate?: string;
  transactions: { product: string; kind: string; amount: number }[];
  usage: UsageRow[];
  leads: LeadRow[];
  usdIdr: number | null;
}) {
  const period = input.period ?? 'day';
  const bounds = jakartaPeriodBounds(input.date, period);
  if (!bounds) throw new Error('Tanggal laporan tidak valid.');
  const startDate = input.startDate ?? bounds.startDate;
  const endDate = input.endDate ?? bounds.endDate;
  const actualRevenueIdr = input.transactions
    .filter((transaction) => transaction.kind === 'INCOME')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const estimatedIncomeIdr = input.transactions
    .filter((transaction) => transaction.kind === 'ESTIMATE')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expensesIdr = input.transactions
    .filter((transaction) => transaction.kind === 'EXPENSE')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const recordedProfitIdr = actualRevenueIdr - expensesIdr;
  const financeByProduct = new Map<string, {
    product: string;
    actualRevenueIdr: number;
    estimatedIncomeIdr: number;
    expensesIdr: number;
    aiCostUsdKnown: number;
    aiUnpricedCalls: number;
  }>();
  for (const transaction of input.transactions) {
    let total = financeByProduct.get(transaction.product);
    if (!total) {
      total = { product: transaction.product, actualRevenueIdr: 0, estimatedIncomeIdr: 0, expensesIdr: 0, aiCostUsdKnown: 0, aiUnpricedCalls: 0 };
      financeByProduct.set(transaction.product, total);
    }
    if (transaction.kind === 'INCOME') total.actualRevenueIdr += transaction.amount;
    else if (transaction.kind === 'ESTIMATE') total.estimatedIncomeIdr += transaction.amount;
    else if (transaction.kind === 'EXPENSE') total.expensesIdr += transaction.amount;
  }
  const divisions = new Map<string, {
    division: string;
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    costUsdKnown: number;
    unpricedCalls: number;
    usageIncompleteCalls: number;
  }>();
  for (const row of input.usage) {
    let total = divisions.get(row.division);
    if (!total) {
      total = { division: row.division, requestCount: 0, promptTokens: 0, completionTokens: 0, costUsdKnown: 0, unpricedCalls: 0, usageIncompleteCalls: 0 };
      divisions.set(row.division, total);
    }
    total.requestCount++;
    total.promptTokens += row.promptTokens ?? 0;
    total.completionTokens += row.completionTokens ?? 0;
    const cost = numericValue(row.costUsd);
    if (cost === null) total.unpricedCalls++;
    else total.costUsdKnown += cost;
    if (!row.usageAvailable) total.usageIncompleteCalls++;
  }
  const aiCostUsdKnown = [...divisions.values()].reduce((sum, division) => sum + division.costUsdKnown, 0);
  const unpricedAiCalls = [...divisions.values()].reduce((sum, division) => sum + division.unpricedCalls, 0);
  let unattributedAiCalls = 0;
  let unattributedAiCostUsdKnown = 0;
  for (const row of input.usage) {
    const product = row.product?.trim();
    const cost = numericValue(row.costUsd);
    if (!product) {
      unattributedAiCalls++;
      if (cost !== null) unattributedAiCostUsdKnown += cost;
      continue;
    }
    let total = financeByProduct.get(product);
    if (!total) {
      total = { product, actualRevenueIdr: 0, estimatedIncomeIdr: 0, expensesIdr: 0, aiCostUsdKnown: 0, aiUnpricedCalls: 0 };
      financeByProduct.set(product, total);
    }
    if (cost === null) total.aiUnpricedCalls++;
    else total.aiCostUsdKnown += cost;
  }
  const exchangeRate = input.usdIdr !== null && Number.isFinite(input.usdIdr) && input.usdIdr > 0 ? input.usdIdr : null;
  const netProfitAfterAiIdr = exchangeRate !== null && unpricedAiCalls === 0
    ? recordedProfitIdr - Math.round(aiCostUsdKnown * exchangeRate)
    : null;
  const pipelineStatuses = input.leads.filter((lead) => lead.status === 'LEAD' || lead.status === 'CONVERTED');

  return {
    date: input.date,
    actualRevenueIdr,
    estimatedIncomeIdr,
    expensesIdr,
    recordedProfitIdr,
    aiRequestCount: input.usage.length,
    aiCostUsdKnown,
    unpricedAiCalls,
    usageIncompleteCalls: input.usage.filter((row) => !row.usageAvailable).length,
    aiCostComplete: unpricedAiCalls === 0,
    usdIdr: exchangeRate,
    netProfitAfterAiIdr,
    marginPercent: actualRevenueIdr > 0 && netProfitAfterAiIdr !== null
      ? netProfitAfterAiIdr / actualRevenueIdr * 100
      : null,
    aiByDivision: [...divisions.values()].sort((a, b) => a.division.localeCompare(b.division)),
    financeByProduct: [...financeByProduct.values()]
      .sort((a, b) => a.product.localeCompare(b.product))
      .map((product) => ({
        ...product,
        netRecordedAfterAiIdr: exchangeRate !== null && product.aiUnpricedCalls === 0
          ? product.actualRevenueIdr - product.expensesIdr - Math.round(product.aiCostUsdKnown * exchangeRate)
          : null,
      })),
    unattributedAiCalls,
    unattributedAiCostUsdKnown,
    leadPipeline: {
      active: pipelineStatuses.length,
      converted: input.leads.filter((lead) => lead.status === 'CONVERTED').length,
      sold: input.leads.filter((lead) => lead.status === 'SOLD').length,
      lost: input.leads.filter((lead) => lead.status === 'LOST').length,
      pipelineValueIdr: pipelineStatuses.reduce((sum, lead) => sum + (lead.valueIdr ?? 0), 0),
      createdOnDate: input.leads.filter((lead) => isWithin(lead.createdAt, bounds.start, bounds.end)).length,
      convertedOnDate: input.leads.filter((lead) => isWithin(lead.convertedAt, bounds.start, bounds.end)).length,
      soldOnDate: input.leads.filter((lead) => isWithin(lead.soldAt, bounds.start, bounds.end)).length,
      lostOnDate: input.leads.filter((lead) => isWithin(lead.lostAt, bounds.start, bounds.end)).length,
    },
    period,
    startDate,
    endDate,
  };
}
