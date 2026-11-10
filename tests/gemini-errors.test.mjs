import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReportWithDetails } from '../server/services/workflowService.ts';

process.env.OPENROUTER_API_KEY = 'test-key-not-used';
const validBudget = { data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } };

for (const [status, message] of [
  [401, /kunci atau izin/], [402, /Kredit atau batas/], [403, /kunci atau izin/],
  [429, /Batas permintaan/], [404, /HTTP 404/], [503, /HTTP 503/],
]) {
  test(`OpenRouter HTTP ${status} is reported without exposing provider details`, async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => String(url).endsWith('/key')
      ? Response.json(validBudget)
      : new Response('sensitive provider details', { status }));
    await assert.rejects(generateReportWithDetails('synthetic input', 'creator'), (error) => {
      assert.match(error.message, message);
      assert.doesNotMatch(error.message, /sensitive provider details|test-key-not-used/);
      return true;
    });
  });
}

for (const [choice, message] of [
  [{ finish_reason: 'length', message: { content: 'partial' } }, /terpotong/],
  [{ finish_reason: 'stop', message: { content: '' } }, /teks yang valid/],
  [{ finish_reason: 'stop', message: {} }, /teks yang valid/],
]) {
  test(`Invalid OpenRouter response is explained: ${message}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async (url) => String(url).endsWith('/key')
      ? Response.json(validBudget) : Response.json({ choices: [choice] }));
    await assert.rejects(generateReportWithDetails('synthetic input', 'creator'), message);
  });
}

test('network and timeout errors are explained without exposing details', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('secret detail'); });
  await assert.rejects(generateReportWithDetails('synthetic input', 'creator'), /Tidak dapat terhubung ke OpenRouter/);
  mock.mock.mockImplementation(async () => { throw new DOMException('secret detail', 'TimeoutError'); });
  await assert.rejects(generateReportWithDetails('synthetic input', 'creator'), (error) => {
    assert.match(error.message, /habis waktu/);
    assert.doesNotMatch(error.message, /secret detail/);
    return true;
  });
});
