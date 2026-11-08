import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.GEMINI_API_KEY = 'test-key-not-used';
const { prisma } = await import('../server/lib/prisma.ts');
const { aiClient } = await import('../server/config/gemini.ts');
const { default: routes } = await import('../server/routes/jobRoutes.ts');
const { processNextJob, listJobs } = await import('../server/services/jobService.ts');
const { runScheduledCreator } = await import('../server/services/workflowService.ts');
const { ticketStaff } = await import('../src/staff.ts');

function replace(context, object, name, implementation) {
  const original = object[name];
  object[name] = implementation;
  context.after(() => { object[name] = original; });
}

test('ticket assignment and queue creation are transactional', async (context) => {
  const assignments = [
    ['paud', 'BUG', 'arka'], ['paud', 'QUESTION', 'lisa'], ['paud', 'COMPLAINT', 'dewi'],
    ['posyandu', 'BUG', 'dr_ai'], ['posyandu', 'QUESTION', 'budi'], ['posyandu', 'COMPLAINT', 'sari'],
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
  let release;
  let started;
  const gate = new Promise((resolve) => { release = resolve; });
  const began = new Promise((resolve) => { started = resolve; });
  context.mock.method(aiClient.models, 'generateContent', async () => { started(); await gate; return { text: 'Laporan sintetis' }; });
  replace(context, prisma.officeJob, 'findFirst', async () => job.status === 'QUEUED' ? { ...job } : null);
  replace(context, prisma.officeJob, 'updateMany', async ({ where, data }) => {
    if (!where.id || where.id !== job.id || where.status !== job.status || (where.claimToken && where.claimToken !== job.claimToken)) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  });
  replace(context, prisma, '$transaction', async (fn) => fn({
    officeJob: { updateMany: prisma.officeJob.updateMany },
    officeDraft: { create: async ({ data }) => { drafts++; assert.equal(data.events.create.action, 'CREATED'); } },
  }));
  const first = processNextJob();
  await began;
  assert.equal(job.status, 'RUNNING');
  await processNextJob();
  assert.equal(drafts, 0);
  release();
  await first;
  assert.equal(job.status, 'DONE');
  assert.equal(job.draftId, 'job-test-job');
  assert.equal(drafts, 1);
  job = { ...job, id: 'test-fail', status: 'QUEUED', staffId: 'invalid' };
  await processNextJob();
  assert.equal(job.status, 'FAILED');
  assert.match(job.error, /Penugasan staf tidak valid/);
  assert.equal(drafts, 1);
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
