import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { prisma } from '../server/lib/prisma.ts';
import workflowRouter from '../server/routes/workflowRoutes.ts';

test('video controls require admin login and persist the enabled state', async (t) => {
  const previous = {
    password: process.env.OFFICE_ADMIN_PASSWORD,
    key: process.env.OPENROUTER_API_KEY,
    budget: process.env.OPENROUTER_MAX_MONTHLY_USD,
  };
  process.env.OFFICE_ADMIN_PASSWORD = 'synthetic-long-admin-password';
  process.env.OPENROUTER_API_KEY = 'synthetic-openrouter-key';
  process.env.OPENROUTER_MAX_MONTHLY_USD = '25';
  t.after(() => {
    if (previous.password === undefined) delete process.env.OFFICE_ADMIN_PASSWORD; else process.env.OFFICE_ADMIN_PASSWORD = previous.password;
    if (previous.key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previous.key;
    if (previous.budget === undefined) delete process.env.OPENROUTER_MAX_MONTHLY_USD; else process.env.OPENROUTER_MAX_MONTHLY_USD = previous.budget;
  });

  const originalConfigUpsert = prisma.videoRuntimeConfig.upsert;
  const originalVideoFindMany = prisma.videoJob.findMany;
  const originalDraftFindUnique = prisma.officeDraft.findUnique;
  const originalTransaction = prisma.$transaction;
  const config = { enabled: false, approvedBudgetIdr: 100000, updatedAt: new Date() };
  let queuedJobsCancelled = false;
  const upsertConfig = async ({ create, update }) => {
    if (typeof update.enabled === 'boolean') config.enabled = update.enabled;
    else if (config.enabled === undefined) config.enabled = create.enabled;
    return { ...config };
  };
  prisma.videoRuntimeConfig.upsert = upsertConfig;
  prisma.$transaction = async (callback) => callback({
    videoRuntimeConfig: { upsert: upsertConfig },
    videoJob: { updateMany: async ({ where, data }) => {
      queuedJobsCancelled = where.status === 'QUEUED' && data.status === 'CANCELLED';
      return { count: 1 };
    } },
    officeDraft: { findUnique: async () => null },
  });
  prisma.videoJob.findMany = async () => [];
  prisma.officeDraft.findUnique = async () => null;
  t.after(() => {
    prisma.videoRuntimeConfig.upsert = originalConfigUpsert;
    prisma.videoJob.findMany = originalVideoFindMany;
    prisma.officeDraft.findUnique = originalDraftFindUnique;
    prisma.$transaction = originalTransaction;
  });

  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (String(url).startsWith('https://openrouter.ai/api/v1/')) {
      return Response.json({ data: { limit: 25, limit_reset: 'monthly', limit_remaining: 25 } });
    }
    return originalFetch(url, options);
  });
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/workflow`;
  const origin = new URL(base).origin;
  const post = (path, body, cookie) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body ?? {}),
  });

  const unauthorized = await fetch(`${base}/admin/video`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(unauthorized.status, 401, await unauthorized.text());
  assert.equal((await post('/admin/login', { password: 'wrong-password' })).status, 401);
  const login = await post('/admin/login', { password: process.env.OFFICE_ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';', 1)[0];
  const toggle = await fetch(`${base}/admin/video`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(toggle.status, 200);
  assert.equal((await toggle.json()).enabled, true);
  assert.equal(config.enabled, true);
  assert.equal((await post('/videos/missing-draft', {}, cookie)).status, 404);
  assert.equal((await post('/videos/missing-draft', {})).status, 401);
  const disable = await fetch(`${base}/admin/video`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(disable.status, 200);
  assert.equal(config.enabled, false);
  assert.equal(queuedJobsCancelled, true);
  assert.equal((await post('/admin/logout', {}, cookie)).status, 200);
});
