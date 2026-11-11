import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../server/lib/prisma.ts';
import workflowRoutes from '../server/routes/workflowRoutes.ts';

function serve(context) {
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRoutes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return new Promise((resolve) => server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}/api/workflow`)));
}

function makeRecord(status = 'PENDING') {
  const now = new Date();
  return {
    id: 'marketing-manager-approved-report',
    updatedAt: now,
    data: {
      id: 'marketing-manager-approved-report',
      ticketId: null,
      division: 'marketing',
      title: 'Laporan Manajer Pemasaran Siput PAUD',
      content: 'Fitur terverifikasi: PPDB Online. Tautan resmi: https://siput.id',
      status,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
}

function mockMarketingTransaction(context, record, { sourceJob = true } = {}) {
  const jobs = [];
  const flows = [];
  const original = {
    findUnique: prisma.officeDraft.findUnique,
    jobFindFirst: prisma.officeJob.findFirst,
    jobFindMany: prisma.officeJob.findMany,
    flowFindUnique: prisma.contentFlow.findUnique,
    transaction: prisma.$transaction,
  };
  prisma.officeDraft.findUnique = async ({ where }) => where.id === record.id ? record : null;
  prisma.officeJob.findFirst = async () => sourceJob ? {
    instruction: 'Brief owner: Siput PAUD, fitur terverifikasi PPDB Online, tautan https://siput.id.',
  } : null;
  prisma.officeJob.findMany = async ({ where }) => jobs
    .filter((job) => job.contentFlowId === where.contentFlowId)
    .map((job) => ({
      id: job.id,
      staffId: job.staffId,
      title: job.title,
      status: job.status ?? 'QUEUED',
      draftId: job.draftId ?? null,
      error: job.error ?? null,
    }));
  prisma.contentFlow.findUnique = async ({ where }) => flows.find((flow) => flow.sourceDraftId === where.sourceDraftId) ?? null;
  prisma.$transaction = async (callback) => callback({
    officeDraft: {
      findUnique: async ({ where }) => where.id === record.id ? record : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== record.id || where.updatedAt !== record.updatedAt) return { count: 0 };
        record.data = data.data;
        record.updatedAt = new Date(record.data.updatedAt);
        return { count: 1 };
      },
    },
    officeDraftEvent: { create: async () => ({}) },
    officeJob: {
      findFirst: async () => sourceJob ? {
        instruction: 'Brief owner: Siput PAUD, fitur terverifikasi PPDB Online, tautan https://siput.id.',
      } : null,
      create: async ({ data }) => { jobs.push(data); return data; },
    },
    contentFlow: {
      findUnique: async ({ where }) => flows.find((flow) => flow.sourceDraftId === where.sourceDraftId) ?? null,
      create: async ({ data }) => { flows.push(data); return data; },
    },
  });
  context.after(() => {
    prisma.officeDraft.findUnique = original.findUnique;
    prisma.officeJob.findFirst = original.jobFindFirst;
    prisma.officeJob.findMany = original.jobFindMany;
    prisma.contentFlow.findUnique = original.flowFindUnique;
    prisma.$transaction = original.transaction;
  });
  return { jobs, flows };
}

test('approving a marketing manager report forwards it to Trendy, exactly once', async (context) => {
  const record = makeRecord();
  const { jobs, flows } = mockMarketingTransaction(context, record);
  const base = await serve(context);

  const response = await fetch(`${base}/drafts/${record.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'APPROVE' }),
  });
  assert.equal(response.status, 200);
  assert.equal(record.data.status, 'APPROVED');
  assert.equal(flows.length, 1);
  assert.equal(flows[0].sourceDraftId, record.id);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].division, 'creator');
  assert.equal(jobs[0].staffId, 'trendy');
  assert.equal(jobs[0].contentFlowId, flows[0].id);
  assert.match(jobs[0].instruction, /Fitur terverifikasi: PPDB Online/);
  assert.match(jobs[0].instruction, /tautan\/cara pemesanan resmi ada di brief/);

  const status = await fetch(`${base}/drafts/${record.id}/marketing-content-followup`);
  const statusData = await status.json();
  assert.equal(statusData.eligible, false);
  assert.equal(statusData.forwarded, true);
  assert.equal(statusData.flowId, flows[0].id);
  assert.equal(statusData.sourceBriefLinked, true);
  assert.deepEqual(statusData.stages.map(({ staffId, status }) => ({ staffId, status })), [{ staffId: 'trendy', status: 'QUEUED' }]);
  jobs[0].status = 'FAILED';
  jobs[0].error = 'Provider unavailable';
  const failedStatus = await fetch(`${base}/drafts/${record.id}/marketing-content-followup`);
  const failedStatusData = await failedStatus.json();
  assert.equal(failedStatusData.stages[0].status, 'FAILED');
  assert.equal(failedStatusData.stages[0].error, 'Provider unavailable');
  assert.equal(jobs.length, 1);
});

test('previously approved marketing reports can be forwarded manually once', async (context) => {
  const record = makeRecord('APPROVED');
  const { jobs, flows } = mockMarketingTransaction(context, record);
  const base = await serve(context);
  const url = `${base}/drafts/${record.id}/marketing-content-followup`;

  const status = await fetch(url);
  const statusData = await status.json();
  assert.equal(statusData.eligible, true);
  assert.equal(statusData.forwarded, false);
  assert.equal(statusData.flowId, null);
  assert.deepEqual(statusData.stages, []);
  const first = await fetch(url, { method: 'POST', headers: { Origin: base } });
  assert.equal(first.status, 202);
  assert.equal((await first.json()).created, true);
  const second = await fetch(url, { method: 'POST', headers: { Origin: base } });
  assert.equal(second.status, 202);
  assert.equal((await second.json()).created, false);
  assert.equal(flows.length, 1);
  assert.equal(jobs.length, 1);
});

test('approved marketing reports without a linked source job can still be forwarded safely', async (context) => {
  const record = makeRecord('APPROVED');
  const { jobs, flows } = mockMarketingTransaction(context, record, { sourceJob: false });
  const base = await serve(context);
  const url = `${base}/drafts/${record.id}/marketing-content-followup`;

  const status = await fetch(url);
  const statusData = await status.json();
  assert.equal(statusData.eligible, true);
  assert.equal(statusData.sourceBriefLinked, false);

  const response = await fetch(url, { method: 'POST', headers: { Origin: base } });
  assert.equal(response.status, 202);
  assert.equal(flows.length, 1);
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].instruction, /Brief asli Manajer Pemasaran tidak terhubung/);
  assert.match(jobs[0].instruction, /Gunakan hanya fakta yang tertulis dalam laporan disetujui/);
});
