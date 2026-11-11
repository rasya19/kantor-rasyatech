import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.OPENROUTER_API_KEY = 'test-key-not-used';
const { prisma } = await import('../server/lib/prisma.ts');
const { currentDigitalProductSourceProblems, digitalProductResearchProblems, digitalProductResearchValidationProblems, generateDigitalProductResearch, isDailyDigitalProductResearchJob, researchProduct, opportunityResearchTimeoutMs, scheduleDailyDigitalProductResearch } = await import('../server/services/businessResearch.ts');
const { enqueueOpportunitySprint, pauseQueuedOpportunityTasks } = await import('../server/services/opportunityFlow.ts');
const { default: routes } = await import('../server/routes/businessRoutes.ts');

test('daily digital-product planning creates one paused job without spending on AI', async (context) => {
  let created;
  const originalCreateMany = prisma.officeJob.createMany;
  prisma.officeJob.createMany = async ({ data, skipDuplicates }) => {
    created = { data, skipDuplicates };
    return { count: 1 };
  };
  context.after(() => { prisma.officeJob.createMany = originalCreateMany; });

  assert.equal(await scheduleDailyDigitalProductResearch(new Date('2026-11-09T22:59:00Z')), 0);
  assert.equal(created, undefined);
  assert.equal(await scheduleDailyDigitalProductResearch(new Date('2026-11-09T23:00:00Z')), 1);
  assert.equal(created.data[0].id, 'daily-digital-product-2026-11-10');
  assert.equal(created.data[0].status, 'PAUSED');
  assert.equal(created.skipDuplicates, true);
  assert.equal(isDailyDigitalProductResearchJob(created.data[0].id), true);
  assert.match(created.data[0].instruction, /Fokus riset hari ini/);
  assert.doesNotMatch(created.data[0].instruction, /guru: paket prompt/i);
  const firstDayInstruction = created.data[0].instruction;
  assert.equal(await scheduleDailyDigitalProductResearch(new Date('2026-11-10T23:00:00Z')), 1);
  assert.notEqual(created.data[0].instruction, firstDayInstruction);
});

test('research requires real grounding sources and creates a pending draft', async (context) => {
  let saved;
const originalUsageCreate = prisma.openRouterUsage.create;
prisma.openRouterUsage.create = async () => ({});
context.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });
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
  await assert.rejects(researchProduct('paud'), /sumber web/);
});

test('digital product research forbids unsupported market numbers and requires cited current sources', async (context) => {
  let instruction = '';
  const sourceList = [
    '## Daftar Sumber Rujukan',
    '1. Judul: Sumber publik 1',
    '   - Tautan: https://example.org/1',
    '   - Tanggal Publikasi: 2026',
    '2. Judul: Sumber publik 2',
    '   - Tautan: https://example.org/2',
    '   - Tanggal Publikasi: 2026',
    '3. Judul: Sumber publik 3',
    '   - Tautan: https://example.org/3',
    '   - Tanggal Publikasi: 2026',
  ].join('\n');
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = async () => ({});
  context.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    const body = JSON.parse(String(options?.body));
    instruction = body.messages[1].content;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: `Belum cukup bukti publik.\n${sourceList}`, annotations: [
      { type: 'url_citation', url_citation: { title: 'Sumber publik 1', url: 'https://example.org/1' } },
      { type: 'url_citation', url_citation: { title: 'Sumber publik 2', url: 'https://example.org/2' } },
      { type: 'url_citation', url_citation: { title: 'Sumber publik 3', url: 'https://example.org/3' } },
    ] } }] });
  });
  const originalCreate = prisma.officeDraft.create;
  prisma.officeDraft.create = async ({ data }) => data;
  context.after(() => { prisma.officeDraft.create = originalCreate; });

  await generateDigitalProductResearch();
  assert.match(instruction, /tahun berjalan \(2026\)/i);
  assert.match(instruction, /setiap klaim spesifik[\s\S]*tanggal publikasi\/pembaruan/i);
  assert.match(instruction, /"belum terverifikasi"/);
  assert.match(instruction, /Jangan mengarang angka, statistik/);
  assert.match(instruction, /satu eksperimen termurah/);
  assert.match(instruction, /UMKM, kreator, pekerja lepas/i);
  assert.match(instruction, /maksimal tiga konsep dari kelompok pengguna atau kategori produk yang berbeda/i);
  assert.doesNotMatch(instruction, /Fokus eksperimen pertama adalah paket prompt.*guru/i);
  assert.match(instruction, /Jangan membangun atau memprioritaskan aplikasi/);
});

