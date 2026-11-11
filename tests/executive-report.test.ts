import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutiveReport, jakartaDayBounds, jakartaDateKey, jakartaPeriodBounds } from '../server/services/executiveReport';

test('Jakarta day bounds account for WIB and reject impossible dates', () => {
  assert.equal(jakartaDateKey(new Date('2026-11-09T18:00:00.000Z')), '2026-11-10');
  assert.deepEqual(jakartaDayBounds('2026-11-10'), {
    start: new Date('2026-11-09T17:00:00.000Z'),
    end: new Date('2026-11-10T17:00:00.000Z'),
  });
  assert.equal(jakartaDayBounds('2026-02-30'), null);
});

test('weekly and monthly report ranges use Jakarta dates and inclusive end dates', () => {
  assert.deepEqual(jakartaPeriodBounds('2026-11-11', 'week'), {
    start: new Date('2026-11-08T17:00:00.000Z'),
    end: new Date('2026-11-15T17:00:00.000Z'),
    startDate: '2026-11-09',
    endDate: '2026-11-15',
  });
  assert.deepEqual(jakartaPeriodBounds('2026-02-15', 'month'), {
    start: new Date('2026-01-31T17:00:00.000Z'),
    end: new Date('2026-02-28T17:00:00.000Z'),
    startDate: '2026-02-01',
    endDate: '2026-02-28',
  });
  assert.equal(jakartaPeriodBounds('2026-02-30', 'month'), null);
});

test('executive summary separates actual, estimated and AI costs and avoids mixed-currency profit', () => {
  const report = buildExecutiveReport({
    date: '2026-11-10',
    transactions: [
      { product: 'scanbite', kind: 'INCOME', amount: 1_000_000 },
      { product: 'konter', kind: 'ESTIMATE', amount: 4_000_000 },
      { product: 'lorisan', kind: 'EXPENSE', amount: 200_000 },
    ],
    usage: [
      { division: 'creator', model: 'model-a', promptTokens: 100, completionTokens: 50, costUsd: '0.125', usageAvailable: true },
      { division: 'engineer', model: 'model-b', promptTokens: 80, completionTokens: null, costUsd: null, usageAvailable: false },
    ],
    leads: [
      { status: 'CONVERTED', valueIdr: 2_500_000, createdAt: new Date('2026-11-10T03:00:00Z'), convertedAt: new Date('2026-11-10T04:00:00Z'), soldAt: null, lostAt: null },
      { status: 'SOLD', valueIdr: 3_000_000, createdAt: new Date('2026-11-09T03:00:00Z'), convertedAt: new Date('2026-11-09T04:00:00Z'), soldAt: new Date('2026-11-10T05:00:00Z'), lostAt: null },
    ],
    usdIdr: 16_000,
  });

  assert.equal(report.actualRevenueIdr, 1_000_000);
  assert.equal(report.estimatedIncomeIdr, 4_000_000);
  assert.equal(report.expensesIdr, 200_000);
  assert.equal(report.recordedProfitIdr, 800_000);
  assert.deepEqual(report.financeByProduct, [
    { product: 'konter', actualRevenueIdr: 0, estimatedIncomeIdr: 4_000_000, expensesIdr: 0, aiCostUsdKnown: 0, aiUnpricedCalls: 0, netRecordedAfterAiIdr: 0 },
    { product: 'lorisan', actualRevenueIdr: 0, estimatedIncomeIdr: 0, expensesIdr: 200_000, aiCostUsdKnown: 0, aiUnpricedCalls: 0, netRecordedAfterAiIdr: -200_000 },
    { product: 'scanbite', actualRevenueIdr: 1_000_000, estimatedIncomeIdr: 0, expensesIdr: 0, aiCostUsdKnown: 0, aiUnpricedCalls: 0, netRecordedAfterAiIdr: 1_000_000 },
  ]);
  assert.equal(report.startDate, '2026-11-10');
  assert.equal(report.endDate, '2026-11-10');
  assert.equal(report.aiCostUsdKnown, 0.125);
  assert.equal(report.netProfitAfterAiIdr, null);
  assert.equal(report.marginPercent, null);
  assert.equal(report.unpricedAiCalls, 1);
  assert.equal(report.unattributedAiCalls, 2);
  assert.equal(report.unattributedAiCostUsdKnown, 0.125);
  assert.equal(report.leadPipeline.active, 1);
  assert.equal(report.leadPipeline.convertedOnDate, 1);
  assert.equal(report.leadPipeline.soldOnDate, 1);
  assert.equal(report.leadPipeline.pipelineValueIdr, 2_500_000);
});

test('weekly report aggregates actual transactions across its WIB week', () => {
  const report = buildExecutiveReport({
    date: '2026-11-11',
    period: 'week',
    transactions: [
      { product: 'digital', kind: 'INCOME', amount: 25_000 },
      { product: 'digital', kind: 'EXPENSE', amount: 5_000 },
      { product: 'digital', kind: 'ESTIMATE', amount: 50_000 },
    ],
    usage: [{ division: 'creator', product: 'digital', model: 'model', promptTokens: 10, completionTokens: 10, costUsd: 0.1, usageAvailable: true }],
    leads: [
      { status: 'LEAD', valueIdr: null, createdAt: new Date('2026-11-08T16:59:59Z'), convertedAt: null, soldAt: null, lostAt: null },
      { status: 'LEAD', valueIdr: null, createdAt: new Date('2026-11-08T17:00:00Z'), convertedAt: null, soldAt: null, lostAt: null },
    ],
    usdIdr: 16_000,
  });
  assert.equal(report.period, 'week');
  assert.equal(report.startDate, '2026-11-09');
  assert.equal(report.endDate, '2026-11-15');
  assert.equal(report.actualRevenueIdr, 25_000);
  assert.equal(report.expensesIdr, 5_000);
  assert.equal(report.leadPipeline.createdOnDate, 1);
  assert.equal(report.financeByProduct[0].product, 'digital');
  assert.equal(report.financeByProduct[0].aiCostUsdKnown, 0.1);
  assert.equal(report.financeByProduct[0].netRecordedAfterAiIdr, 18_400);
});

test('net profit after AI is available only with a configured exchange rate', () => {
  const report = buildExecutiveReport({
    date: '2026-11-10',
    transactions: [{ product: 'scanbite', kind: 'INCOME', amount: 100_000 }],
    usage: [{ division: 'engineer', model: 'model', promptTokens: 1, completionTokens: 1, costUsd: 0.1, usageAvailable: true }],
    leads: [],
    usdIdr: 16_000,
  });
  assert.equal(report.netProfitAfterAiIdr, 98_400);
  assert.equal(report.marginPercent, 98.4);
});
