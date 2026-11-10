import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

test('weekly research creates one connected job per division and preserves approval boundaries', { skip: process.env.OFFICE_DB_TEST !== '1' }, async (context) => {
  process.env.OPENROUTER_API_KEY = 'test-key-not-used';
  const { prisma } = await import('../server/lib/prisma.ts');
  const { scheduleWeeklyResearch, weeklyResearchId } = await import('../server/services/opportunityFlow.ts');
  const { processNextJob } = await import('../server/services/jobService.ts');
  const { default: routes } = await import('../server/routes/workflowRoutes.ts');
  const date = new Date('2001-01-08T00:00:00Z');
  const id = weeklyResearchId(date);
  const failureDate = new Date('2001-01-15T00:00:00Z');
  const failedId = weeklyResearchId(failureDate);
  assert.equal(await prisma.officeJob.findUnique({ where: { id } }), null, 'Synthetic test ID already exists');
  assert.equal(await prisma.officeJob.findUnique({ where: { id: failedId } }), null, 'Synthetic failure test ID already exists');
  const originalFind = prisma.officeJob.findFirst;
  const originalUpdate = prisma.officeJob.updateMany;
  const oldVideo = process.env.VIDEO_ENABLED;
  process.env.VIDEO_ENABLED = 'true';
  let includeSource = true;
  const originalFetch = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    const request = JSON.parse(options.body);
    const message = request.plugins
      ? { content: 'Riset contoh warung.', annotations: includeSource ? [{ type: 'url_citation', url_citation: { title: 'Sumber', url: 'https://example.org/', start_index: 0, end_index: 20 } }] : [] }
      : { content: 'Judul Tren: contoh\nKonsep: contoh\nHook 3 Detik: contoh\nNaskah Narasi: contoh\nCaption: contoh\nTarget Platform: TikTok\nTata Letak Visual: contoh\nHal yang Perlu Diverifikasi: contoh' };
    return Response.json({ choices: [{ finish_reason: 'stop', message }] });
  });
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await Promise.all([scheduleWeeklyResearch(date), scheduleWeeklyResearch(date)]);
    assert.equal(await prisma.officeJob.count({ where: { id } }), 1);
    prisma.officeJob.findFirst = async () => originalFind({ where: { id, status: 'QUEUED' } });
    prisma.officeJob.updateMany = async (args) => args.where.id ? originalUpdate(args) : { count: 0 };
    await processNextJob();
    assert.equal((await prisma.officeJob.findUnique({ where: { id } })).status, 'DONE');
    const jobs = await prisma.officeJob.findMany({ where: { id: { startsWith: `${id}:` } } });
    assert.equal(jobs.length, 5);
    assert.deepEqual(new Set(jobs.map((job) => job.division)), new Set(['paud', 'posyandu', 'engineer', 'creator', 'cyber']));
    for (const job of jobs) {
      prisma.officeJob.findFirst = async () => originalFind({ where: { id: job.id, status: 'QUEUED' } });
      await processNextJob();
      const done = await prisma.officeJob.findUnique({ where: { id: job.id } });
      assert.equal(done.status, 'DONE');
      const draft = await prisma.officeDraft.findUnique({ where: { id: done.draftId } });
      assert.equal(draft.data.sourceDraftId, `job-${id}`);
      assert.equal(draft.data.status, 'PENDING');
    }
    const creator = jobs.find((job) => job.division === 'creator');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/workflow/drafts/job-${creator.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'APPROVE' }),
    });
    assert.equal(response.status, 200);
    assert.equal(await prisma.videoJob.count({ where: { draftId: `job-${creator.id}` } }), 0);
    const listed = await (await fetch(`http://127.0.0.1:${server.address().port}/api/workflow/drafts`)).json();
    assert.equal(listed.drafts.find((draft) => draft.id === `job-${creator.id}`).sourceDraftId, `job-${id}`);

    includeSource = false;
    await scheduleWeeklyResearch(failureDate);
    prisma.officeJob.findFirst = async () => originalFind({ where: { id: failedId, status: 'QUEUED' } });
    await processNextJob();
    const failed = await prisma.officeJob.findUnique({ where: { id: failedId } });
    assert.equal(failed.status, 'FAILED');
    assert.match(failed.error, /sumber pencarian/);
    assert.equal(await prisma.officeJob.count({ where: { id: { startsWith: `${failedId}:` } } }), 0);
    await scheduleWeeklyResearch(failureDate);
    assert.equal((await prisma.officeJob.findUnique({ where: { id: failedId } })).status, 'FAILED');
  } finally {
    prisma.officeJob.findFirst = originalFind;
    prisma.officeJob.updateMany = originalUpdate;
    if (oldVideo === undefined) delete process.env.VIDEO_ENABLED; else process.env.VIDEO_ENABLED = oldVideo;
    await prisma.officeDraft.deleteMany({ where: { id: { in: [`job-${id}`, ...['sales_paud', 'sales_posyandu', 'qa', 'strategist', 'guard_ai'].map((staff) => `job-${id}:${staff}`)] } } });
    await prisma.officeJob.deleteMany({ where: { OR: [{ id }, { id: failedId }, { id: { startsWith: `${id}:` } }] } });
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