test('medium-term opportunity research remains focused on the owner-listed applications', async (context) => {
  let instruction = '';
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = async () => ({});
  context.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    instruction = JSON.parse(String(options?.body)).messages[1].content;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Bukti aplikasi.', annotations: [
      { type: 'url_citation', url_citation: { title: 'Sumber', url: 'https://example.org/' } },
    ] } }] });
  });
  const originalCreate = prisma.officeDraft.create;
  prisma.officeDraft.create = async ({ data }) => data;
  context.after(() => { prisma.officeDraft.create = originalCreate; });

  const draft = await researchProduct('opportunities');
  assert.equal(draft.division, 'engineer');
  assert.match(instruction, /ScanBite/);
  assert.match(instruction, /Konter \+62/);
  assert.match(instruction, /Lorisan Warung/);
  assert.doesNotMatch(instruction, /paket prompt pintar/);
});

test('public opportunity research has a bounded timeout that fits within the job lease', () => {
  assert.equal(opportunityResearchTimeoutMs, 150_000);
});

test('digital product research rejects unsupported numeric sales claims but allows labeled owner hypotheses', () => {
  const report = [
    'Eksperimen validasi dilakukan selama 7 hari.',
    'Harga Rp25.000–Rp50.000 adalah hipotesis pemilik.',
    'Targetkan minimal 15 pendaftar dalam seminggu.',
  ].join('\n');
  assert.deepEqual(digitalProductResearchProblems(report), ['15 pendaftar']);
  assert.deepEqual(digitalProductResearchProblems('Kompetitor menjual paket seharga Rp39.000 [Sumber](https://example.org/).'), []);
});

test('digital product research rejects old or undated sources and does not treat access date as publication date', () => {
  const staleReport = [
    '## Daftar Sumber Rujukan',
    '1. Judul: Artikel lama',
    '   - Tautan: https://example.org/old',
    '   - Tanggal Publikasi: 2024',
    '   - Tanggal Akses: 2026',
    '2. Judul: Sumber tidak bertanggal',
    '   - Tautan: https://example.org/unknown',
    '   - Tanggal Publikasi: Belum terverifikasi',
    '3. Judul: Sumber ketiga',
    '   - Tautan: https://example.org/third',
    '   - Tanggal Publikasi: 2024',
  ].join('\n');
  const problems = currentDigitalProductSourceProblems(staleReport, 2026);
  assert.equal(problems.length, 4);
  assert.match(problems[0], /tahun 2026/);
  assert.match(problems.at(-1), /minimal 3 sumber unik/);
  assert.deepEqual(digitalProductResearchValidationProblems(staleReport, 2026), []);

  const currentSources = [1, 2, 3].map((number) =>
    `${number}. Judul: Sumber terkini ${number}\n- Tautan: https://example.org/${number}\n- Tanggal Publikasi: 2026`).join('\n');
  assert.deepEqual(currentDigitalProductSourceProblems(`## Daftar Sumber Rujukan\n${currentSources}`, 2026), []);
});

test('digital product research allows transparently undated sources but still requires three unique links', () => {
  const report = [
    'Peluang belum dapat diverifikasi dari bukti terkini.',
    '## Daftar Sumber Rujukan',
    '1. Sumber A — tanggal publikasi/pembaruan tidak ditemukan: https://example.org/a',
    '2. Sumber B — tanggal publikasi/pembaruan tidak ditemukan: https://example.org/b',
    '3. Sumber C — tanggal publikasi/pembaruan tidak ditemukan: https://example.org/c',
  ].join('\n');
  assert.deepEqual(digitalProductResearchValidationProblems(report, 2026), []);
  assert.deepEqual(
    digitalProductResearchValidationProblems(report.replace('https://example.org/c', 'https://example.org/a'), 2026),
    ['minimal 3 tautan sumber web unik (ditemukan 2)'],
  );
});

test('digital product research is queued for the Creator strategist', async (context) => {
  let queued;
  const originalCreate = prisma.officeJob.create;
  prisma.officeJob.create = async ({ data }) => {
    queued = data;
    return data;
  };
  context.after(() => { prisma.officeJob.create = originalCreate; });

  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/business/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: 'opportunities' }),
  });
  assert.equal(response.status, 202);
  const result = await response.json();
  assert.equal(result.id, queued.id);
  assert.match(result.id, /^digital-product-research-[0-9a-f-]{36}$/);
  assert.equal(queued.staffId, 'strategist');
  assert.equal(queued.division, 'creator');
  assert.match(queued.instruction, /Riset peluang produk digital non-aplikasi/i);
  assert.match(queued.instruction, /tanggal sumber/);
});

