import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const { prisma } = await import('../server/lib/prisma.ts');
const { default: routes } = await import('../server/routes/workflowRoutes.ts');

test('approving digital product research does not choose or queue a product without owner selection', async (context) => {
  const draftId = 'job-digital-product-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29';
  const now = new Date();
  const record = {
    id: draftId,
    updatedAt: now,
    data: {
      id: draftId,
      ticketId: null,
      division: 'creator',
      title: 'Riset peluang produk digital pendidikan non-aplikasi',
      content: 'Riset sintetis dengan hipotesis harga Rp25.000–Rp50.000.',
      status: 'PENDING',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
  const jobs = [];
  const events = [];
  const original = {
    findUnique: prisma.officeDraft.findUnique,
    transaction: prisma.$transaction,
  };
  prisma.officeDraft.findUnique = async ({ where }) => where.id === draftId ? record : null;
  prisma.$transaction = async (callback) => callback({
    officeDraft: {
      updateMany: async ({ where, data }) => {
        if (where.id !== draftId || where.updatedAt !== record.updatedAt) return { count: 0 };
        record.data = data.data;
        record.updatedAt = new Date(record.data.updatedAt);
        return { count: 1 };
      },
      events: { create: async ({ data }) => { events.push(data); } },
    },
    officeDraftEvent: { create: async ({ data }) => { events.push(data); } },
    officeJob: { create: async ({ data }) => { jobs.push(data); } },
  });
  context.after(() => {
    prisma.officeDraft.findUnique = original.findUnique;
    prisma.$transaction = original.transaction;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/workflow/drafts/${draftId}`;

  const approved = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).draft.status, 'APPROVED');
  assert.equal(record.data.status, 'APPROVED');
  assert.equal(events.length, 1);
  assert.equal(jobs.length, 0);

  const repeatedApproval = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });
  assert.equal(repeatedApproval.status, 409);
  assert.equal(jobs.length, 0);
});

test('approved digital-product research queues only each explicitly selected concept, idempotently', async (context) => {
  const draftId = 'job-digital-product-research-58bf9bd1-24fb-4c1a-98eb-a55a5f320a29';
  const now = new Date();
  const content = [
    '## IDE PRODUK 1: Workbook UMKM',
    'Masalah: pencatatan harian berantakan.',
    'Format: workbook yang dapat dicetak.',
    '## IDE PRODUK 2: Kit Konten Kreator',
    'Masalah: kehabisan ide untuk publikasi.',
    'Format: template konten yang dapat diedit.',
  ].join('\n');
  const record = {
    id: draftId,
    updatedAt: now,
    data: { id: draftId, ticketId: null, division: 'creator', title: 'Riset peluang', content, status: 'APPROVED', createdAt: now.toISOString(), updatedAt: now.toISOString() },
  };
  const jobs = new Map();
  const originalFindUnique = prisma.officeDraft.findUnique;
  const originalTransaction = prisma.$transaction;
  prisma.officeDraft.findUnique = async ({ where }) => where.id === draftId ? record : null;
  prisma.$transaction = async (callback) => callback({
    officeDraft: {
      findUnique: async ({ where }) => where.id === draftId ? record : null,
      updateMany: async ({ where }) => where.id === draftId && where.updatedAt === record.updatedAt ? { count: 1 } : { count: 0 },
    },
    officeJob: {
      findUnique: async ({ where }) => jobs.get(where.id) ?? null,
      create: async ({ data }) => { jobs.set(data.id, { id: data.id, status: 'QUEUED', ...data }); return data; },
    },
  });
  context.after(() => {
    prisma.officeDraft.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/workflow/drafts/${draftId}/digital-product-ideas`;
  async function select(title, concept) {
    return fetch(url, {
      method: 'POST',
      headers: { Origin: new URL(url).origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptTitle: title, concept }),
    });
  }
  const ideas = [
    ['Workbook UMKM', '## IDE PRODUK 1: Workbook UMKM\nMasalah: pencatatan harian berantakan.\nFormat: workbook yang dapat dicetak.'],
    ['Kit Konten Kreator', '## IDE PRODUK 2: Kit Konten Kreator\nMasalah: kehabisan ide untuk publikasi.\nFormat: template konten yang dapat diedit.'],
  ];
  const first = await select(...ideas[0]);
  const second = await select(...ideas[1]);
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  const firstJob = await first.json();
  const secondJob = await second.json();
  assert.notEqual(firstJob.id, secondJob.id);
  assert.equal(jobs.size, 2);
  assert.match(jobs.get(firstJob.id).instruction, /IDE PRODUK 1: Workbook UMKM/);
  assert.match(jobs.get(firstJob.id).instruction, /Jangan memilih ide lain/);
  assert.deepEqual(await (await select(...ideas[0])).json(), { id: firstJob.id, status: 'QUEUED', created: false });
  assert.equal(jobs.size, 2);
});

test('approving a digital product package queues its promotional content flow once', async (context) => {
  let draftId = 'product-package-test';
  const now = new Date();
  const record = {
    id: draftId,
    updatedAt: now,
    data: {
      id: draftId,
      ticketId: null,
      division: 'creator',
      title: 'Paket Prompt Guru',
      content: 'Isi produk yang telah ditinjau.',
      productPackageVersion: 1,
      status: 'PENDING',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
  const createdFlows = [];
  const createdJobs = [];
  const original = {
    findUnique: prisma.officeDraft.findUnique,
    transaction: prisma.$transaction,
  };
  prisma.officeDraft.findUnique = async ({ where }) => where.id === draftId ? record : null;
  prisma.$transaction = async (callback) => callback({
    officeDraft: {
      updateMany: async ({ where, data }) => {
        if (where.id !== draftId || where.updatedAt !== record.updatedAt) return { count: 0 };
        record.data = data.data;
        record.updatedAt = new Date(record.data.updatedAt);
        return { count: 1 };
      },
    },
    officeDraftEvent: { create: async () => ({}) },
    contentFlow: { create: async ({ data }) => { createdFlows.push(data); } },
    officeJob: { create: async ({ data }) => { createdJobs.push(data); } },
  });
  context.after(() => {
    prisma.officeDraft.findUnique = original.findUnique;
    prisma.$transaction = original.transaction;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/workflow/drafts/${draftId}`;

  const approved = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });
  assert.equal(approved.status, 200);
  assert.equal(createdFlows.length, 1);
  assert.equal(createdFlows[0].sourceDraftId, draftId);
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].staffId, 'trendy');
  assert.equal(createdJobs[0].contentFlowId, createdFlows[0].id);
  assert.match(createdJobs[0].instruction, /Isi produk yang telah ditinjau/);
});
