import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-key-not-used';
delete process.env.AI_COPILOT_DIVISIONS;
const { aiClient } = await import('../server/config/gemini.ts');
const { generateReportWithDetails } = await import('../server/services/workflowService.ts');

for (const [status, message] of [
  [404, /Model Gemini .* tidak tersedia/],
  [400, /Periksa kunci API/],
  [403, /Periksa kunci API/],
  [429, /Kuota Gemini/],
  [503, /gangguan/],
]) {
  test(`Gemini HTTP ${status} is reported without exposing provider details`, async (context) => {
    context.mock.method(aiClient.models, 'generateContent', async () => {
      throw Object.assign(new Error('sensitive provider details'), { status });
    });
    await assert.rejects(generateReportWithDetails('synthetic input', 'creator'), (error) => {
      assert.match(error.message, message);
      assert.doesNotMatch(error.message, /sensitive provider details/);
      return true;
    });
  });
}
