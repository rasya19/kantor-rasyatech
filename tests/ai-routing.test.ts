import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAi } from '../server/services/aiRouting';
import { currentWibDate, generateReportWithDetails } from '../server/services/workflowService';
import { dispatchToOpenRouter, reviseDraftWithOpenRouter } from '../server/services/officeDraftService';
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
    OPENROUTER_MODEL_CYBER: 'anthropic/claude-3.5-sonnet',
    GEMINI_MODEL: 'legacy-direct-model',
    AI_COPILOT_DIVISIONS: 'engineer',
    COPILOT_MODEL: 'legacy-copilot-model',
  });
  assert.deepEqual(selectAi('paud'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
  assert.deepEqual(selectAi('engineer'), { provider: 'openrouter', model: 'qwen/qwen-2.5-coder-32b-instruct' });
  assert.deepEqual(selectAi('cyber'), { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' });
  assert.deepEqual(selectAi('posyandu'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
  assert.deepEqual(selectAi('creator'), { provider: 'openrouter', model: 'deepseek/deepseek-chat' });
  assert.deepEqual(selectAi('marketing'), { provider: 'openrouter', model: 'google/gemini-2.5-flash' });
});

test('active workflow uses OpenRouter even when legacy provider settings are set', async (t) => {
  env(t, { AI_COPILOT_DIVISIONS: 'cyber', COPILOT_MODEL: 'test-model', COPILOT_GITHUB_TOKEN: '', OPENROUTER_API_KEY: 'synthetic-key' });
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

test('legacy draft dispatch and revision use OpenRouter', async (t) => {
  env(t, { OPENROUTER_API_KEY: 'synthetic-key', OPENROUTER_MAX_MONTHLY_USD: '25' });
  const originalUsageCreate = prisma.openRouterUsage.create;
  prisma.openRouterUsage.create = (() => undefined) as never;
  t.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });

  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, options?: RequestInit) => {
    const urlString = String(url);
    calls.push(urlString);
    if (urlString.endsWith('/key')) {
      return Response.json({ data: { limit: 25, limit_reset: 'monthly', limit_remaining: 25 } });
    }
    assert.match(urlString, /^https:\/\/openrouter\.ai\/api\/v1\/chat\/completions$/);
    const body = JSON.parse(String(options?.body));
    assert.ok(body.models.every((model: string) => model.includes('/')));
    return Response.json({
      model: body.models[0],
      choices: [{
        finish_reason: 'stop',
        message: { content: '---\n[LAPORAN DRAFT KANTOR AI]\nDivisi: DIVISI CONTENT CREATOR\nStaf Penanggung Jawab: Trendy (Trend Hunter)\nHasil Draf:\nDraf sintetis\n[AKSI BOS: APPROVE / REVISI]\n---' },
      }],
    });
  });

  const draft = await dispatchToOpenRouter('Buat draf sintetis', undefined, 'creator');
  const revised = await reviseDraftWithOpenRouter(draft.id, draft.hasilDraf, 'Perjelas pembuka', 'Trendy', 'Creator');
  assert.equal(draft.payloadPreview?.generatedVia, 'deepseek/deepseek-chat');
  assert.equal(revised.hasilDraf, 'Draf sintetis');
  assert.equal(calls.filter((url) => url.endsWith('/chat/completions')).length, 2);
  assert.equal(calls.filter((url) => url.endsWith('/key')).length, 2);
});

test('current Wib date conversion handles the UTC date boundary', () => {
  assert.equal(currentWibDate(new Date('2026-11-09T18:00:00.000Z')), '2026-11-10');
});
