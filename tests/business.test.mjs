import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.OPENROUTER_API_KEY = 'test-key-not-used';
const { prisma } = await import('../server/lib/prisma.ts');
const { researchProduct } = await import('../server/services/businessResearch.ts');
const { default: routes } = await import('../server/routes/businessRoutes.ts');

test('research requires real grounding sources and creates a pending draft', async (context) => {
  let saved;
  let annotations = [{ type: 'url_citation', url_citation: { title: 'Sumber', url: 'https://example.org/', start_index: 2, end_index: 20 } }];
  const generate = context.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/key')
    ? Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } })
    : Response.json({ choices: [{ finish_reason: 'stop', message: { content: '  Hipotesis peluang.', annotations } }] }));
  const originalCreate = prisma.officeDraft.create;
  prisma.officeDraft.create = async (args) => { saved = args.data; return args.data; };
  context.after(() => { prisma.officeDraft.create = originalCreate; });
  const draft = await researchProduct('paud');
  assert.equal(draft.status, 'PENDING');
  assert.equal(draft.division, 'engineer');
  assert.equal(draft.grounding.sources[0].url, 'https://example.org/');
  assert.deepEqual(draft.grounding.citations[0].sourceIndexes, [0]);
  assert.equal(draft.grounding.citations[0].text, 'Hipotesis peluang.');
  assert.equal(saved.data.id, draft.id);
  assert.equal(generate.mock.calls.length, 2);
  annotations = [];
  await assert.rejects(researchProduct('paud'), /sumber pencarian/);
});

test('business API rejects invalid transaction input without storing it', async (context) => {
  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/business`;
  for (const body of [
    { product: 'paud', kind: 'INCOME', amount: 0, date: '2026-11-09', note: '' },
    { product: 'paud', kind: 'INCOME', amount: 1.5, date: '2026-11-09', note: '' },
    { product: 'paud', kind: 'INCOME', amount: 1, date: '2026-02-30', note: '' },
    { product: 'unknown', kind: 'INCOME', amount: 1, date: '2026-11-09', note: '' },
  ]) {
    const response = await fetch(`${base}/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});
