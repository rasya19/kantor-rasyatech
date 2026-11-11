import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';

test('synthetic transaction and grounded draft persist and can be reviewed', { skip: process.env.OFFICE_DB_TEST !== '1' }, async (context) => {
  const { prisma } = await import('../server/lib/prisma.ts');
  const { default: routes } = await import('../server/routes/businessRoutes.ts');
  const { default: workflowRoutes } = await import('../server/routes/workflowRoutes.ts');
  const { jakartaDateKey } = await import('../server/services/executiveReport.ts');
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  const originalFetch = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    return Response.json({ usage: { prompt_tokens: 10, completion_tokens: 4, cost: 0.0007 }, choices: [{ finish_reason: 'stop', message: { content: 'Contoh sintetis.', annotations: [
      { type: 'url_citation', url_citation: { title: 'Sumber contoh', url: 'https://example.org/', start_index: 0, end_index: 16 } },
    ] } }] });
  });
  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  app.use('/api/workflow', workflowRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/business`;
  const note = `synthetic-${randomUUID()}`;
  let id;
  let draftId;
  const reportTransactionIds = [];
  let reportUsageId;
  let leadId;
  try {
    const response = await fetch(`${base}/transactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'paud', kind: 'INCOME', amount: 12345, date: '2026-11-09', note }),
    });
    assert.equal(response.status, 201);
    id = (await response.json()).transaction.id;
    assert.equal((await prisma.financeTransaction.findUnique({ where: { id } })).amount, 12345);
    const voided = await fetch(`${base}/transactions/${id}/void`, { method: 'POST' });
    assert.equal(voided.status, 200);
    assert.ok((await prisma.financeTransaction.findUnique({ where: { id } })).voidedAt);
    assert.equal((await fetch(`${base}/transactions/${id}/void`, { method: 'POST' })).status, 409);

    const research = await fetch(`${base}/research`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: 'paud' }) });
    assert.equal(research.status, 201);
    draftId = (await research.json()).draft.id;
    const drafts = await (await fetch(`http://127.0.0.1:${server.address().port}/api/workflow/drafts`)).json();
    assert.equal(drafts.drafts.find((draft) => draft.id === draftId).grounding.sources[0].url, 'https://example.org/');
    const draftUrl = `http://127.0.0.1:${server.address().port}/api/workflow/drafts/${draftId}`;
    const edit = await fetch(draftUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'EDIT', content: 'Diubah' }) });
    assert.equal(edit.status, 409);
    const approve = await fetch(draftUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'APPROVE' }) });
    assert.equal(approve.status, 200);
    assert.equal((await approve.json()).draft.status, 'APPROVED');

    const reportDate = jakartaDateKey(new Date());
    const baselineResponse = await fetch(`${base}/executive-report?date=${reportDate}`);
    assert.equal(baselineResponse.status, 200);
    const baseline = (await baselineResponse.json()).report;
    for (const [kind, amount] of [['INCOME', 1_000_000], ['ESTIMATE', 3_000_000], ['EXPENSE', 250_000]]) {
      const saved = await fetch(`${base}/transactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'scanbite', kind, amount, date: reportDate, note }),
      });
      assert.equal(saved.status, 201);
      reportTransactionIds.push((await saved.json()).transaction.id);
    }
    reportUsageId = (await prisma.openRouterUsage.create({
      data: { division: 'creator', model: 'synthetic/model', promptTokens: 10, completionTokens: 5, costUsd: '0.125', usageAvailable: true, createdAt: new Date() },
    })).id;
    const newLead = await fetch(`${base}/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'scanbite', valueIdr: 5_000_000, note }),
    });
    assert.equal(newLead.status, 201);
    leadId = (await newLead.json()).lead.id;
    for (const status of ['CONVERTED', 'SOLD']) {
      const updatedLead = await fetch(`${base}/leads/${leadId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      assert.equal(updatedLead.status, 200);
    }
    const reportResponse = await fetch(`${base}/executive-report?date=${reportDate}`);
    assert.equal(reportResponse.status, 200);
    const report = (await reportResponse.json()).report;
    assert.equal(report.actualRevenueIdr - baseline.actualRevenueIdr, 1_000_000);
    assert.equal(report.estimatedIncomeIdr - baseline.estimatedIncomeIdr, 3_000_000);
    assert.equal(report.expensesIdr - baseline.expensesIdr, 250_000);
    const reportCreatorUsage = report.aiByDivision.find((division) => division.division === 'creator');
    const baselineCreatorCost = baseline.aiByDivision.find((division) => division.division === 'creator')?.costUsdKnown ?? 0;
    assert.ok(reportCreatorUsage, JSON.stringify(report.aiByDivision));
    assert.ok(reportCreatorUsage.costUsdKnown >= baselineCreatorCost + 0.125);
    assert.equal(report.leadPipeline.sold - baseline.leadPipeline.sold, 1);
    assert.equal(report.leadPipeline.convertedOnDate - baseline.leadPipeline.convertedOnDate, 1);
    assert.equal(report.leadPipeline.soldOnDate - baseline.leadPipeline.soldOnDate, 1);
  } finally {
    if (id) await prisma.financeTransaction.deleteMany({ where: { id, note } });
    if (reportTransactionIds.length) await prisma.financeTransaction.deleteMany({ where: { id: { in: reportTransactionIds }, note } });
    if (reportUsageId) await prisma.openRouterUsage.deleteMany({ where: { id: reportUsageId } });
    if (leadId) await prisma.businessLead.deleteMany({ where: { id: leadId, note } });
    if (draftId) await prisma.officeDraft.deleteMany({ where: { id: draftId } });
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
