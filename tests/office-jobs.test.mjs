import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.OPENROUTER_API_KEY = 'test-key-not-used';
const { prisma } = await import('../server/lib/prisma.ts');
const { default: routes } = await import('../server/routes/jobRoutes.ts');
const { processNextJob, listJobs } = await import('../server/services/jobService.ts');
const { digitalProductFollowupInstruction } = await import('../server/services/creatorFollowup.ts');
const { runScheduledCreator } = await import('../server/services/workflowService.ts');
const { ticketStaff } = await import('../src/staff.ts');

function replace(context, object, name, implementation) {
  const original = object[name];
  object[name] = implementation;
  context.after(() => { object[name] = original; });
}

test('ticket assignment and queue creation are transactional', async (context) => {
  const assignments = [
    ['paud', 'BUG', 'arka'], ['paud', 'QUESTION', 'arka'], ['paud', 'COMPLAINT', 'arka'],
    ['posyandu', 'BUG', 'dr_ai'], ['posyandu', 'QUESTION', 'dr_ai'], ['posyandu', 'COMPLAINT', 'dr_ai'],
  ];
  for (const [division, category, staff] of assignments) assert.equal(ticketStaff(division, category), staff);
  let queued;
  replace(context, prisma, '$transaction', async (fn) => fn({
    officeTicket: { create: async ({ data }) => ({ ...data, id: 'ticket-test' }) },
    officeJob: { create: async ({ data }) => { queued = data; } },
  }));
  const app = express();
  app.use(express.json());
  app.use('/api/office-work', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/office-work/tickets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ division: 'paud', category: 'BUG', title: 'Uji', description: 'Data sintetis' }),
  });
  assert.equal(response.status, 201);
  assert.equal(queued.ticketId, 'ticket-test');
  assert.equal(queued.staffId, 'arka');
});

test('worker fences claims, persists one draft and reports generation failure', async (context) => {
  let job = { id: 'test-job', status: 'QUEUED', division: 'paud', staffId: 'arka', title: 'Uji', instruction: 'Data sintetis', ticketId: null };
  let drafts = 0;
  let savedDraft;
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = async () => ({});
  context.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });
  let release;
  let started;
  const gate = new Promise((resolve) => { release = resolve; });
  const began = new Promise((resolve) => { started = resolve; });
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    started(); await gate;
    const request = JSON.parse(String(options?.body));
    const instruction = request.messages[1].content;
    const productContent = [
      '=== BAGIAN 1: ISI PRODUK PEMBELI (DICETAK KE PDF) ===',
      'Judul Produk: Kit Konten UMKM',
      'Subjudul: Panduan praktis promosi harian untuk pemilik usaha kecil',
      'Jenis Produk: Template konten',
      'Target Pengguna: Pemilik usaha kecil',
      'Ringkasan: Template konten praktis siap pakai.',
      'Cara Pakai: Pilih template dan isi detail produk.',
      'Isi Produk:',
      '## Bab 1: Kumpulan Template Utama',
      '1. Template caption pengenalan produk siap pakai.',
      '=== METADATA & LISTING SELLER ===',
      'Deskripsi Listing Lynk.id: Kit konten siap pakai untuk UMKM.',
      'Saran Harga: Saran hipotesis Rp29.000 - Rp49.000.',
      'Batasan dan Catatan Verifikasi: Tinjau kelengkapan isi sebelum diunggah ke Lynk.id.',
    ].join('\n');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: instruction.includes('IDE YANG DIPILIH PIMPINAN') ? productContent : 'Laporan sintetis' } }] });
  });

  replace(context, prisma.officeJob, 'findFirst', async () => job.status === 'QUEUED' ? { ...job } : null);
  replace(context, prisma.officeJob, 'updateMany', async ({ where, data }) => {
    if (!where.id || where.id !== job.id || where.status !== job.status || (where.claimToken && where.claimToken !== job.claimToken)) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  });
  replace(context, prisma, '$transaction', async (fn) => fn({
    officeJob: { updateMany: prisma.officeJob.updateMany },
    officeDraft: { create: async ({ data }) => { drafts++; savedDraft = data; assert.equal(data.events.create.action, 'CREATED'); } },
  }));
  const first = processNextJob();
  await began;
  assert.equal(job.status, 'RUNNING');
  await processNextJob();
  assert.equal(drafts, 0);
  release();
  await first;
  assert.equal(job.status, 'DONE', job.error);
  assert.equal(job.draftId, 'job-test-job');
  assert.equal(drafts, 1);
  job = { ...job, id: 'test-fail', status: 'QUEUED', staffId: 'invalid' };
  await processNextJob();
  assert.equal(job.status, 'FAILED');
  assert.match(job.error, /Penugasan staf tidak valid/);
  assert.equal(drafts, 1);

  const sourceDraftId = 'job-digital-product-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29';
  job = {
    id: `${sourceDraftId}:creator-followup`,
    status: 'QUEUED',
    division: 'creator',
    staffId: 'script_ai',
    title: 'MVP produk digital',
    instruction: digitalProductFollowupInstruction('Riset sintetis untuk uji produk.', 'Ide terpilih: template UMKM.'),
    ticketId: null,
  };
  await processNextJob();
  assert.equal(job.status, 'DONE', job.error);
  assert.equal(savedDraft.data.sourceDraftId, sourceDraftId);
  assert.equal(savedDraft.data.status, 'PENDING');
  assert.equal(savedDraft.data.contentPackageVersion, undefined);
  assert.equal(savedDraft.data.productPackageVersion, 1);
  assert.equal(drafts, 2);
});

