import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';

test('selected draft deletion removes ordinary drafts and rejects active tasks', async (context) => {
  const { prisma } = await import('../server/lib/prisma.ts');
  const { default: routes } = await import('../server/routes/workflowRoutes.ts');
  const drafts = new Map();
  const jobs = new Map();
  const now = new Date().toISOString();
  const draftData = (id, title) => ({
    id, ticketId: null, division: 'engineer', title, content: 'Uji sintetis.',
    status: 'PENDING', createdAt: now, updatedAt: now,
  });
  const addDraft = (id, title) => {
    const data = draftData(id, title);
    drafts.set(id, { id, ticketId: null, data });
  };
  addDraft('ordinary-draft', 'Laporan biasa');
  addDraft('active-mandate', 'Mandat aktif');
  jobs.set('active-job', {
    id: 'active-job', title: 'Mandat aktif', status: 'RUNNING', draftId: 'active-mandate',
    ticketId: null, contentFlowId: null,
  });

  const tx = {
    officeDraft: {
      findUnique: async ({ where }) => drafts.get(where.id) ?? null,
      findMany: async ({ where }) => [...drafts.values()].filter((item) => where.id.in.includes(item.id)),
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const id of where.id.in) if (drafts.delete(id)) count++;
        return { count };
      },
    },
    officeJob: {
      findMany: async ({ where }) => {
        if (where.draftId) return [...jobs.values()].filter((job) => job.draftId === where.draftId);
        if (where.id?.in) return [...jobs.values()].filter((job) => where.id.in.includes(job.id));
        return [];
      },
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const id of where.id.in) {
          const job = jobs.get(id);
          if (job && !['QUEUED', 'RUNNING'].includes(job.status)) {
            jobs.delete(id);
            count++;
          }
        }
        return { count };
      },
    },
    contentFlow: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    videoJob: { findFirst: async () => null },
  };
  const originalTransaction = prisma.$transaction;
  prisma.$transaction = async (callback) => callback(tx);
  context.after(() => { prisma.$transaction = originalTransaction; });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}/api/workflow/drafts`;
  const remove = async (id) => {
    const response = await fetch(`${base}/${id}`, { method: 'DELETE' });
    return { status: response.status, body: await response.json() };
  };

  const ordinary = await remove('ordinary-draft');
  assert.equal(ordinary.status, 200);
  assert.equal(ordinary.body.deletedDrafts, 1);
  assert.equal(drafts.has('ordinary-draft'), false);
  const active = await remove('active-mandate');
  assert.equal(active.status, 409);
  assert.ok(drafts.has('active-mandate'));
  assert.ok(jobs.has('active-job'));

  addDraft('deletable-mandate', 'Mandat uji terpilih');
  const deleted = await remove('deletable-mandate');
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.deletedDrafts, 1);
  assert.equal(deleted.body.deletedJobs, 0);
  assert.equal(drafts.has('deletable-mandate'), false);
});

test('selected draft deletion removes its completed flow and protects active or unrelated data', { skip: process.env.OFFICE_DB_TEST !== '1' }, async (context) => {
  const { prisma } = await import('../server/lib/prisma.ts');
  const { default: routes } = await import('../server/routes/workflowRoutes.ts');
  const marker = randomUUID();
  const draftIds = [];
  const jobIds = [];
  const flowIds = [];
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/workflow`;
  const createDraft = async (id, title) => {
    const now = new Date().toISOString();
    const data = {
      id, ticketId: null, division: 'creator', title, content: 'Uji sintetis.',
      status: 'PENDING', createdAt: now, updatedAt: now,
    };
    await prisma.officeDraft.create({ data: { id, data, events: { create: { action: 'CREATED', data } } } });
    draftIds.push(id);
  };
  const callDelete = async (id) => {
    const response = await fetch(`${base}/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { status: response.status, data: await response.json() };
  };
  try {
    const mandateDraftId = `delete-test-draft-${marker}`;
    const mandateJobId = `delete-test-job-${marker}`;
    const flowId = `delete-test-flow-${marker}`;
    const flowDraftId = `delete-test-flow-draft-${marker}`;
    const flowJobId = `${mandateJobId}:clipper`;
    await createDraft(mandateDraftId, `Mandat uji ${marker}`);
    await prisma.officeJob.create({
      data: { id: mandateJobId, division: 'creator', staffId: 'trendy', title: `Mandat uji ${marker}`, instruction: 'Data sintetis.', status: 'DONE', draftId: mandateDraftId },
    });
    jobIds.push(mandateJobId);
    await prisma.contentFlow.create({ data: { id: flowId, sourceDraftId: mandateDraftId } });
    flowIds.push(flowId);
    await createDraft(flowDraftId, `Hasil turunan ${marker}`);
    await prisma.officeJob.create({
      data: { id: flowJobId, division: 'creator', staffId: 'clipper', title: `Hasil turunan ${marker}`, instruction: 'Data sintetis.', status: 'DONE', draftId: flowDraftId, contentFlowId: flowId },
    });
    jobIds.push(flowJobId);

    const removed = await callDelete(mandateDraftId);
    assert.equal(removed.status, 200);
    assert.equal(removed.data.deletedDrafts, 2);
    assert.equal(removed.data.deletedJobs, 2);
    assert.equal(await prisma.officeDraft.findUnique({ where: { id: mandateDraftId } }), null);
    assert.equal(await prisma.officeDraft.findUnique({ where: { id: flowDraftId } }), null);
    assert.equal(await prisma.officeJob.findUnique({ where: { id: mandateJobId } }), null);
    assert.equal(await prisma.officeJob.findUnique({ where: { id: flowJobId } }), null);
    assert.equal(await prisma.contentFlow.findUnique({ where: { id: flowId } }), null);
    draftIds.length = 0;
    jobIds.length = 0;
    flowIds.length = 0;

    const unrelatedDraftId = `delete-test-unrelated-${marker}`;
    await createDraft(unrelatedDraftId, `Laporan biasa ${marker}`);
    const unrelated = await callDelete(unrelatedDraftId);
    assert.equal(unrelated.status, 403);
    assert.ok(await prisma.officeDraft.findUnique({ where: { id: unrelatedDraftId } }));

    const activeDraftId = `delete-test-active-draft-${marker}`;
    const activeJobId = `delete-test-active-job-${marker}`;
    await createDraft(activeDraftId, `Mandat aktif ${marker}`);
    await prisma.officeJob.create({
      data: { id: activeJobId, division: 'engineer', staffId: 'arka', title: `Mandat aktif ${marker}`, instruction: 'Data sintetis.', status: 'RUNNING', draftId: activeDraftId },
    });
    jobIds.push(activeJobId);
    const active = await callDelete(activeDraftId);
    assert.equal(active.status, 409);
    assert.ok(await prisma.officeDraft.findUnique({ where: { id: activeDraftId } }));
    assert.ok(await prisma.officeJob.findUnique({ where: { id: activeJobId } }));
  } finally {
    if (jobIds.length) await prisma.officeJob.deleteMany({ where: { id: { in: jobIds } } });
    if (flowIds.length) await prisma.contentFlow.deleteMany({ where: { id: { in: flowIds } } });
    if (draftIds.length) await prisma.officeDraft.deleteMany({ where: { id: { in: draftIds } } });
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
