import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';

test('content flows hand off atomically and old approved Trendy drafts continue once', { skip: process.env.OFFICE_DB_TEST !== '1' }, async (t) => {
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  process.env.VIDEO_ENABLED = 'false';
  delete process.env.AI_COPILOT_DIVISIONS;
  const { prisma } = await import('../server/lib/prisma.ts');
  const { default: jobsRouter } = await import('../server/routes/jobRoutes.ts');
  const { default: workflowRouter } = await import('../server/routes/workflowRoutes.ts');
  const { processNextJob } = await import('../server/services/jobService.ts');
  const marker = `uji-${randomUUID()}`;
  const oldJobId = `${marker}-old`;
  const oldDraftId = `job-${oldJobId}`;
  const flowIds = [];
  let currentFlow;
  let calls = 0;
  let failOnce = true;
  let incompleteOnce = true;
  const packageText = 'Judul Tren: Ide sintetis\nKonsep: Edukasi\nHook 3 Detik: Pertanyaan\nNaskah Narasi: Narasi sintetis\nCaption: Caption #edukasi\nTarget Platform: TikTok, Reels, Shorts\nTata Letak Visual: Template 9:16\nHal yang Perlu Diverifikasi: Fitur produk';
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/')) return originalFetch(url, options);
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    const contents = JSON.parse(options.body).messages[1].content;
    if (failOnce) { failOnce = false; return new Response('', { status: 429 }); }
    calls++;
    if (contents.includes('Siapkan paket konten siap pakai') && incompleteOnce) {
      incompleteOnce = false;
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Paket sintetis belum lengkap' } }] });
    }
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: contents.includes('Siapkan paket konten siap pakai') ? packageText : `hasil sintetis tahap ${calls}` } }] });
  });
  const originalFindFirst = prisma.officeJob.findFirst;
  const originalUpdateMany = prisma.officeJob.updateMany;
  prisma.officeJob.findFirst = async (args) => {
    if (args.where.status === 'QUEUED') return originalFindFirst({ ...args, where: { ...args.where, contentFlowId: currentFlow } });
    return originalFindFirst(args);
  };
  prisma.officeJob.updateMany = async (args) => args.where.id ? originalUpdateMany(args) : { count: 0 };
  const app = express(); app.use(express.json());
  app.use('/api/office-work', jobsRouter); app.use('/api/workflow', workflowRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (url, body) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  try {
    const response = await post('/office-work/jobs', { division: 'creator', staffId: 'trendy', instruction: marker });
    assert.equal(response.status, 202);
    currentFlow = (await response.json()).id; flowIds.push(currentFlow);
    await processNextJob();
    assert.equal((await prisma.officeJob.findUnique({ where: { id: currentFlow } })).status, 'FAILED');
    assert.equal(await prisma.officeJob.count({ where: { contentFlowId: currentFlow } }), 1);
    assert.equal((await post(`/office-work/jobs/${currentFlow}/retry`)).status, 200);
    for (const [index, staffId] of ['trendy', 'script_ai', 'clipper'].entries()) {
      const before = await prisma.officeJob.findFirst({ where: { contentFlowId: currentFlow, staffId } });
      assert.equal(before.status, 'QUEUED');
      if (index) assert.match(before.instruction, new RegExp(`hasil sintetis tahap ${index}`));
      await processNextJob();
      if (index === 2) {
        const failed = await prisma.officeJob.findUnique({ where: { id: before.id } });
        assert.equal(failed.status, 'FAILED');
        assert.match(failed.error, /Paket konten AI belum lengkap/);
        assert.equal(failed.draftId, null);
        assert.equal((await post(`/office-work/jobs/${before.id}/retry`)).status, 200);
        await processNextJob();
      }
      const finished = await prisma.officeJob.findUnique({ where: { id: before.id } });
      const draft = await prisma.officeDraft.findUnique({ where: { id: finished.draftId } });
      assert.equal(draft.data.status, index === 2 ? 'PENDING' : 'INTERMEDIATE');
      assert.equal(draft.data.contentPackageVersion, index === 2 ? 1 : undefined);
    }
    assert.equal(await prisma.officeJob.count({ where: { contentFlowId: currentFlow } }), 3);
    const intermediate = await fetch(`${base}/workflow/drafts/job-${currentFlow}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'APPROVE' }) });
    assert.equal(intermediate.status, 409);
    const finalDraftId = `job-${currentFlow}:clipper`;
    const patch = (body) => fetch(`${base}/workflow/drafts/${finalDraftId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await patch({ action: 'EDIT', content: 'Tidak lengkap' })).status, 400);
    process.env.VIDEO_ENABLED = 'true';
    const approved = await patch({ action: 'APPROVE' });
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).draft.contentPackageVersion, 1);
    assert.equal((await prisma.officeDraft.findUnique({ where: { id: finalDraftId } })).data.status, 'APPROVED');
    assert.equal(await prisma.videoJob.findUnique({ where: { draftId: finalDraftId } }), null);
    process.env.VIDEO_ENABLED = 'false';
    const revised = await patch({ action: 'REVISE', notes: 'Perjelas narasi' });
    assert.equal(revised.status, 200);
    assert.equal((await revised.json()).draft.status, 'PENDING');

    const now = new Date().toISOString();
    await prisma.officeDraft.create({ data: { id: oldDraftId, data: { id: oldDraftId, division: 'creator', ticketId: null, title: marker, content: 'Ide lama sintetis', status: 'APPROVED', createdAt: now, updatedAt: now } } });
    await prisma.officeJob.create({ data: { id: oldJobId, division: 'creator', staffId: 'trendy', title: marker, instruction: marker, status: 'DONE', draftId: oldDraftId } });
    const eligible = await (await fetch(`${base}/office-work/content-flow/from-draft/${oldDraftId}`)).json();
    assert.equal(eligible.eligible, true);
    const continued = await post(`/office-work/content-flow/from-draft/${oldDraftId}`);
    assert.equal(continued.status, 202);
    currentFlow = (await continued.json()).id; flowIds.push(currentFlow);
    assert.equal((await post(`/office-work/content-flow/from-draft/${oldDraftId}`)).status, 409);
    const script = await prisma.officeJob.findFirst({ where: { contentFlowId: currentFlow, staffId: 'script_ai' } });
    assert.match(script.instruction, /Ide lama sintetis/);
    await processNextJob();
    await processNextJob();
    const final = await prisma.officeJob.findFirst({ where: { contentFlowId: currentFlow, staffId: 'clipper' } });
    assert.equal(final.status, 'DONE');
    assert.equal((await prisma.officeDraft.findUnique({ where: { id: final.draftId } })).data.status, 'PENDING');
  } finally {
    prisma.officeJob.findFirst = originalFindFirst;
    prisma.officeJob.updateMany = originalUpdateMany;
    const jobs = await prisma.officeJob.findMany({ where: { OR: [{ contentFlowId: { in: flowIds } }, { id: oldJobId }] }, select: { id: true, draftId: true } });
    await prisma.videoJob.deleteMany({ where: { draftId: { in: jobs.map((job) => job.draftId).filter(Boolean) } } });
    await prisma.officeDraft.deleteMany({ where: { id: { in: [...jobs.map((job) => job.draftId).filter(Boolean), oldDraftId] } } });
    await prisma.officeJob.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } });
    await prisma.contentFlow.deleteMany({ where: { id: { in: flowIds } } });
    assert.equal(await prisma.officeJob.count({ where: { id: { in: jobs.map((job) => job.id) } } }), 0);
    assert.equal(await prisma.contentFlow.count({ where: { id: { in: flowIds } } }), 0);
    assert.equal(await prisma.officeDraft.count({ where: { id: { in: [...jobs.map((job) => job.draftId).filter(Boolean), oldDraftId] } } }), 0);
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
