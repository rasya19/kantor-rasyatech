import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOpenRouter, checkBudget, openRouterModel } from '../server/services/openrouter.ts';

test('requires a monthly key budget at most $5 before model calls', async (t) => {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  t.after(() => { if (previous === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previous; });
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ data: { limit: 6, limit_reset: 'monthly', limit_remaining: 6 } });
  });
  await assert.rejects(generateOpenRouter('test', 'test'), /maksimal US\$5/);
  assert.equal(calls, 1);
  for (const data of [
    { limit: null, limit_reset: 'monthly', limit_remaining: 5 },
    { limit: 5, limit_reset: null, limit_remaining: 5 },
    { limit: 5, limit_reset: 'daily', limit_remaining: 5 },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json({ data }));
    await assert.rejects(checkBudget(), /maksimal US\$5/);
  }
  fetchMock.mock.mockImplementation(async (url, options) => {
    calls++;
    assert.match(url, /^https:\/\/openrouter\.ai\/api\/v1\//);
    if (url.endsWith('/key')) return Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 3 } });
    const body = JSON.parse(options.body);
    assert.equal(body.plugins[0].engine, 'exa');
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Hasil uji', annotations: [] } }] });
  });
  assert.equal((await generateOpenRouter('test', 'test', 'engineer', undefined, true)).content, 'Hasil uji');
  assert.equal(calls, 3);
  fetchMock.mock.mockImplementation(async () => Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 0 } }));
  await assert.rejects(checkBudget(), /habis/);
});

test('default and per-division models work and unsafe gateway URLs are rejected', async (t) => {
  const original = { key: process.env.OPENROUTER_API_KEY, base: process.env.OPENROUTER_BASE_URL, model: process.env.OPENROUTER_MODEL_ENGINEER, defaultModel: process.env.OPENROUTER_MODEL };
  t.after(() => {
    for (const [name, value] of Object.entries({ OPENROUTER_API_KEY: original.key, OPENROUTER_BASE_URL: original.base, OPENROUTER_MODEL_ENGINEER: original.model, OPENROUTER_MODEL: original.defaultModel })) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.OPENROUTER_API_KEY = 'synthetic-key';
  delete process.env.OPENROUTER_MODEL;
  assert.equal(openRouterModel(), 'google/gemini-2.5-flash');
  process.env.OPENROUTER_MODEL_ENGINEER = 'example/model';
  process.env.OPENROUTER_BASE_URL = 'https://example.org/api/v1';
  assert.equal(openRouterModel('engineer'), 'example/model');
  await assert.rejects(checkBudget(), /OPENROUTER_BASE_URL/);
});
