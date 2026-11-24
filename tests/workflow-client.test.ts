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

test('jobs request surfaces readable non-JSON HTTP 404 errors instead of raw SyntaxError', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('The page could not be found', {
    status: 404,
    headers: { 'content-type': 'text/plain' },
  });

  await assert.rejects(
    workflowClient.jobs(),
    /Respons server bukan JSON \(HTTP 404, text\/plain\)/i,
  );
});
