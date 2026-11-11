import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import workflowRouter from '../server/routes/workflowRoutes.ts';

test('OpenRouter monthly budget is exposed only to authenticated admins', async (t) => {
  const previousPassword = process.env.OFFICE_ADMIN_PASSWORD;
  const previousKey = process.env.OPENROUTER_API_KEY;
  process.env.OFFICE_ADMIN_PASSWORD = 'synthetic-long-admin-password';
  process.env.OPENROUTER_API_KEY = 'synthetic-openrouter-key';
  t.after(() => {
    if (previousPassword === undefined) delete process.env.OFFICE_ADMIN_PASSWORD;
    else process.env.OFFICE_ADMIN_PASSWORD = previousPassword;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  });

  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/key');
    return Response.json({ data: { limit: 25, limit_reset: 'monthly', limit_remaining: 18.5 } });
  });
  const app = express();
  app.use(express.json());
  app.use('/api/workflow', workflowRouter);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/workflow`;
  const origin = new URL(base).origin;

  const unauthorized = await fetch(`${base}/admin/openrouter-budget`);
  assert.equal(unauthorized.status, 401);

  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ password: process.env.OFFICE_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';', 1)[0];
  const response = await fetch(`${base}/admin/openrouter-budget`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { limitUsd: 25, remainingUsd: 18.5, reset: 'monthly' });
});
