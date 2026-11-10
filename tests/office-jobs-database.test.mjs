import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';

test('synthetic ticket, failed job, retry and draft persist in PostgreSQL', { skip: process.env.OFFICE_DB_TEST !== '1' }, async (context) => {
  process.env.OPENROUTER_API_KEY = 'test-key-not-used';
  const { prisma } = await import('../server/lib/prisma.ts');
  const { default: routes } = await import('../server/routes/jobRoutes.ts');
  const { processNextJob } = await import('../server/services/jobService.ts');
  const marker = `synthetic-${randomUUID()}`;
  let ticketId;
  let jobId;
  const originalFindFirst = prisma.officeJob.findFirst;
  const originalUpdateMany = prisma.officeJob.updateMany;
  const originalFetch = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Laporan sintetis untuk pengujian.' } }] });
  });
  const app = express();
  app.use(express.json());
  app.use('/api/office-work', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/office-work`;
  try {
    const response = await fetch(`${base}/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ division: 'paud', category: 'BUG', title: marker, description: 'Data sintetis tanpa informasi pengguna.' }),
    });
    assert.equal(response.status, 201);
    ticketId = (await response.json()).ticket.id;
    const created = await prisma.officeJob.findFirst({ where: { ticketId } });
    assert.equal(created.staffId, 'arka');
    jobId = created.id;
    prisma.officeJob.findFirst = async () => prisma.officeJob.findUnique({ where: { id: jobId } });
    prisma.officeJob.updateMany = async (args) => args.where.id === jobId ? originalUpdateMany(args) : { count: 0 };
    await prisma.officeJob.update({ where: { id: jobId }, data: { staffId: 'invalid' } });
    await processNextJob();
    assert.equal((await prisma.officeJob.findUnique({ where: { id: jobId } })).status, 'FAILED');
    await prisma.officeJob.update({ where: { id: jobId }, data: { staffId: 'arka' } });
    const retry = await fetch(`${base}/jobs/${jobId}/retry`, { method: 'POST' });
    assert.equal(retry.status, 200);
    await processNextJob();
    const done = await prisma.officeJob.findUnique({ where: { id: jobId } });
    assert.equal(done.status, 'DONE');
    assert.equal(done.draftId, `job-${jobId}`);
    const draft = await prisma.officeDraft.findUnique({ where: { id: done.draftId }, include: { events: true } });
    assert.equal(draft.ticketId, ticketId);
    assert.equal(draft.data.content, 'Laporan sintetis untuk pengujian.');
    assert.equal(draft.events.length, 1);
  } finally {
    prisma.officeJob.findFirst = originalFindFirst;
    prisma.officeJob.updateMany = originalUpdateMany;
    if (jobId) {
      await prisma.officeDraft.deleteMany({ where: { id: `job-${jobId}`, ticketId } });
      await prisma.officeJob.deleteMany({ where: { id: jobId, ticketId } });
      assert.equal(await prisma.officeDraft.findUnique({ where: { id: `job-${jobId}` } }), null);
      assert.equal(await prisma.officeJob.findUnique({ where: { id: jobId } }), null);
    }
    if (ticketId) {
      await prisma.officeTicket.deleteMany({ where: { id: ticketId, title: marker } });
      assert.equal(await prisma.officeTicket.findUnique({ where: { id: ticketId } }), null);
    }
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
