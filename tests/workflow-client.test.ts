import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowClient } from '../src/api/workflowClient';

test('assistant request explains an empty API response instead of exposing a JSON parser error', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('', {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(
    workflowClient.officeAssistant([{ role: 'user', content: 'Halo' }]),
    /respons kosong \(HTTP 502, application\/json\)/i,
  );
});

test('assistant request surfaces JSON API errors', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => Response.json({ error: 'Kredit tidak cukup.' }, { status: 402 });

  await assert.rejects(
    workflowClient.officeAssistant([{ role: 'user', content: 'Halo' }]),
    /Kredit tidak cukup/,
  );
});
