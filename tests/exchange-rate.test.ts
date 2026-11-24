import test from 'node:test';
import assert from 'node:assert/strict';
import { clearExchangeRateCache, getUsdIdrRate } from '../server/services/exchangeRate';

test('getUsdIdrRate fetches live rate, caches for 1 hour, and falls back gracefully', async (t) => {
  const prevEnv = process.env.OPENROUTER_USD_IDR;
  delete process.env.OPENROUTER_USD_IDR;
  clearExchangeRateCache();
  t.after(() => {
    clearExchangeRateCache();
    if (prevEnv === undefined) delete process.env.OPENROUTER_USD_IDR;
    else process.env.OPENROUTER_USD_IDR = prevEnv;
  });

  let fetchCalls = 0;
  const mockFetch = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    fetchCalls++;
    assert.match(String(url), /open\.er-api\.com/);
    return Response.json({ rates: { IDR: 16482.7 } });
  });

  const first = await getUsdIdrRate();
  assert.equal(first.rate, 16483);
  assert.equal(first.source, 'live');
  assert.equal(first.provider, 'open.er-api.com');
  assert.equal(fetchCalls, 1);

  const second = await getUsdIdrRate();
  assert.equal(second.rate, 16483);
  assert.equal(fetchCalls, 1);

  clearExchangeRateCache();
  mockFetch.mock.mockImplementation(async (url: string | URL | Request) => {
    fetchCalls++;
    if (String(url).includes('open.er-api.com')) return new Response('', { status: 503 });
    return Response.json({ rates: { IDR: 16510 } });
  });

  const fallbackLive = await getUsdIdrRate();
  assert.equal(fallbackLive.rate, 16510);
  assert.equal(fallbackLive.source, 'live');
  assert.equal(fallbackLive.provider, 'frankfurter.app');

  clearExchangeRateCache();
  mockFetch.mock.mockImplementation(async () => { throw new Error('offline'); });
  process.env.OPENROUTER_USD_IDR = '16250';
  const envFallback = await getUsdIdrRate();
  assert.equal(envFallback.rate, 16250);
  assert.equal(envFallback.source, 'env');
  assert.equal(envFallback.provider, '.env');

  delete process.env.OPENROUTER_USD_IDR;
  const unavailable = await getUsdIdrRate();
  assert.equal(unavailable.rate, null);
  assert.equal(unavailable.source, 'unavailable');
});
