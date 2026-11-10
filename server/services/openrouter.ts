import type { OfficeDivision } from '../../src/workflowTypes';

const officialBaseUrl = 'https://openrouter.ai/api/v1';

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

export function openRouterModel(division?: OfficeDivision): string {
  return (division && process.env[`OPENROUTER_MODEL_${division.toUpperCase()}`]?.trim()) ||
    process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
}

export async function openRouterRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new OpenRouterError('OPENROUTER_API_KEY belum dikonfigurasi.', 503);
  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim().replace(/\/+$/, '') || officialBaseUrl;
  if (baseUrl !== officialBaseUrl) throw new OpenRouterError('OPENROUTER_BASE_URL harus https://openrouter.ai/api/v1.', 503);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (error) {
    if (init.signal?.aborted || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) throw new OpenRouterError('Permintaan OpenRouter habis waktu; periksa penggunaan sebelum mencoba lagi.', 504);
    throw new OpenRouterError('Tidak dapat terhubung ke OpenRouter. Periksa jaringan server.', 502);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new OpenRouterError('OpenRouter menolak kunci atau izin. Periksa OPENROUTER_API_KEY.', 503);
    if (response.status === 402) throw new OpenRouterError('Kredit atau batas biaya OpenRouter tidak mencukupi. Periksa billing dan batas kunci.', 402);
    if (response.status === 429) throw new OpenRouterError('Batas permintaan OpenRouter tercapai. Periksa kuota sebelum mencoba lagi.', 429);
    throw new OpenRouterError(`OpenRouter menolak permintaan (HTTP ${response.status}). Periksa model, kuota, dan status layanan.`, 502);
  }
  try { return await response.json(); }
  catch { throw new OpenRouterError('Respons OpenRouter bukan JSON yang valid.', 502); }
}

export async function checkBudget(signal?: AbortSignal): Promise<void> {
  const result = await openRouterRequest('/key', { signal });
  if (!result || typeof result !== 'object' || !('data' in result) || !result.data || typeof result.data !== 'object') throw new OpenRouterError('Status batas kunci OpenRouter tidak tersedia; permintaan AI dibatalkan.', 503);
  const data = result.data;
  if (!('limit' in data) || typeof data.limit !== 'number' || !Number.isFinite(data.limit) || data.limit <= 0 || data.limit > 5 || !('limit_reset' in data) || data.limit_reset !== 'monthly') {
    throw new OpenRouterError('Atur batas kunci OpenRouter maksimal US$5 dengan reset bulanan sebelum menggunakan AI.', 503);
  }
  if (!('limit_remaining' in data) || typeof data.limit_remaining !== 'number' || !Number.isFinite(data.limit_remaining) || data.limit_remaining <= 0) throw new OpenRouterError('Batas bulanan kunci OpenRouter habis atau tidak tersedia.', 402);
}

export type OpenRouterResponse = { content: string; annotations: unknown[] };
export async function generateOpenRouter(instruction: string, system: string, division?: OfficeDivision, signal?: AbortSignal, web = false): Promise<OpenRouterResponse> {
  await checkBudget(signal);
  const model = openRouterModel(division);
  const result = await openRouterRequest('/chat/completions', {
    method: 'POST', signal,
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: instruction }], ...(web ? { plugins: [{ id: 'web', engine: 'exa', max_results: 5 }] } : {}) }),
  });
  if (!result || typeof result !== 'object' || !('choices' in result) || !Array.isArray(result.choices) || !result.choices[0] || typeof result.choices[0] !== 'object') throw new OpenRouterError('OpenRouter tidak mengembalikan pilihan respons yang valid.');
  const choice = result.choices[0];
  if (choice.finish_reason === 'length') throw new OpenRouterError('Respons OpenRouter terpotong karena batas keluaran.');
  const msg: unknown = choice.message;
  if (!msg || typeof msg !== 'object' || !('content' in msg) || typeof msg.content !== 'string' || !msg.content.trim()) throw new OpenRouterError('OpenRouter tidak mengembalikan teks yang valid.');
  return { content: msg.content, annotations: 'annotations' in msg && Array.isArray(msg.annotations) ? msg.annotations : [] };
}
