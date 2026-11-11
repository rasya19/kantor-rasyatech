import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../server/lib/prisma.ts';
import workflowRoutes from '../server/routes/workflowRoutes.ts';

test('approved product-research content mandate is forwarded to Trendy once', async (t) => {
  const draftId = 'approved-engineer-content-mandate';
  const now = new Date();
  const record = {
    id: draftId,
    updatedAt: now,
    data: {
      id: draftId,
      ticketId: null,
      division: 'engineer',
      title: 'Mandat Riset Produk: buatkan konten yang dibutuhkan',
      content: 'Laporan riset yang telah disetujui.',
      status: 'APPROVED',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
  const flows = [];
  const jobs = [];
  const originalFindUnique = prisma.officeDraft.findUnique;
  const originalTransaction = prisma.$transaction;
  prisma.officeDraft.findUnique = async ({ where }) => where.id === draftId ? record : null;
  prisma.$transaction = async (callback) => callback({
    officeDraft: { findUnique: async ({ where }) => where.id === draftId ? record : null },
    officeJob: {
      findFirst: async () => ({
        instruction: 'Mandat pimpinan: buatkan konten yang umum tapi dibutuhkan dari hasil riset.',
      }),
      create: async ({ data }) => { jobs.push(data); return data; },
    },
    contentFlow: {
      findUnique: async ({ where }) => flows.find((flow) => flow.sourceDraftId === where.sourceDraftId) ?? null,
      create: async ({ data }) => { flows.push(data); return data; },
    },
  });
  t.after(() => {
    prisma.officeDraft.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${server.address().port}/api/workflow/drafts/${draftId}/mandate-content-followup`;

  const origin = new URL(url).origin;
  const first = await fetch(url, { method: 'POST', headers: { Origin: origin } });
  assert.equal(first.status, 202);
  const firstResult = await first.json();
  assert.equal(firstResult.created, true);
  assert.equal(flows.length, 1);
  assert.equal(flows[0].sourceDraftId, draftId);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].staffId, 'trendy');
  assert.equal(jobs[0].division, 'creator');
  assert.match(jobs[0].instruction, /laporan yang disetujui/);
  assert.match(jobs[0].instruction, /jangan.*memublikasikan video/i);

  const second = await fetch(url, { method: 'POST', headers: { Origin: origin } });
  assert.equal(second.status, 202);
  assert.deepEqual(await second.json(), { id: firstResult.id, created: false });
  assert.equal(flows.length, 1);
  assert.equal(jobs.length, 1);
});

test('approving a matching engineer research mandate automatically queues Trendy', async (t) => {
  const draftId = 'pending-engineer-content-mandate';
  const now = new Date();
  const record = {
    id: draftId,
    updatedAt: now,
    data: {
      id: draftId,
      ticketId: null,
      division: 'engineer',
      title: 'Mandat Riset Produk: buatkan konten',
      content: 'Laporan riset sintetis.',
      status: 'PENDING',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
  const flows = [];
  const jobs = [];
  const originalFindUnique = prisma.officeDraft.findUnique;
  const originalTransaction = prisma.$transaction;
  prisma.officeDraft.findUnique = async ({ where }) => where.id === draftId ? record : null;
  prisma.$transaction = async (callback) => callback({
    officeDraft: {
      findUnique: async ({ where }) => where.id === draftId ? record : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== draftId || where.updatedAt !== record.updatedAt) return { count: 0 };
        record.data = data.data;
        record.updatedAt = new Date(record.data.updatedAt);
        return { count: 1 };
      },
    },
    officeDraftEvent: { create: async () => ({}) },
    officeJob: {
      findFirst: async () => ({
        instruction: 'Mandat pimpinan: buatkan konten yang dibutuhkan dari hasil riset.',
      }),
      create: async ({ data }) => { jobs.push(data); return data; },
    },
    contentFlow: {
      findUnique: async ({ where }) => flows.find((flow) => flow.sourceDraftId === where.sourceDraftId) ?? null,
      create: async ({ data }) => { flows.push(data); return data; },
    },
  });
  t.after(() => {
    prisma.officeDraft.findUnique = originalFindUnique;
    prisma.$transaction = originalTransaction;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/workflow/drafts/${draftId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });

  assert.equal(response.status, 200);
  assert.equal(record.data.status, 'APPROVED');
  assert.equal(flows.length, 1);
  assert.equal(flows[0].sourceDraftId, draftId);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].staffId, 'trendy');
  assert.equal(jobs[0].contentFlowId, flows[0].id);
});