test('new Creator content packages avoid Pro-only CapCut workflows', async (context) => {
  let instruction = '';
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = async () => ({});
  context.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    instruction = JSON.parse(String(options?.body)).messages[1].content;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Laporan konten sintetis.' } }] });
  });
  replace(context, prisma.officeJob, 'findFirst', async () => ({
    id: 'creator-free-edit-test', status: 'QUEUED', division: 'creator', staffId: 'trendy',
    title: 'Paket konten uji', instruction: 'Siapkan konten edukasi.', ticketId: null,
  }));
  replace(context, prisma.officeJob, 'updateMany', async () => ({ count: 1 }));
  replace(context, prisma, '$transaction', async (fn) => fn({
    officeJob: { updateMany: async () => ({ count: 1 }) },
    officeDraft: { create: async () => ({}) },
  }));
  await processNextJob();
  assert.match(instruction, /Hindari alur Script to Video/i);
  assert.match(instruction, /berlabel Pro/i);
  assert.match(instruction, /pengganti sederhana tanpa biaya/i);
});

test('digital product research uses web search and saves a sourced draft without starting sprint follow-ups', async (context) => {
  const job = {
    id: 'digital-product-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29',
    status: 'QUEUED',
    division: 'creator',
    staffId: 'strategist',
    title: 'Riset produk digital non-aplikasi',
    instruction: 'Fokus riset hari ini: kebutuhan kreator konten independen.',
    ticketId: null,
  };
  let savedDraft;
  let webSearchEnabled = false;
  let researchModel = '';
  let researchInstruction = '';
  let followupsCreated = false;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    const body = JSON.parse(String(options?.body));
    webSearchEnabled = body.plugins?.some((plugin) => plugin.id === 'web') === true;
    researchModel = body.models[0];
    researchInstruction = body.messages[1].content;
    const report = [
      'Peluang dengan bukti publik.',
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
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: report, annotations: [
      { type: 'url_citation', url_citation: { title: 'Sumber publik 1', url: 'https://example.org/1' } },
      { type: 'url_citation', url_citation: { title: 'Sumber publik 2', url: 'https://example.org/2' } },
      { type: 'url_citation', url_citation: { title: 'Sumber publik 3', url: 'https://example.org/3' } },
    ] } }] });
  });
  replace(context, prisma.openRouterUsage, 'create', async () => ({}));
  replace(context, prisma.officeJob, 'findFirst', async () => job.status === 'QUEUED' ? { ...job } : null);
  replace(context, prisma.officeJob, 'updateMany', async ({ where, data }) => {
    if (where.id && where.id !== job.id) return { count: 0 };
    if (where.id && job.status !== where.status) return { count: 0 };
    if (where.id) Object.assign(job, data);
    return { count: where.id ? 1 : 0 };
  });
  replace(context, prisma, '$transaction', async (fn) => fn({
    officeJob: {
      updateMany: prisma.officeJob.updateMany,
      create: async () => { followupsCreated = true; },
    },
    officeDraft: { create: async ({ data }) => { savedDraft = data; } },
  }));

  await processNextJob();
  assert.equal(webSearchEnabled, true);
  assert.equal(researchModel, 'deepseek/deepseek-chat');
  assert.match(researchInstruction, /UMKM, kreator, pekerja lepas/i);
  assert.match(researchInstruction, /Fokus riset hari ini: kebutuhan kreator konten independen/);
  assert.match(researchInstruction, /Tanggal akses saat ini \(WIB\):/);
  assert.match(researchInstruction, /non-aplikasi/);
  assert.equal(job.status, 'DONE');
  assert.equal(job.draftId, `job-${job.id}`);
  assert.equal(savedDraft.data.division, 'creator');
  assert.equal(savedDraft.data.grounding.sources.length, 3);
  assert.equal(followupsCreated, false);
});

test('job listing includes all active jobs separately from recent history', async (context) => {
  const now = new Date();
  const makeJob = (id, status) => ({ id, status, division: 'paud', staffId: 'arka', title: id, ticketId: null, draftId: null, error: null, createdAt: now, updatedAt: now });
  replace(context, prisma.officeJob, 'findMany', async ({ where, take }) => {
    if (where.status.in.includes('RUNNING')) {
      assert.equal(take, undefined);
      return Array.from({ length: 101 }, (_, index) => makeJob(`active-${index}`, 'QUEUED'));
    }
    assert.equal(take, 100);
    return [makeJob('recent', 'DONE')];
  });
  const jobs = await listJobs();
  assert.equal(jobs.length, 102);
  assert.equal(jobs.filter((job) => job.status === 'QUEUED').length, 101);
});

test('daily creator scheduler assigns the daily task to Trendy', async (context) => {
  let created;
  replace(context, prisma.officeDraft, 'findUnique', async () => null);
  replace(context, prisma, '$transaction', async (fn) => fn({
    contentFlow: { create: async () => ({}) },
    officeJob: { create: async ({ data }) => { created = data; } },
  }));
  await runScheduledCreator(new Date('2032-04-03T23:00:00Z'));
  assert.equal(created.id, 'creator-daily-2032-04-04');
  assert.equal(created.staffId, 'trendy');
  assert.equal(created.division, 'creator');
});
