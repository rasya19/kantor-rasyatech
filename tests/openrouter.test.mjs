import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenRouter, checkBudget, openRouterModel, openRouterModels, openRouterRequest } from '../server/services/openrouter.ts';
import { prisma } from '../server/lib/prisma.ts';

test('requires a monthly key budget at or below the configured maximum', async (t) => {
  const previous = { key: process.env.OPENROUTER_API_KEY, budget: process.env.OPENROUTER_MAX_MONTHLY_USD };
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  process.env.OPENROUTER_MAX_MONTHLY_USD = '25';
  t.after(() => {
    if (previous.key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previous.key;
    if (previous.budget === undefined) delete process.env.OPENROUTER_MAX_MONTHLY_USD; else process.env.OPENROUTER_MAX_MONTHLY_USD = previous.budget;
  });
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ data: { limit: 26, limit_reset: 'monthly', limit_remaining: 26 } });
  });
  const originalUsageCreate = prisma.openRouterUsage.create;
  const usageWrites = [];
  prisma.openRouterUsage.create = async (args) => { usageWrites.push(args); return {}; };
  t.after(() => { prisma.openRouterUsage.create = originalUsageCreate; });
  await assert.rejects(generateOpenRouter('test', 'test'), /maksimal US\$25/);
  assert.equal(calls, 1);
  for (const data of [
    { limit: null, limit_reset: 'monthly', limit_remaining: 5 },
    { limit: 5, limit_reset: null, limit_remaining: 5 },
    { limit: 5, limit_reset: 'daily', limit_remaining: 5 },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json({ data }));
    await assert.rejects(checkBudget(), /maksimal US\$25/);
  }
  fetchMock.mock.mockImplementation(async () => Response.json({ data: { limit: 26, limit_reset: 'monthly', limit_remaining: 26 } }));
  await assert.rejects(checkBudget(), /maksimal US\$25/);
  process.env.OPENROUTER_MAX_MONTHLY_USD = '10';
  fetchMock.mock.mockImplementation(async () => Response.json({ data: { limit: 25, limit_reset: 'monthly', limit_remaining: 25 } }));
  await assert.rejects(checkBudget(), /maksimal US\$10/);
  process.env.OPENROUTER_MAX_MONTHLY_USD = '25';
  fetchMock.mock.mockImplementation(async (url, options) => {
    calls++;
    assert.match(url, /^https:\/\/openrouter\.ai\/api\/v1\//);
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 3 } });
    const body = JSON.parse(options.body);
    assert.deepEqual(body.models, ['example/primary', 'example/fallback']);
    assert.equal(body.max_tokens, 2400);
    assert.equal(body.plugins[0].engine, 'exa');
    return Response.json({ model: 'example/fallback', usage: { prompt_tokens: 2, completion_tokens: 1, cost: 0.00001 }, choices: [{ finish_reason: 'stop', message: { content: 'Hasil uji', annotations: [] } }] });
  });
  process.env.OPENROUTER_MODEL_ENGINEER = 'example/primary';
  process.env.OPENROUTER_FALLBACK_MODELS_ENGINEER = 'example/fallback';
  const response = await generateOpenRouter('test', 'test', 'engineer', undefined, true, 'digital');
  assert.equal(response.content, 'Hasil uji');
  assert.equal(response.model, 'example/fallback');
  assert.deepEqual(response.usage, { promptTokens: 2, completionTokens: 1, costUsd: 0.00001, available: true });
  assert.equal(usageWrites[0].data.division, 'engineer');
  assert.equal(usageWrites[0].data.product, 'digital');
  assert.equal(usageWrites[0].data.costUsd, '0.00001');
  assert.equal(calls, 3);
  fetchMock.mock.mockImplementation(async () => Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 0 } }));
  await assert.rejects(checkBudget(), /habis/);
});

test('division models have specialized defaults, support overrides, and reject unsafe gateway URLs', async (t) => {
  const envKeys = [
    'OPENROUTER_API_KEY', 'OPENROUTER_BASE_URL', 'OPENROUTER_MODEL',
    'OPENROUTER_MODEL_ENGINEER', 'OPENROUTER_FALLBACK_MODELS_ENGINEER',
    'OPENROUTER_MODEL_CYBER', 'OPENROUTER_FALLBACK_MODELS_CYBER',
    'OPENROUTER_MODEL_PAUD', 'OPENROUTER_FALLBACK_MODELS_PAUD',
    'OPENROUTER_MODEL_POSYANDU', 'OPENROUTER_FALLBACK_MODELS_POSYANDU',
    'OPENROUTER_MODEL_CREATOR', 'OPENROUTER_FALLBACK_MODELS_CREATOR',
  ];
  const original = Object.fromEntries(envKeys.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });

  await t.test('reports status and content type when OpenRouter returns a non-JSON success response', async (t) => {
    const previousKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'synthetic-key';
    t.after(() => {
      if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previousKey;
    });
    t.mock.method(globalThis, 'fetch', async () => new Response('<html>temporary gateway error</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }));
    await assert.rejects(
      openRouterRequest('/chat/completions'),
      /HTTP 200, content-type text\/html.*mungkin tetap ditagih/,
    );
  });
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  for (const name of envKeys) {
    if (name !== 'OPENROUTER_API_KEY' && name !== 'OPENROUTER_BASE_URL') delete process.env[name];
  }
  assert.equal(openRouterModel(), 'google/gemini-2.5-flash');
  assert.deepEqual(openRouterModels('engineer'), ['qwen/qwen-2.5-coder-32b-instruct', 'deepseek/deepseek-chat', 'google/gemini-2.5-flash']);
  assert.deepEqual(openRouterModels('cyber'), ['google/gemini-2.5-flash', 'deepseek/deepseek-chat', 'qwen/qwen-2.5-72b-instruct']);
  assert.deepEqual(openRouterModels('paud'), ['google/gemini-2.5-flash', 'deepseek/deepseek-chat', 'qwen/qwen-2.5-72b-instruct']);
  assert.deepEqual(openRouterModels('posyandu'), openRouterModels('paud'));
  assert.deepEqual(openRouterModels('creator'), ['deepseek/deepseek-chat', 'google/gemini-2.5-flash', 'qwen/qwen-2.5-72b-instruct']);
  process.env.OPENROUTER_MODEL_ENGINEER = 'example/model';
  process.env.OPENROUTER_FALLBACK_MODELS_ENGINEER = 'example/backup, example/backup, ';
  process.env.OPENROUTER_BASE_URL = 'https://example.org/api/v1';
  assert.equal(openRouterModel('engineer'), 'example/model');
  assert.deepEqual(openRouterModels('engineer'), ['example/model', 'example/backup']);
  await assert.rejects(checkBudget(), /OPENROUTER_BASE_URL/);
});
