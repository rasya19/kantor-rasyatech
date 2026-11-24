import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAi } from '../server/services/aiRouting';
import { currentWibDate, generateReportWithDetails } from '../server/services/workflowService';
import { prisma } from '../server/lib/prisma';

function env(t: test.TestContext, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test('all division model routing selects OpenRouter model IDs', (t) => {
  env(t, {
    OPENROUTER_MODEL_PAUD: 'google/gemini-2.5-flash',
    OPENROUTER_MODEL_ENGINEER: 'qwen/qwen-2.5-coder-32b-instruct',
    OPENROUTER_MODEL_CYBER: 'google/gemini-2.5-flash',
    GEMINI_MODEL: 'legacy-direct-model',
    AI_COPILOT_DIVISIONS: 'engineer',
    COPILOT_MODEL: 'legacy-copilot-model',
  });
  assert.deepEqual(selectAi('paud'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
  assert.deepEqual(selectAi('engineer'), { provider: 'openrouter', model: 'qwen/qwen-2.5-coder-32b-instruct' });
  assert.deepEqual(selectAi('cyber'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
  assert.deepEqual(selectAi('posyandu'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
  assert.deepEqual(selectAi('creator'), { provider: 'openrouter', model: 'deepseek/deepseek-chat' });
  assert.deepEqual(selectAi('marketing'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
});

test('active workflow uses OpenRouter even when legacy provider settings are set', async (t) => {
  env(t, { AI_COPILOT_DIVISIONS: 'cyber', COPILOT_MODEL: 'test-model', COPILOT_GITHUB_TOKEN: '', OPENROUTER_API_KEY: 'synthetic-key' });
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = (() => Promise.resolve({})) as never;
  t.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });

  let system = '';
  let instruction = '';
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } });
    const body = JSON.parse(String(options?.body));
    system = body.messages[0].content;
    instruction = body.messages[1].content;
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Laporan sintetis' } }] });
  });
  const report = await generateReportWithDetails('instruksi sintetis', 'cyber');
  assert.equal(report.ai.provider, 'openrouter');
  assert.match(system, /beberapa sumber penghasilan digital yang realistis/);
  assert.match(system, /Kreator menyiapkan aset konten\/panduan/);
  assert.match(system, /Jangan menyebut riset pasar atau sumber terbaru sudah dilakukan/);
  assert.match(instruction, new RegExp(`Tanggal referensi saat ini \\(WIB\\): ${currentWibDate()}`));
});

test('current Wib date conversion handles the UTC date boundary', () => {
  assert.equal(currentWibDate(new Date('2026-11-09T18:00:00.000Z')), '2026-11-10');
});
