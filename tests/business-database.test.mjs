import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';

test('synthetic transaction and grounded draft persist and can be reviewed', { skip: process.env.OFFICE_DB_TEST !== '1' }, async (context) => {
  const { prisma } = await import('../server/lib/prisma.ts');
  const { default: routes } = await import('../server/routes/businessRoutes.ts');
  const { default: workflowRoutes } = await import('../server/routes/workflowRoutes.ts');
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  const originalFetch = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Contoh sintetis.', annotations: [
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
  } finally {
    if (id) await prisma.financeTransaction.deleteMany({ where: { id, note } });
    if (draftId) await prisma.officeDraft.deleteMany({ where: { id: draftId } });
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
