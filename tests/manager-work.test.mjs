import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const { prisma } = await import('../server/lib/prisma.ts');
const { default: routes } = await import('../server/routes/jobRoutes.ts');
const { processNextJob } = await import('../server/services/jobService.ts');
const { jakartaDateKey } = await import('../server/services/executiveReport.ts');

function replace(context, object, name, implementation) {
  const original = object[name];
  object[name] = implementation;
  context.after(() => { object[name] = original; });
}

test('finance and marketing managers can receive real office queue assignments', async (context) => {
  const created = [];
  replace(context, prisma.officeJob, 'create', async ({ data }) => {
    created.push(data);
    return { id: `job-${created.length}` };
  });
  const app = express();
  app.use(express.json());
  app.use('/api/office-work', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));

  for (const [division, staffId] of [['finance', 'finance_manager'], ['marketing', 'marketing_manager']]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/office-work/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division, staffId, instruction: 'Siapkan laporan kerja untuk pimpinan.' }),
    });
    assert.equal(response.status, 202);
  }
  assert.deepEqual(created.map(({ division, staffId }) => [division, staffId]), [
    ['finance', 'finance_manager'],
    ['marketing', 'marketing_manager'],
  ]);
});

test('finance manager creates a factual daily, weekly, and monthly report without an AI call', async (context) => {
  const date = jakartaDateKey();
  const job = {
    id: 'finance-manager-test',
    status: 'QUEUED',
    division: 'finance',
    staffId: 'finance_manager',
    title: 'Mandat laporan keuangan',
    instruction: 'Buat laporan keuangan.',
    ticketId: null,
  };
  let savedDraft;
  replace(context, prisma.officeJob, 'findFirst', async () => job.status === 'QUEUED' ? { ...job } : null);
  replace(context, prisma.officeJob, 'updateMany', async ({ where, data }) => {
    if (where.id !== job.id || where.status !== job.status) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  });
  replace(context, prisma.financeTransaction, 'findMany', async () => [
    { product: 'digital', kind: 'INCOME', amount: 12000, date },
    { product: 'other', kind: 'EXPENSE', amount: 3000, date },
  ]);
  replace(context, prisma.openRouterUsage, 'findMany', async () => [{
    division: 'creator', product: null, model: 'test-model', promptTokens: 10,
    completionTokens: 5, costUsd: '0.01', usageAvailable: true, createdAt: new Date(),
  }]);
  replace(context, prisma, '$transaction', async (callback) => callback({
    officeJob: { updateMany: prisma.officeJob.updateMany },
    officeDraft: { create: async ({ data }) => { savedDraft = data; } },
  }));
  context.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Finance report must not call an AI provider.');
  });

  await processNextJob();
  assert.equal(job.status, 'DONE');
  assert.equal(savedDraft.data.status, 'PENDING');
  assert.equal(savedDraft.data.ai, undefined);
  assert.equal(savedDraft.events.create.action, 'CREATED');
  assert.match(savedDraft.data.content, /HARIAN/);
  assert.match(savedDraft.data.content, /MINGGUAN/);
  assert.match(savedDraft.data.content, /BULANAN/);
  assert.match(savedDraft.data.content, /Pemasukan aktual yang tercatat: Rp12\.000 dari 1 transaksi/);
  assert.match(savedDraft.data.content, /Pengeluaran operasional yang tercatat: Rp3\.000/);
  assert.match(savedDraft.data.content, /tidak dikirim ke provider AI/);
  assert.match(savedDraft.data.content, /Saldo kas\/rekening\/e-wallet tidak tersedia/);
});

test('marketing manager receives bounded distribution duties in the model prompt', async (context) => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousBudget = process.env.OPENROUTER_MAX_MONTHLY_USD;
  process.env.OPENROUTER_API_KEY = 'synthetic-test-key';
  process.env.OPENROUTER_MAX_MONTHLY_USD = '25';
  context.after(() => {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
    if (previousBudget === undefined) delete process.env.OPENROUTER_MAX_MONTHLY_USD;
    else process.env.OPENROUTER_MAX_MONTHLY_USD = previousBudget;
  });
  const job = {
    id: 'marketing-manager-test',
    status: 'QUEUED',
    division: 'marketing',
    staffId: 'marketing_manager',
    title: 'Mandat listing produk',
    instruction: 'Buat draf listing dari fakta produk yang disediakan.',
    ticketId: null,
  };
  let savedDraft;
  let modelInstruction = '';
  replace(context, prisma.officeJob, 'findFirst', async () => job.status === 'QUEUED' ? { ...job } : null);
  replace(context, prisma.officeJob, 'updateMany', async ({ where, data }) => {
    if (where.id !== job.id || where.status !== job.status) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  });
  replace(context, prisma.openRouterUsage, 'create', async () => ({}));
  replace(context, prisma, '$transaction', async (callback) => callback({
    officeJob: { updateMany: prisma.officeJob.updateMany },
    officeDraft: { create: async ({ data }) => { savedDraft = data; } },
  }));
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).endsWith('/key')) {
      return Response.json({ data: { limit: 25, limit_reset: 'monthly', limit_remaining: 25 } });
    }
    const request = JSON.parse(String(options?.body));
    modelInstruction = request.messages[1].content;
    return Response.json({
      model: 'google/gemini-2.5-flash',
      choices: [{ finish_reason: 'stop', message: { content: 'Draf listing sintetis untuk ditinjau.' } }],
    });
  });

  await processNextJob();
  assert.equal(job.status, 'DONE');
  assert.match(modelInstruction, /caption per platform/i);
  assert.match(modelInstruction, /\[PERLU KONFIRMASI\]/);
  assert.match(modelInstruction, /tidak dapat mengaktifkan link, mengunggah, menjadwalkan, memublikasikan/);
  assert.match(savedDraft.data.content, /Draf listing sintetis/);
  assert.equal(savedDraft.data.ai.model, 'google/gemini-2.5-flash');
});
