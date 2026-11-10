import test from 'node:test';
import assert from 'node:assert/strict';
import { CopilotClient, CopilotSession, type SessionConfig } from '@github/copilot-sdk';
import { selectAi } from '../server/services/aiRouting';
import { generateCopilotReport } from '../server/services/copilotReport';
import { generateReportWithDetails } from '../server/services/workflowService';

function env(t: test.TestContext, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test('division routing defaults to Gemini and rejects invalid Copilot configuration', (t) => {
  env(t, { AI_COPILOT_DIVISIONS: 'engineer,cyber', COPILOT_MODEL: 'test-model', COPILOT_MODEL_CYBER: 'security-model' });
  assert.equal(selectAi('paud').provider, 'gemini');
  assert.deepEqual(selectAi('engineer'), { provider: 'copilot', model: 'test-model' });
  assert.deepEqual(selectAi('cyber'), { provider: 'copilot', model: 'security-model' });
  process.env.AI_COPILOT_DIVISIONS = 'engineer,unknown';
  assert.throws(() => selectAi('paud'), /tidak valid/);
  process.env.AI_COPILOT_DIVISIONS = 'engineer';
  delete process.env.COPILOT_MODEL;
  assert.throws(() => selectAi('engineer'), /belum dikonfigurasi/);
});

test('active workflow uses OpenRouter even when legacy Copilot configuration is set', async (t) => {
  env(t, { AI_COPILOT_DIVISIONS: 'cyber', COPILOT_MODEL: 'test-model', COPILOT_GITHUB_TOKEN: '', OPENROUTER_API_KEY: 'synthetic-key' });
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => String(url).endsWith('/key')
    ? Response.json({ data: { limit: 5, limit_reset: 'monthly', limit_remaining: 5 } })
    : Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Laporan sintetis' } }] }));
  const report = await generateReportWithDetails('instruksi sintetis', 'cyber');
  assert.equal(report.ai.provider, 'openrouter');
});

test('Copilot session disallows tools and deletes its session', async (t) => {
  env(t, { COPILOT_GITHUB_TOKEN: 'synthetic-token', COPILOT_MAX_AI_CREDITS: '1' });
  let config: SessionConfig | undefined;
  let deleted = '';
  let stopped = false;
  const fakeSession: CopilotSession = Object.create(CopilotSession.prototype);
  Object.assign(fakeSession, {
    sessionId: 'synthetic-session',
    sendAndWait: async () => ({ data: { content: 'Laporan sintetis' } }),
  });
  t.mock.method(CopilotClient.prototype, 'createSession', async (value: SessionConfig) => {
    config = value;
    return fakeSession;
  });
  t.mock.method(CopilotClient.prototype, 'deleteSession', async (id: string) => { deleted = id; });
  t.mock.method(CopilotClient.prototype, 'stop', async () => { stopped = true; return []; });
  assert.equal(await generateCopilotReport('uji', 'aturan', 'model-uji'), 'Laporan sintetis');
  assert.deepEqual(config?.availableTools, []);
  assert.deepEqual(config?.excludedTools, ['builtin:*', 'mcp:*', 'custom:*']);
  assert.equal(config?.enableConfigDiscovery, false);
  assert.deepEqual(config?.sessionLimits, { maxAiCredits: 1 });
  assert.deepEqual(await config?.onPermissionRequest?.({} as never, {} as never), { kind: 'reject' });
  assert.equal(deleted, 'synthetic-session');
  assert.equal(stopped, true);
});

test('Copilot cancellation aborts the session and cleans up without returning a report', async (t) => {
  env(t, { COPILOT_GITHUB_TOKEN: 'synthetic-token', COPILOT_MAX_AI_CREDITS: '1' });
  let aborted = false;
  let deleted = false;
  let markStarted = () => {};
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const fakeSession: CopilotSession = Object.create(CopilotSession.prototype);
  Object.assign(fakeSession, {
    sessionId: 'cancelled-session',
    sendAndWait: () => { markStarted(); return new Promise(() => {}); },
    abort: async () => { aborted = true; },
  });
  t.mock.method(CopilotClient.prototype, 'createSession', async () => fakeSession);
  t.mock.method(CopilotClient.prototype, 'deleteSession', async () => { deleted = true; });
  t.mock.method(CopilotClient.prototype, 'stop', async () => []);
  const controller = new AbortController();
  const result = generateCopilotReport('uji', 'aturan', 'model-uji', controller.signal);
  await started;
  controller.abort(new Error('Waktu habis'));
  await assert.rejects(result, /Waktu habis/);
  assert.equal(aborted, true);
  assert.equal(deleted, true);
});
