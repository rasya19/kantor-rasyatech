import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../server/lib/prisma.ts';
import workflowRouter from '../server/routes/workflowRoutes.ts';

test('approved content videos can be regenerated after completion without replacing previous results', async (t) => {
  const previousPassword = process.env.OFFICE_ADMIN_PASSWORD;
  process.env.OFFICE_ADMIN_PASSWORD = 'synthetic-long-admin-password';
  t.after(() => {
    if (previousPassword === undefined) delete process.env.OFFICE_ADMIN_PASSWORD;
    else process.env.OFFICE_ADMIN_PASSWORD = previousPassword;
  });

  const draftId = 'approved-video-regeneration-draft';
  const now = new Date();
  const draft = {
    id: draftId,
    updatedAt: now,
    data: {
      id: draftId,
      ticketId: null,
      division: 'creator',
      title: 'Paket konten uji',
      content: `### 1. Video 1: Ide pertama
Naskah Narasi: "Naskah video pertama."

### 2. Video 2: Ide kedua
Naskah Narasi: "Naskah video kedua."`,
      status: 'APPROVED',
      contentPackageVersion: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  };
  const jobs = [];
  const originalConfigUpsert = prisma.videoRuntimeConfig.upsert;
  const originalTransaction = prisma.$transaction;
  const originalVideoFindUnique = prisma.videoJob.findUnique;
  const originalVideoUpdateMany = prisma.videoJob.updateMany;
  const updateUnknownJob = async ({ where, data }) => {
    const job = jobs.find((item) => item.id === where.id && item.status === where.status && item.activeDraftId === where.activeDraftId);
    if (!job) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  };
  prisma.videoRuntimeConfig.upsert = async () => ({ enabled: true, approvedBudgetIdr: 100000, updatedAt: now });
  prisma.videoJob.findUnique = async ({ where }) => jobs.find((job) => job.id === where.id) ?? null;
  prisma.videoJob.updateMany = updateUnknownJob;
  prisma.$transaction = async (callback) => callback({
    officeDraft: {
      findUnique: async () => draft,
      updateMany: async () => ({ count: 1 }),
    },
    videoJob: {
      findUnique: async ({ where }) => jobs.find((job) => job.activeDraftId === where.activeDraftId) ?? null,
      updateMany: updateUnknownJob,
      create: async ({ data }) => {
        const job = { id: `video-${jobs.length + 1}`, status: 'QUEUED', ...data };
        jobs.push(job);
        return { id: job.id };
      },
    },
  });
  t.after(() => {
    prisma.videoRuntimeConfig.upsert = originalConfigUpsert;
    prisma.$transaction = originalTransaction;
    prisma.videoJob.findUnique = originalVideoFindUnique;
    prisma.videoJob.updateMany = originalVideoUpdateMany;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const base = `http://127.0.0.1:${server.address().port}/api/workflow`;
  const origin = new URL(base).origin;
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ password: process.env.OFFICE_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';', 1)[0];
  const createVideo = (ideaKey) => fetch(`${base}/videos/${draftId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: ideaKey ? JSON.stringify({ ideaKey }) : undefined,
  });
  const acknowledgeUnknown = (id, checked = true) => fetch(`${base}/videos/${id}/acknowledge-unknown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ checked }),
  });

  const missingSelection = await createVideo();
  assert.equal(missingSelection.status, 400);
  assert.equal(jobs.length, 0);

  const invalidSelection = await createVideo('video-3-not-in-report');
  assert.equal(invalidSelection.status, 400);
  assert.equal(jobs.length, 0);

  const first = await createVideo('video-1-ide-pertama');
  assert.equal(first.status, 202);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].activeDraftId, draftId);
  assert.match(jobs[0].prompt, /Naskah video pertama/);
  assert.doesNotMatch(jobs[0].prompt, /Naskah video kedua/);

  const duplicateWhileActive = await createVideo('video-2-ide-kedua');
  assert.equal(duplicateWhileActive.status, 409);

  jobs[0].status = 'READY';
  jobs[0].activeDraftId = null;
  const regenerated = await createVideo('video-2-ide-kedua');
  assert.equal(regenerated.status, 202);
  assert.equal(jobs.length, 2);
  assert.notEqual(jobs[0].id, jobs[1].id);
  assert.equal(jobs[0].status, 'READY');
  assert.equal(jobs[1].draftId, draftId);
  assert.equal(jobs[1].activeDraftId, draftId);
  assert.match(jobs[1].prompt, /Naskah video kedua/);
  assert.doesNotMatch(jobs[1].prompt, /Naskah video pertama/);

  jobs[1].status = 'UNKNOWN';
  const unconfirmed = await acknowledgeUnknown(jobs[1].id, false);
  assert.equal(unconfirmed.status, 400);
  assert.equal(jobs[1].activeDraftId, draftId);
  const released = await acknowledgeUnknown(jobs[1].id);
  assert.equal(released.status, 200);
  assert.equal(jobs[1].status, 'FAILED');
  assert.equal(jobs[1].activeDraftId, null);
  assert.match(jobs[1].error, /Admin telah memeriksa/);
  const retry = await createVideo('video-2-ide-kedua');
  assert.equal(retry.status, 202);
  assert.equal(jobs.length, 3);
});