test('daily digital-product research requires an explicit start and queues only a paused task', async (context) => {
  const taskId = 'daily-digital-product-2026-11-10';
  const task = { id: taskId, division: 'creator', staffId: 'strategist', status: 'PAUSED' };
  const originalFindUnique = prisma.officeJob.findUnique;
  const originalFindFirst = prisma.officeJob.findFirst;
  const originalUpdateMany = prisma.officeJob.updateMany;
  prisma.officeJob.findUnique = async ({ where }) => where.id === taskId ? task : null;
  prisma.officeJob.findFirst = async () => null;
  prisma.officeJob.updateMany = async ({ where, data }) => {
    if (where.id !== taskId || where.status !== 'PAUSED') return { count: 0 };
    Object.assign(task, data);
    return { count: 1 };
  };
  context.after(() => {
    prisma.officeJob.findUnique = originalFindUnique;
    prisma.officeJob.findFirst = originalFindFirst;
    prisma.officeJob.updateMany = originalUpdateMany;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const base = `http://127.0.0.1:${server.address().port}/api/business/daily-product/jobs/${taskId}/start`;
  assert.equal((await fetch(base, { method: 'POST' })).status, 202);
  assert.equal(task.status, 'QUEUED');
  assert.equal((await fetch(base, { method: 'POST' })).status, 409);
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
  const originalTransactionCreate = prisma.financeTransaction.create;
  prisma.financeTransaction.create = async ({ data }) => ({ id: 'synthetic-finance-transaction', ...data, voidedAt: null, createdAt: new Date() });
  context.after(() => { prisma.financeTransaction.create = originalTransactionCreate; });
  const digitalProductSale = await fetch(`${base}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: 'digital', kind: 'INCOME', amount: 25000, date: '2026-11-09', note: 'synthetic' }),
  });
  assert.equal(digitalProductSale.status, 201);
  assert.equal((await digitalProductSale.json()).transaction.product, 'digital');
  for (const body of [
    { product: 'unknown', valueIdr: null, note: '' },
    { product: 'scanbite', valueIdr: 1.5, note: '' },
    { product: 'konter', valueIdr: 1, note: 'x'.repeat(201) },
  ]) {
    const response = await fetch(`${base}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
});

test('executive report API uses WIB period ranges and includes work and product-cost records', async (context) => {
  const originals = {
    transactions: prisma.financeTransaction.findMany,
    usage: prisma.openRouterUsage.findMany,
    leads: prisma.businessLead.findMany,
    jobs: prisma.officeJob.findMany,
    drafts: prisma.officeDraft.findMany,
  };
  let transactionQuery;
  let usageQuery;
  prisma.financeTransaction.findMany = async ({ where }) => { transactionQuery = where; return [{ product: 'digital', kind: 'INCOME', amount: 25000 }]; };
  prisma.openRouterUsage.findMany = async ({ where }) => { usageQuery = where; return [{ division: 'creator', product: 'digital', model: 'test/model', promptTokens: 10, completionTokens: 5, costUsd: '0.1', usageAvailable: true }]; };
  prisma.businessLead.findMany = async () => [];
  prisma.officeJob.findMany = async () => [{ id: 'daily-digital-product-2026-11-10', title: 'Riset harian', division: 'creator', status: 'PAUSED', draftId: null, error: null, createdAt: new Date('2026-11-10T00:00:00Z'), updatedAt: new Date('2026-11-10T00:00:00Z') }];
  prisma.officeDraft.findMany = async () => [{ id: 'output', data: { id: 'output', title: 'Paket prompt', division: 'creator', status: 'PENDING', productPackageVersion: 1 }, createdAt: new Date('2026-11-10T00:00:00Z') }];
  context.after(() => {
    prisma.financeTransaction.findMany = originals.transactions;
    prisma.openRouterUsage.findMany = originals.usage;
    prisma.businessLead.findMany = originals.leads;
    prisma.officeJob.findMany = originals.jobs;
    prisma.officeDraft.findMany = originals.drafts;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/business/executive-report?date=2026-11-11&period=week`);
  assert.equal(response.status, 200);
  const report = (await response.json()).report;
  assert.equal(transactionQuery.date.gte, '2026-11-09');
  assert.equal(transactionQuery.date.lte, '2026-11-15');
  assert.equal(usageQuery.createdAt.gte.toISOString(), '2026-11-08T17:00:00.000Z');
  assert.equal(usageQuery.createdAt.lt.toISOString(), '2026-11-15T17:00:00.000Z');
  assert.equal(report.period, 'week');
  assert.equal(report.workSummary.paused, 1);
  assert.equal(report.outputs[0].isDigitalProduct, true);
  assert.equal(report.financeByProduct[0].aiCostUsdKnown, 0.1);
  assert.equal(report.incomeSourceConnected, false);
});

test('business API dismisses only failed opportunity sprint jobs', async (context) => {
  const jobs = new Map([
    ['weekly-research-2026-11-09', { id: 'weekly-research-2026-11-09', status: 'FAILED' }],
    ['manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29:creator_lorisan', {
      id: 'manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29:creator_lorisan', status: 'QUEUED',
    }],
  ]);
  const originalFindUnique = prisma.officeJob.findUnique;
  const originalUpdateMany = prisma.officeJob.updateMany;
  prisma.officeJob.findUnique = async ({ where }) => jobs.get(where.id) ?? null;
  prisma.officeJob.updateMany = async ({ where, data }) => {
    const job = jobs.get(where.id);
    if (!job || job.status !== where.status) return { count: 0 };
    jobs.set(where.id, { ...job, ...data });
    return { count: 1 };
  };
  context.after(() => {
    prisma.officeJob.findUnique = originalFindUnique;
    prisma.officeJob.updateMany = originalUpdateMany;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/business/opportunities/jobs`;

  let response = await fetch(`${base}/weekly-research-2026-11-09`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.equal(jobs.get('weekly-research-2026-11-09').status, 'DISMISSED');

  response = await fetch(`${base}/manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29%3Acreator_lorisan`, { method: 'DELETE' });
  assert.equal(response.status, 409);
  assert.equal(jobs.get('manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29:creator_lorisan').status, 'QUEUED');

  response = await fetch(`${base}/unrelated-job`, { method: 'DELETE' });
  assert.equal(response.status, 400);
});

test('starting another sprint reuses a current-week job even when it failed', async (context) => {
  const originalFindFirst = prisma.officeJob.findFirst;
  const originalCreate = prisma.officeJob.create;
  prisma.officeJob.findFirst = async ({ where }) => {
    assert.equal(where.status.not, 'DISMISSED');
    assert.ok(where.createdAt.gte instanceof Date);
    assert.ok(where.createdAt.lt instanceof Date);
    return { id: 'manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29', status: 'FAILED' };
  };
  prisma.officeJob.create = async () => {
    throw new Error('A duplicate sprint should not be created.');
  };
  context.after(() => {
    prisma.officeJob.findFirst = originalFindFirst;
    prisma.officeJob.create = originalCreate;
  });

  assert.deepEqual(await enqueueOpportunitySprint(), {
    id: 'manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29',
    alreadyActive: true,
  });
});

test('startup pauses queued opportunity follow-ups but not research jobs', async (context) => {
  const originalUpdateMany = prisma.officeJob.updateMany;
  let args;
  prisma.officeJob.updateMany = async (value) => {
    args = value;
    return { count: 9 };
  };
  context.after(() => { prisma.officeJob.updateMany = originalUpdateMany; });

  assert.equal(await pauseQueuedOpportunityTasks(), 9);
  assert.deepEqual(args, {
    where: {
      status: 'QUEUED',
      OR: [
        { id: { startsWith: 'weekly-research-', contains: ':' } },
        { id: { startsWith: 'manual-research-', contains: ':' } },
      ],
    },
    data: { status: 'PAUSED' },
  });
});

test('opportunity sprint releases only the selected paused follow-up job', async (context) => {
  const researchId = 'manual-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29';
  const firstId = `${researchId}:engineer_scanbite`;
  const secondId = `${researchId}:engineer_konter`;
  const jobs = new Map([
    [researchId, { id: researchId, status: 'DONE' }],
    [firstId, { id: firstId, status: 'PAUSED' }],
    [secondId, { id: secondId, status: 'PAUSED' }],
  ]);
  const originals = {
    findUnique: prisma.officeJob.findUnique,
    findFirst: prisma.officeJob.findFirst,
    updateMany: prisma.officeJob.updateMany,
  };
  prisma.officeJob.findUnique = async ({ where }) => jobs.get(where.id) ?? null;
  prisma.officeJob.findFirst = async ({ where }) => [...jobs.values()].find((job) =>
    job.id.startsWith(where.id.startsWith) && where.status.in.includes(job.status)) ?? null;
  prisma.officeJob.updateMany = async ({ where, data }) => {
    const job = jobs.get(where.id);
    if (!job || job.status !== where.status) return { count: 0 };
    jobs.set(where.id, { ...job, ...data });
    return { count: 1 };
  };
  context.after(() => {
    prisma.officeJob.findUnique = originals.findUnique;
    prisma.officeJob.findFirst = originals.findFirst;
    prisma.officeJob.updateMany = originals.updateMany;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/business', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/business/opportunities/jobs`;
  const start = (id) => fetch(`${base}/${encodeURIComponent(id)}/start`, { method: 'POST' });

  let response = await start(firstId);
  assert.equal(response.status, 202);
  assert.equal(jobs.get(firstId).status, 'QUEUED');

  response = await start(secondId);
  assert.equal(response.status, 409);
  assert.equal(jobs.get(secondId).status, 'PAUSED');

  jobs.set(firstId, { ...jobs.get(firstId), status: 'DONE' });
  response = await start(secondId);
  assert.equal(response.status, 202);
  assert.equal(jobs.get(secondId).status, 'QUEUED');

  response = await start('unrelated-job');
  assert.equal(response.status, 400);
});
