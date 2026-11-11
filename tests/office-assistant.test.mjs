import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../server/lib/prisma.ts';
import workflowRoutes from '../server/routes/workflowRoutes.ts';

test('office assistant validates voice-chat context and returns a conversational answer', async (t) => {
  const previous = {
    password: process.env.OFFICE_ADMIN_PASSWORD,
    apiKey: process.env.OPENROUTER_API_KEY,
    maxBudget: process.env.OPENROUTER_MAX_MONTHLY_USD,
    managementKey: process.env.OPENROUTER_MANAGEMENT_KEY,
  };
  process.env.OFFICE_ADMIN_PASSWORD = 'synthetic-assistant-admin-password';
  process.env.OPENROUTER_API_KEY = 'synthetic-assistant-key';
  process.env.OPENROUTER_MAX_MONTHLY_USD = '25';
  process.env.OPENROUTER_MANAGEMENT_KEY = 'synthetic-assistant-management-key';
  t.after(() => {
    if (previous.password === undefined) delete process.env.OFFICE_ADMIN_PASSWORD;
    else process.env.OFFICE_ADMIN_PASSWORD = previous.password;
    if (previous.apiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous.apiKey;
    if (previous.maxBudget === undefined) delete process.env.OPENROUTER_MAX_MONTHLY_USD;
    else process.env.OPENROUTER_MAX_MONTHLY_USD = previous.maxBudget;
    if (previous.managementKey === undefined) delete process.env.OPENROUTER_MANAGEMENT_KEY;
    else process.env.OPENROUTER_MANAGEMENT_KEY = previous.managementKey;
  });

  const originalFetch = globalThis.fetch;
  const originalUsageCreate = prisma.openRouterUsage.create;
  const originalReads = {
    jobs: prisma.officeJob.findMany,
    tickets: prisma.officeTicket.findMany,
    drafts: prisma.officeDraft.findMany,
    videos: prisma.videoJob.findMany,
    knowledge: prisma.knowledgeBase.findMany,
    transactions: prisma.financeTransaction.findMany,
    leads: prisma.businessLead.findMany,
    usage: prisma.openRouterUsage.findMany,
  };
  const requests = [];
  const usage = [];
  prisma.officeJob.findMany = async () => [{ division: 'creator', title: 'Membuat konten Siput PAUD', status: 'RUNNING', error: null, updatedAt: new Date() }];
  prisma.officeTicket.findMany = async () => [{ division: 'paud', category: 'QUESTION', title: 'Cara masuk Siput PAUD', status: 'OPEN', updatedAt: new Date() }];
  prisma.officeDraft.findMany = async () => [{ data: { division: 'marketing', title: 'Laporan Siput PAUD', content: 'Fitur yang sudah dikonfirmasi untuk produk.', status: 'APPROVED' }, updatedAt: new Date() }];
  prisma.videoJob.findMany = async () => [];
  prisma.knowledgeBase.findMany = async () => [{ productName: 'Siput PAUD', category: 'fitur', title: 'Fitur resmi', content: 'Mencatat kegiatan pembelajaran.', updatedAt: new Date() }];
  prisma.financeTransaction.findMany = async () => [{ kind: 'INCOME', amount: 125000 }];
  prisma.businessLead.findMany = async () => [];
  prisma.openRouterUsage.findMany = async () => [{ costUsd: 0.0125, usageAvailable: true }, { costUsd: null, usageAvailable: false }];
  const serverFetch = originalFetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1:')) return serverFetch(input, init);
    requests.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/key')) {
      return Response.json({ data: { limit: 25, limit_reset: 'monthly', limit_remaining: 2.5 } });
    }
    if (url.endsWith('/credits')) {
      assert.equal(init?.headers?.Authorization, 'Bearer synthetic-assistant-management-key');
      return Response.json({ data: { total_credits: 50, total_usage: 12.5 } });
    }
    return Response.json({
      model: 'google/gemini-2.5-flash',
      usage: { prompt_tokens: 120, completion_tokens: 24, cost: 0.001 },
      choices: [{ finish_reason: 'stop', message: { content: 'Siap bro, kita bahas langkahnya satu per satu.' } }],
    });
  };
  prisma.openRouterUsage.create = async (args) => { usage.push(args); return {}; };
  t.after(() => {
    globalThis.fetch = originalFetch;
    prisma.openRouterUsage.create = originalUsageCreate;
    prisma.officeJob.findMany = originalReads.jobs;
    prisma.officeTicket.findMany = originalReads.tickets;
    prisma.officeDraft.findMany = originalReads.drafts;
    prisma.videoJob.findMany = originalReads.videos;
    prisma.knowledgeBase.findMany = originalReads.knowledge;
    prisma.financeTransaction.findMany = originalReads.transactions;
    prisma.businessLead.findMany = originalReads.leads;
    prisma.openRouterUsage.findMany = originalReads.usage;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const base = `http://127.0.0.1:${server.address().port}/api/workflow/assistant/chat`;
  const origin = new URL(base).origin;
  const post = (messages) => serverFetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ messages }),
  });

  const malformed = await post([{ role: 'user', content: 'Halo' }, { role: 'user', content: 'Lagi' }]);
  assert.equal(malformed.status, 400);
  const tooLong = await post([{ role: 'user', content: 'a'.repeat(2001) }]);
  assert.equal(tooLong.status, 400);
  assert.equal(requests.length, 0);

  const response = await post([
    { role: 'user', content: 'Aku ingin menata alur kerja kantor.' },
    { role: 'assistant', content: 'Tentu, bagian mana yang ingin dibahas?' },
    { role: 'user', content: 'Mulai dari marketing dulu.' },
  ]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    reply: 'Siap bro, kita bahas langkahnya satu per satu.',
    model: 'google/gemini-2.5-flash',
  });
  assert.equal(requests.length, 4);
  const assistantRequest = requests.find((request) => request.url.endsWith('/chat/completions')).body.messages[1].content;
  assert.match(assistantRequest, /SNAPSHOT KANTOR/);
  assert.match(assistantRequest, /Membuat konten Siput PAUD/);
  assert.match(assistantRequest, /Cara masuk Siput PAUD/);
  assert.match(assistantRequest, /Mencatat kegiatan pembelajaran/);
  assert.match(assistantRequest, /pemasukan aktual Rp125\.000/);
  assert.match(assistantRequest, /batas bulanan US\$25\.00; sisa limit US\$2\.50; terpakai dari limit US\$22\.50/);
  assert.match(assistantRequest, /bukan saldo akun, kredit\/top-up, atau tagihan final/);
  assert.match(assistantRequest, /total kredit 50\.0000; total pemakaian akun 12\.5000; sisa perkiraan 37\.5000 kredit/);
  assert.match(assistantRequest, /total biaya yang tercatat US\$0\.012500; 1 permintaan belum memiliki data biaya/);
  assert.match(assistantRequest, /Asisten: Tentu, bagian mana yang ingin dibahas\?/);
  assert.match(assistantRequest, /Pemilik: Mulai dari marketing dulu\./);
  assert.equal(usage[0].data.product, 'office_assistant');
});
