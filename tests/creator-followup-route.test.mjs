import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const { prisma } = await import('../server/lib/prisma.ts');
const { default: routes } = await import('../server/routes/workflowRoutes.ts');

test('approved PAUD mandate can enqueue one Creator task only after verified facts are supplied', async (context) => {
  const draftId = 'job-source-1';
  const followupId = `${draftId}:creator-followup`;
  const now = new Date();
  const draft = {
    id: draftId,
    ticketId: null,
    division: 'paud',
    title: 'Mandat Arka: buatkan panduan sekaligus jadi konten menarik client',
    content: 'Draft context; not verified facts.',
    ai: { provider: 'openrouter', model: 'google/gemini-2.5-flash' },
    status: 'APPROVED',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  const storedDraft = { id: draftId, ticketId: null, data: draft, updatedAt: now };
  const sourceJob = {
    id: 'source-1',
    draftId,
    division: 'paud',
    ticketId: null,
    status: 'DONE',
    instruction: 'Buatkan panduan sekaligus jadi konten menarik untuk klien.',
  };
  const jobs = new Map([[sourceJob.id, sourceJob]]);
  const original = {
    draftFindUnique: prisma.officeDraft.findUnique,
    draftUpdateMany: prisma.officeDraft.updateMany,
    jobFindFirst: prisma.officeJob.findFirst,
    jobFindUnique: prisma.officeJob.findUnique,
    jobCreate: prisma.officeJob.create,
    transaction: prisma.$transaction,
  };
  prisma.officeDraft.findUnique = async ({ where }) => where.id === draftId ? storedDraft : null;
  prisma.officeDraft.updateMany = async ({ where }) => where.id === draftId && where.updatedAt === now ? { count: 1 } : { count: 0 };
  prisma.officeJob.findFirst = async ({ where }) => where.draftId === draftId ? sourceJob : null;
  prisma.officeJob.findUnique = async ({ where }) => jobs.get(where.id) ?? null;
  prisma.officeJob.create = async ({ data }) => {
    const job = { ...data, status: 'QUEUED' };
    jobs.set(data.id, job);
    return job;
  };
  prisma.$transaction = async (callback) => callback({
    officeDraft: { findUnique: prisma.officeDraft.findUnique, updateMany: prisma.officeDraft.updateMany },
    officeJob: { findFirst: prisma.officeJob.findFirst, findUnique: prisma.officeJob.findUnique, create: prisma.officeJob.create },
  });
  context.after(() => {
    prisma.officeDraft.findUnique = original.draftFindUnique;
    prisma.officeDraft.updateMany = original.draftUpdateMany;
    prisma.officeJob.findFirst = original.jobFindFirst;
    prisma.officeJob.findUnique = original.jobFindUnique;
    prisma.officeJob.create = original.jobCreate;
    prisma.$transaction = original.transaction;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/workflow/drafts/${encodeURIComponent(draftId)}/creator-followup`;

  let response = await fetch(base);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { eligible: true, status: null });

  response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 400);

  response = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verifiedFacts: 'Fitur A tersedia; Fitur B belum ada.' }),
  });
  assert.equal(response.status, 202);
  const queued = await response.json();
  assert.deepEqual(queued, { id: followupId, status: 'QUEUED', created: true });
  assert.match(jobs.get(followupId).instruction, /Fitur A tersedia; Fitur B belum ada/);
  assert.match(jobs.get(followupId).instruction, /Draf sebelumnya hanya konteks, bukan bukti produk/);

  response = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verifiedFacts: 'Fitur A tersedia.' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: followupId, status: 'QUEUED', created: false });
  assert.equal([...jobs.keys()].filter((id) => id === followupId).length, 1);
});
