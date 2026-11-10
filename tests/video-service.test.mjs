import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/lib/prisma.ts';
import { processNextVideo, videoEnabled } from '../server/services/videoService.ts';

test('video generation stays disabled even with the legacy flag enabled', async (t) => {
  const previous = process.env.VIDEO_ENABLED;
  process.env.VIDEO_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.VIDEO_ENABLED; else process.env.VIDEO_ENABLED = previous; });
  const originalUpdate = prisma.videoJob.updateMany;
  const originalFind = prisma.videoJob.findFirst;
  t.after(() => { prisma.videoJob.updateMany = originalUpdate; prisma.videoJob.findFirst = originalFind; });
  prisma.videoJob.updateMany = async () => ({ count: 0 });
  let finds = 0;
  prisma.videoJob.findFirst = async () => { finds++; throw new Error('Queue must not be read'); };
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Video must not be sent'); });
  assert.equal(videoEnabled(), false);
  await processNextVideo();
  assert.equal(finds, 0);
  assert.equal(fetch.mock.calls.length, 0);
});
