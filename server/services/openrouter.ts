import type { OfficeDivision } from '../../src/workflowTypes';
import { prisma } from '../lib/prisma';

const officialBaseUrl = 'https://openrouter.ai/api/v1';
const defaultModels: Record<OfficeDivision, string> = {
  paud: 'google/gemini-2.5-flash',
  posyandu: 'google/gemini-2.5-flash',
  creator: 'deepseek/deepseek-chat',
  engineer: 'qwen/qwen-2.5-coder-32b-instruct',
  cyber: 'anthropic/claude-3.5-sonnet',
  finance: 'google/gemini-2.5-flash',
  marketing: 'google/gemini-2.5-flash',
};
const defaultFallbacks: Record<OfficeDivision, string[]> = {
  paud: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
  posyandu: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
  creator: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
  engineer: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
  cyber: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
  finance: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
  marketing: ['anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
};

export class OpenRouterError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

export function openRouterModel(division?: OfficeDivision): string {
  return (division && process.env[`OPENROUTER_MODEL_${division.toUpperCase()}`]?.trim()) ||
    process.env.OPENROUTER_MODEL?.trim() ||
    (division ? defaultModels[division] : 'google/gemini-2.5-flash');
}

export function openRouterModels(division?: OfficeDivision): string[] {
  const primary = openRouterModel(division);
  const configured = division
    ? process.env[`OPENROUTER_FALLBACK_MODELS_${division.toUpperCase()}`]
    : undefined;
  const fallbacks = configured === undefined
    ? division ? defaultFallbacks[division] : []
    : configured.split(',').map((model) => model.trim()).filter(Boolean);
  const distinctFallbacks = [...new Set(fallbacks.filter((model) => model !== primary))];
  if (distinctFallbacks.length > 2) throw new OpenRouterError('Maksimal dua model fallback dapat dikonfigurasi per divisi.', 503);
  return [primary, ...distinctFallbacks];
}

export async function openRouterFetch(path: string, init: RequestInit = {}): Promise<Response> {
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
    if (response.status === 401 || response.status === 403) throw new OpenRouterError('OpenRouter menolak kunci atau izin. Periksa konfigurasi dan jenis kunci OpenRouter.', 503);
    if (response.status === 402) throw new OpenRouterError('Kredit atau batas biaya OpenRouter tidak mencukupi. Periksa billing dan batas kunci.', 402);
    if (response.status === 429) throw new OpenRouterError('Batas permintaan OpenRouter tercapai. Periksa kuota sebelum mencoba lagi.', 429);
    throw new OpenRouterError(`OpenRouter menolak permintaan (HTTP ${response.status}). Periksa model, kuota, dan status layanan.`, 502);
  }
  return response;
}

export async function openRouterRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await openRouterFetch(path, init);
  const responseBody = await response.text();
  try { return JSON.parse(responseBody) as unknown; }
  catch {
    const contentType = response.headers.get('content-type')?.split(';', 1)[0] || 'tidak diketahui';
    throw new OpenRouterError(
      `OpenRouter mengembalikan respons non-JSON (HTTP ${response.status}, content-type ${contentType}). Periksa gangguan gateway/jaringan; permintaan mungkin tetap ditagih.`,
      502,
    );
  }
}

export type OpenRouterKeyBudget = { limitUsd: number; remainingUsd: number; reset: 'monthly' };

export async function getOpenRouterKeyBudget(signal?: AbortSignal): Promise<OpenRouterKeyBudget> {
  const result = await openRouterRequest('/key', { signal });
  if (!result || typeof result !== 'object' || !('data' in result) || !result.data || typeof result.data !== 'object') {
    throw new OpenRouterError('Status batas kunci OpenRouter tidak tersedia.', 503);
  }
  const data = result.data;
  if (!('limit' in data) || typeof data.limit !== 'number' || !Number.isFinite(data.limit) || data.limit <= 0 ||
      !('limit_reset' in data) || data.limit_reset !== 'monthly' ||
      !('limit_remaining' in data) || typeof data.limit_remaining !== 'number' ||
      !Number.isFinite(data.limit_remaining) || data.limit_remaining < 0) {
    throw new OpenRouterError('Data sisa batas bulanan OpenRouter tidak valid atau tidak tersedia.', 503);
  }
  return { limitUsd: data.limit, remainingUsd: data.limit_remaining, reset: 'monthly' };
}

export type OpenRouterCredits = { totalCredits: number; totalUsage: number };

