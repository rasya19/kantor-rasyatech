import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { prisma } from '../server/lib/prisma.ts';
import { processNextVideo, videoPath } from '../server/services/videoService.ts';

test('video worker saves a generated MP4 and never resubmits ambiguous failures', async (t) => {
  const previousEnabled = process.env.VIDEO_ENABLED;
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.VIDEO_ENABLED = 'true';
  process.env.GEMINI_API_KEY = 'synthetic-key';
  const id = randomUUID();
  let job = { id, status: 'QUEUED', prompt: 'Paket sintetis' };
  let calls = 0;
  let written = false;
  const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.alloc(8)]);
  const originalFind = prisma.videoJob.findFirst;
  const originalUpdate = prisma.videoJob.updateMany;
  t.after(() => { prisma.videoJob.findFirst = originalFind; prisma.videoJob.updateMany = originalUpdate; });
  prisma.videoJob.findFirst = async () => job.status === 'QUEUED' ? { ...job } : null;
  prisma.videoJob.updateMany = async ({ where, data }) => {
    if (!where.id || where.id !== job.id || where.status !== job.status) return { count: 0 };
    Object.assign(job, data);
    return { count: 1 };
  };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.response_format.aspect_ratio, '9:16');
    assert.equal(payload.response_format.duration, '10s');
    return new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: mp4.toString('base64') }] }] }), { status: 200 });
  });
  try {
    await processNextVideo();
    assert.equal(job.status, 'READY');
    written = true;
    assert.deepEqual(await readFile(videoPath(id)), mp4);
    await processNextVideo();
    assert.equal(calls, 1);
    job = { id: randomUUID(), status: 'QUEUED', prompt: 'Paket sintetis' };
    globalThis.fetch.mock.mockImplementation(async () => { calls++; throw new Error('synthetic timeout'); });
    await processNextVideo();
    assert.equal(job.status, 'UNKNOWN');
    await processNextVideo();
    assert.equal(calls, 2);
  } finally {
    if (written) await unlink(videoPath(id));
    if (previousEnabled === undefined) delete process.env.VIDEO_ENABLED; else process.env.VIDEO_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
});
