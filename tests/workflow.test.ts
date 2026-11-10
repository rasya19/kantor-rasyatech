import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import workflowRoutes from '../server/routes/workflowRoutes';
import { jakartaSchedule, generateReport, WorkflowError } from '../server/services/workflowService';

test('daily scheduler uses 06:00 Asia/Jakarta and the correct local date', () => {
  assert.deepEqual(jakartaSchedule(new Date('2026-11-07T22:59:59Z')), { date: '2026-11-08', due: false });
  assert.deepEqual(jakartaSchedule(new Date('2026-11-07T23:00:00Z')), { date: '2026-11-08', due: true });
  assert.deepEqual(jakartaSchedule(new Date('2026-11-08T17:00:00Z')), { date: '2026-11-09', due: false });
});

test('missing OpenRouter configuration is reported instead of generating a fake report', async (t) => {
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  t.after(() => { if (previous !== undefined) process.env.OPENROUTER_API_KEY = previous; });
  await assert.rejects(generateReport('Uji laporan'), (error: unknown) =>
    error instanceof WorkflowError && error.status === 503 && error.message.includes('OPENROUTER_API_KEY'));
});

test('workflow API rejects invalid requests without reporting success', async (context) => {
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRoutes);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/workflow`;
  for (const [path, body] of [
    ['/tickets', { division: 'unknown', category: 'BUG', title: 'X', description: 'Y' }],
    ['/drafts/content', { topic: '   ' }],
    ['/drafts/mandate', { division: 'engineer', instruction: '' }],
  ] as const) {
    const response = await fetch(`${base}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
    const result = await response.json();
    assert.equal(typeof result.error, 'string');
  }
});
