import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/lib/prisma';
import { generateDigitalProductResearch } from '../server/services/businessResearch';
import { createContentFlow } from '../server/services/contentFlow';
import {
  JOBS_ACTIVE_POLL_MS,
  JOBS_IDLE_POLL_MS,
  VIDEOS_ACTIVE_POLL_MS,
  VIDEOS_IDLE_POLL_MS,
  hasActiveStatus,
  nextPollDelayMs,
} from '../src/lib/polling';

test('paid web research output is preserved with verification warning even when below 3 sources', async (context) => {
  process.env.OPENROUTER_API_KEY = 'test-key-not-used';
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = (async () => ({})) as unknown as typeof prisma.openRouterUsage.create;
  context.after(() => {
    prisma.openRouterUsage.create = originalUsageCreate;
  });

  let annotations = [
    { type: 'url_citation', url_citation: { title: 'Sumber Tunggal', url: 'https://example.org/one' } },
  ];
  context.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    const urlStr = String(url);
    if (urlStr.endsWith('/key')) {
      return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    }
    return Response.json({
      choices: [{
        finish_reason: 'stop',
        message: {
          content: 'Target 20 pembeli awal.\n## Daftar Sumber Rujukan\n1. https://example.org/one',
          annotations,
        },
      }],
    });
  });

  const draft = await generateDigitalProductResearch();
  assert.equal(draft.status, 'PENDING');
  assert.equal(draft.grounding?.sources.length, 1);
  assert.match(draft.content, /^\[PERLU VERIFIKASI SUMBER — catatan pemeriksaan otomatis:/);
  assert.match(draft.content, /sumber web terverifikasi baru 1 dari minimal 3/);

  annotations = [];
  await assert.rejects(generateDigitalProductResearch(), /sumber web/);
});

test('createContentFlow routes directly to clipper in 1 AI call instead of 3 stages', async () => {
  const flows: Array<{ id: string; sourceDraftId?: string }> = [];
  const jobs: Array<{ id: string; division: string; staffId: string; contentFlowId?: string }> = [];
  const tx = {
    contentFlow: {
      create: async ({ data }: { data: { id: string; sourceDraftId?: string } }) => {
        flows.push(data);
        return data;
      },
    },
    officeJob: {
      create: async ({ data }: { data: { id: string; division: string; staffId: string; contentFlowId?: string } }) => {
        jobs.push(data);
        return data;
      },
    },
  } as unknown as Parameters<typeof createContentFlow>[0];

  await createContentFlow(tx, 'Promosi produk', 'Buat 1 paket promosi.', 'flow-direct-1', 'draft-src-1');
  assert.equal(flows.length, 1);
  assert.equal(flows[0].sourceDraftId, 'draft-src-1');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].division, 'creator');
  assert.equal(jobs[0].staffId, 'clipper');
  assert.equal(jobs[0].contentFlowId, 'flow-direct-1');
});

test('adaptive frontend polling slows down when idle and speeds up when jobs or videos are active', () => {
  assert.equal(hasActiveStatus(null), false);
  assert.equal(hasActiveStatus([{ status: 'DONE' }, { status: 'FAILED' }]), false);
  assert.equal(hasActiveStatus([{ status: 'DONE' }, { status: 'QUEUED' }]), true);
  assert.equal(hasActiveStatus([{ status: 'RUNNING' }]), true);

  assert.equal(nextPollDelayMs(true, JOBS_ACTIVE_POLL_MS, JOBS_IDLE_POLL_MS), 4_000);
  assert.equal(nextPollDelayMs(false, JOBS_ACTIVE_POLL_MS, JOBS_IDLE_POLL_MS), 45_000);
  assert.equal(nextPollDelayMs(true, VIDEOS_ACTIVE_POLL_MS, VIDEOS_IDLE_POLL_MS), 6_000);
  assert.equal(nextPollDelayMs(false, VIDEOS_ACTIVE_POLL_MS, VIDEOS_IDLE_POLL_MS), 60_000);
});
