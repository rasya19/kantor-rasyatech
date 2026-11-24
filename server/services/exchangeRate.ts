export type ExchangeRateInfo = {
  rate: number | null;
  source: 'live' | 'env' | 'unavailable';
  provider: string | null;
  updatedAt: string | null;
  envInvalid: boolean;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
let cachedRate: { rate: number; provider: string; updatedAt: string; expiresAt: number } | null = null;

export function clearExchangeRateCache(): void {
  cachedRate = null;
}

function parseEnvRate(): { rate: number | null; invalid: boolean } {
  const configured = process.env.OPENROUTER_USD_IDR?.trim();
  if (!configured) return { rate: null, invalid: false };
  const parsed = Number(configured);
  if (Number.isFinite(parsed) && parsed > 0) return { rate: parsed, invalid: false };
  return { rate: null, invalid: true };
}

async function fetchJsonWithTimeout(url: string, parentSignal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) onParentAbort();
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

function extractIdrRate(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || !('rates' in payload)) return null;
  const rates = payload.rates;
  if (!rates || typeof rates !== 'object' || !('IDR' in rates)) return null;
  const idr = rates.IDR;
  if (typeof idr !== 'number' || !Number.isFinite(idr) || idr < 1000 || idr > 100000) return null;
  return Math.round(idr);
}

const PROVIDERS = [
  { name: 'open.er-api.com', url: 'https://open.er-api.com/v6/latest/USD' },
  { name: 'frankfurter.app', url: 'https://api.frankfurter.app/latest?from=USD&to=IDR' },
] as const;

export async function getUsdIdrRate(signal?: AbortSignal): Promise<ExchangeRateInfo> {
  const env = parseEnvRate();
  const now = Date.now();
  if (cachedRate && cachedRate.expiresAt > now) {
    return {
      rate: cachedRate.rate,
      source: 'live',
      provider: cachedRate.provider,
      updatedAt: cachedRate.updatedAt,
      envInvalid: env.invalid,
    };
  }

  for (const provider of PROVIDERS) {
    if (signal?.aborted) break;
    const data = await fetchJsonWithTimeout(provider.url, signal);
    const rate = extractIdrRate(data);
    if (rate !== null) {
      const updatedAt = new Date().toISOString();
      cachedRate = {
        rate,
        provider: provider.name,
        updatedAt,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return {
        rate,
        source: 'live',
        provider: provider.name,
        updatedAt,
        envInvalid: env.invalid,
      };
    }
  }

  if (env.rate !== null) {
    return {
      rate: env.rate,
      source: 'env',
      provider: '.env',
      updatedAt: null,
      envInvalid: false,
    };
  }

  return {
    rate: null,
    source: 'unavailable',
    provider: null,
    updatedAt: null,
    envInvalid: env.invalid,
  };
}