export async function getOpenRouterCredits(signal?: AbortSignal): Promise<OpenRouterCredits> {
  const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY?.trim();
  if (!managementKey) {
    throw new OpenRouterError('OPENROUTER_MANAGEMENT_KEY belum dikonfigurasi; endpoint saldo akun memerlukan Management API Key.', 503);
  }
  const result = await openRouterRequest('/credits', {
    signal,
    headers: { Authorization: `Bearer ${managementKey}` },
  });
  if (!result || typeof result !== 'object' || !('data' in result) || !result.data || typeof result.data !== 'object') {
    throw new OpenRouterError('Informasi kredit akun OpenRouter tidak tersedia.', 503);
  }
  const data = result.data;
  if (!('total_credits' in data) || typeof data.total_credits !== 'number' ||
      !Number.isFinite(data.total_credits) || data.total_credits < 0 ||
      !('total_usage' in data) || typeof data.total_usage !== 'number' ||
      !Number.isFinite(data.total_usage) || data.total_usage < 0) {
    throw new OpenRouterError('Data kredit akun OpenRouter tidak valid atau tidak tersedia.', 503);
  }
  return { totalCredits: data.total_credits, totalUsage: data.total_usage };
}

export async function checkBudget(signal?: AbortSignal): Promise<void> {
  const budget = await getOpenRouterKeyBudget(signal);
  const maxBudget = Number(process.env.OPENROUTER_MAX_MONTHLY_USD ?? '25');
  if (!Number.isFinite(maxBudget) || maxBudget <= 0 || maxBudget > 25) {
    throw new OpenRouterError('OPENROUTER_MAX_MONTHLY_USD harus lebih dari 0 dan maksimal US$25.', 503);
  }
  if (budget.limitUsd > maxBudget) {
    throw new OpenRouterError(`Atur batas kunci OpenRouter maksimal US$${maxBudget} dengan reset bulanan sebelum menggunakan AI.`, 503);
  }
  if (budget.remainingUsd <= 0) throw new OpenRouterError('Batas bulanan kunci OpenRouter habis atau tidak tersedia.', 402);
}

export type OpenRouterResponse = {
  content: string;
  annotations: unknown[];
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null; costUsd: number | null; available: boolean };
};
export async function generateOpenRouter(instruction: string, system: string, division?: OfficeDivision, signal?: AbortSignal, web = false, product?: string): Promise<OpenRouterResponse> {
  await checkBudget(signal);
  const models = openRouterModels(division);
  const result = await openRouterRequest('/chat/completions', {
    method: 'POST', signal,
    body: JSON.stringify({ models, messages: [{ role: 'system', content: system }, { role: 'user', content: instruction }], ...(web ? { plugins: [{ id: 'web', engine: 'exa', max_results: 5 }] } : {}) }),
  });
  if (!result || typeof result !== 'object' || !('choices' in result) || !Array.isArray(result.choices) || !result.choices[0] || typeof result.choices[0] !== 'object') throw new OpenRouterError('OpenRouter tidak mengembalikan pilihan respons yang valid.');
  const choice = result.choices[0];
  if (choice.finish_reason === 'length') throw new OpenRouterError('Respons OpenRouter terpotong karena batas keluaran.');
  const msg: unknown = choice.message;
  if (!msg || typeof msg !== 'object' || !('content' in msg) || typeof msg.content !== 'string' || !msg.content.trim()) throw new OpenRouterError('OpenRouter tidak mengembalikan teks yang valid.');
  const usage = 'usage' in result && result.usage && typeof result.usage === 'object' ? result.usage : null;
  const promptTokens = usage && 'prompt_tokens' in usage && typeof usage.prompt_tokens === 'number' && Number.isInteger(usage.prompt_tokens) && usage.prompt_tokens >= 0
    ? usage.prompt_tokens : null;
  const completionTokens = usage && 'completion_tokens' in usage && typeof usage.completion_tokens === 'number' && Number.isInteger(usage.completion_tokens) && usage.completion_tokens >= 0
    ? usage.completion_tokens : null;
  const costUsd = usage && 'cost' in usage && typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0
    ? usage.cost : null;
  const model = 'model' in result && typeof result.model === 'string' ? result.model : models[0];
  try {
    await prisma.openRouterUsage.create({
      data: {
        division: division ?? 'unassigned',
        product: product ?? null,
        model,
        promptTokens,
        completionTokens,
        costUsd: costUsd === null ? null : String(costUsd),
        usageAvailable: promptTokens !== null && completionTokens !== null && costUsd !== null,
      },
    });
  } catch (error) {
    console.error('[OpenRouter] Gagal mencatat pemakaian:', error);
    throw new OpenRouterError('Respons AI berhasil dibuat, tetapi pencatatan biaya gagal. Periksa database sebelum mengulangi tugas; permintaan mungkin tetap ditagih.', 503);
  }
  return {
    content: msg.content,
    annotations: 'annotations' in msg && Array.isArray(msg.annotations) ? msg.annotations : [],
    model,
    usage: { promptTokens, completionTokens, costUsd, available: promptTokens !== null && completionTokens !== null && costUsd !== null },
  };
}
