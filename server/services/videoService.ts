import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { checkBudget, openRouterFetch, openRouterRequest, OpenRouterError } from './openrouter.js';
import { videoEnabled } from './videoRuntimeConfig.js';

export { videoEnabled } from './videoRuntimeConfig.js';

const directory = process.env.VERCEL === '1'
  ? path.join('/tmp', 'video-storage')
  : path.resolve(process.cwd(), 'video-storage');
const defaultModel = 'heygen/heygen-video-1';
const maxVideoBytes = 100_000_000;
const pollIntervalMs = 10_000;
const generationTimeoutMs = 5 * 60_000;

export function videoPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('ID video tidak valid.');
  return path.join(directory, `${id}.mp4`);
}

function videoModel(): string {
  return process.env.OPENROUTER_VIDEO_MODEL?.trim() || defaultModel;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeVideoJobId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(value)) {
    throw new OpenRouterError('OpenRouter tidak mengembalikan ID tugas video yang valid.');
  }
  return value;
}

export function videoDurationForPrompt(prompt: string, supportedDurations: number[]): number {
  const script = videoScriptFromContent(prompt);
  const withoutVisualNotes = script.replace(/\*?\s*\(Visual:[\s\S]*?\)\s*\*?/gi, ' ');
  const dialogue = [...withoutVisualNotes.matchAll(/[“"]([^”"]+)[”"]/g)].map((match) => match[1]).join(' ');
  const speech = dialogue || withoutVisualNotes.replace(/\([^)]*\)/g, ' ').replace(/\bVisual\s*:/gi, ' ');
  const wordCount = speech.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  const durations = [...new Set(supportedDurations.filter((duration) => Number.isInteger(duration) && duration > 0))].sort((a, b) => a - b);
  if (!wordCount) throw new OpenRouterError('Bagian Naskah Narasi tidak memiliki dialog yang dapat digunakan untuk menentukan durasi video.', 400);
  if (!durations.length) throw new OpenRouterError('Model video OpenRouter tidak menyediakan durasi yang valid.', 503);
  const timestamps = [...script.matchAll(/\bDetik\s+\d+\s*[-–—]\s*(\d+)\b/gi)].map((match) => Number(match[1]));
  const requestedSeconds = Math.max(Math.ceil(wordCount / 2.5), timestamps.length ? Math.max(...timestamps) : 0);
  const duration = durations.find((supported) => supported >= requestedSeconds);
  if (!duration) {
    throw new OpenRouterError(`Naskah membutuhkan sekitar ${requestedSeconds} detik, tetapi model hanya mendukung sampai ${durations[durations.length - 1]} detik. Pilih model atau naskah yang lebih pendek; video tidak dikirim agar tidak terpotong.`, 400);
  }
  return duration;
}

export function videoScriptFromContent(content: string): string {
  const sections = new Set(['Judul Tren', 'Konsep', 'Hook 3 Detik', 'Caption', 'Target Platform', 'Tata Letak Visual', 'Hal yang Perlu Diverifikasi']);
  const lines = content.split(/\r?\n/);
  const normalize = (line: string) => line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .trim();
  const start = lines.findIndex((line) => /^Naskah Narasi\s*:/i.test(normalize(line)));
  if (start < 0) {
    throw new OpenRouterError('Paket konten tidak memiliki bagian Naskah Narasi. Perbaiki draf sebelum membuat video.', 400);
  }
  const heading = normalize(lines[start]).replace(/^Naskah Narasi\s*:/i, '').trim();
  const scriptLines = heading ? [heading] : [];
  for (const line of lines.slice(start + 1)) {
    const normalized = normalize(line);
    if ([...sections].some((section) => normalized.toLowerCase().startsWith(`${section.toLowerCase()}:`))) break;
    scriptLines.push(line);
  }
  const script = scriptLines.join('\n').trim();
  if (!script) throw new OpenRouterError('Bagian Naskah Narasi masih kosong. Lengkapi draf sebelum membuat video.', 400);
  return script;
}

async function supportedVideoDurations(model: string, signal: AbortSignal): Promise<number[]> {
  const result = await openRouterRequest('/videos/models', { method: 'GET', signal });
  if (!isObject(result) || !Array.isArray(result.data)) {
    throw new OpenRouterError('OpenRouter tidak mengembalikan katalog model video yang valid.');
  }
  const modelInfo = result.data.find((item) => isObject(item) && item.id === model);
  if (!isObject(modelInfo) || !Array.isArray(modelInfo.supported_durations)) {
    throw new OpenRouterError(`Model video ${model} tidak ditemukan atau tidak mengumumkan pilihan durasi.`, 503);
  }
  return modelInfo.supported_durations.filter((duration): duration is number =>
    typeof duration === 'number' && Number.isInteger(duration) && duration > 0);
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason);
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function createVideo(prompt: string): Promise<{ data: Buffer; model: string; costUsd: number | null }> {
  const signal = AbortSignal.timeout(generationTimeoutMs);
  if (!await videoEnabled()) throw new OpenRouterError('Saklar video dimatikan sebelum permintaan dikirim.', 409);
  await checkBudget(signal);
  const model = videoModel();
  const script = videoScriptFromContent(prompt);
  const duration = videoDurationForPrompt(prompt, await supportedVideoDurations(model, signal));
  const result = await openRouterRequest('/videos', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      model,
      prompt: `Buat video vertikal 9:16 berdurasi tepat ${duration} detik. Gunakan HANYA naskah dan arahan visual di bawah. Ucapkan semua kalimat di dalam tanda kutip secara persis, berurutan, tanpa memotong, mengubah, menambah, atau menghilangkan kata. Ikuti rentang waktu dan arahan visual tiap segmen. Narasi bahasa Indonesia dengan artikulasi wajar; sesuaikan jeda, pergantian adegan, dan visual agar seluruh dialog selesai sebelum video berakhir. Jangan menampilkan atau membacakan bagian lain dari paket konten. Hasil adalah draf untuk ditinjau manusia.\n\nNASKAH DAN ARAHAN VISUAL:\n${script}`,
      aspect_ratio: '9:16',
      resolution: '768p',
      duration,
    }),
  });
  if (!isObject(result)) throw new OpenRouterError('OpenRouter tidak mengembalikan status tugas video yang valid.');
  const jobId = safeVideoJobId(result.id);
  const deadline = Date.now() + generationTimeoutMs;
  let costUsd: number | null = null;
  let actualModel = model;

  while (Date.now() < deadline) {
    const statusResult = await openRouterRequest(`/videos/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      signal,
    });
    if (!isObject(statusResult) || typeof statusResult.status !== 'string') {
      throw new OpenRouterError('OpenRouter mengembalikan status tugas video yang tidak valid.');
    }
    if (typeof statusResult.model === 'string') actualModel = statusResult.model;
    if (isObject(statusResult.usage) && typeof statusResult.usage.cost === 'number' &&
        Number.isFinite(statusResult.usage.cost) && statusResult.usage.cost >= 0) {
      costUsd = statusResult.usage.cost;
    }

    if (statusResult.status === 'completed') {
      const content = await openRouterFetch(`/videos/${encodeURIComponent(jobId)}/content?index=0`, { signal });
      const declaredLength = Number(content.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > maxVideoBytes) {
        throw new OpenRouterError('Video OpenRouter melebihi batas ukuran penyimpanan.');
      }
      const data = Buffer.from(await content.arrayBuffer());
      if (data.length < 12 || data.length > maxVideoBytes || data.toString('ascii', 4, 8) !== 'ftyp') {
        throw new OpenRouterError('OpenRouter tidak mengembalikan MP4 yang valid atau ukuran video melebihi batas.');
      }
      return { data, model: actualModel, costUsd };
    }
    if (statusResult.status === 'failed' || statusResult.status === 'cancelled' || statusResult.status === 'expired') {
      throw new OpenRouterError('OpenRouter gagal membuat video. Periksa status model dan penggunaan sebelum mencoba ulang.');
    }
    if (statusResult.status !== 'pending' && statusResult.status !== 'in_progress') {
      throw new OpenRouterError('OpenRouter mengembalikan status tugas video yang tidak dikenal.');
    }
    await wait(Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 0)), signal);
  }
  throw new OpenRouterError('Pembuatan video OpenRouter melewati batas waktu. Status dan tagihan mungkin belum final; periksa OpenRouter sebelum mencoba ulang.', 504);
}

let busy = false;
export async function processNextVideo(): Promise<boolean> {
  if (busy) return false;
  busy = true;
  try {
    await prisma.videoJob.updateMany({
      where: { status: 'RUNNING', updatedAt: { lt: new Date(Date.now() - generationTimeoutMs - 60000) } },
      data: { status: 'UNKNOWN', error: 'Pemrosesan OpenRouter terputus; periksa status dan penggunaan di OpenRouter sebelum mencoba ulang.' },
    });
    if (!await videoEnabled()) return false;
    const job = await prisma.videoJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } });
    if (!job) return false;
    const claim = await prisma.videoJob.updateMany({ where: { id: job.id, status: 'QUEUED' }, data: { status: 'RUNNING' } });
    if (!claim.count) return false;
    try {
      const result = await createVideo(job.prompt);
      await mkdir(directory, { recursive: true });
      await writeFile(videoPath(job.id), result.data, { flag: 'wx' });
      if (result.costUsd !== null) {
        await prisma.openRouterUsage.create({
          data: {
            division: 'creator',
            model: result.model,
            costUsd: String(result.costUsd),
            usageAvailable: true,
          },
        });
      }
      const completed = await prisma.videoJob.updateMany({ where: { id: job.id, status: 'RUNNING' }, data: { status: 'READY', activeDraftId: null, error: null } });
      if (!completed.count) throw new Error('Status tugas berubah sebelum video tersimpan.');
    } catch (cause) {
      console.error('[Video OpenRouter] Pembuatan gagal:', cause instanceof Error ? cause.name : 'UnknownError');
      const message = cause instanceof OpenRouterError
        ? cause.message
        : 'Hasil video atau tagihan OpenRouter tidak dapat dipastikan. Periksa dashboard OpenRouter sebelum mencoba ulang.';
      const status = cause instanceof OpenRouterError && cause.status < 500 && cause.status !== 402 ? 'FAILED' : 'UNKNOWN';
      await prisma.videoJob.updateMany({
        where: { id: job.id, status: 'RUNNING' },
        data: { status, ...(status === 'FAILED' ? { activeDraftId: null } : {}), error: message },
      });
    }
    return true;
  } finally {
    busy = false;
  }
}

const videoIdleBackoffMs = [10_000, 30_000, 60_000];
let videoWorkerTimer: ReturnType<typeof setTimeout> | null = null;
let videoWorkerStarted = false;
let videoIdleStep = 0;

function scheduleVideoWorker(delayMs: number): void {
  if (!videoWorkerStarted) return;
  if (videoWorkerTimer) clearTimeout(videoWorkerTimer);
  videoWorkerTimer = setTimeout(() => {
    void (async () => {
      const worked = await processNextVideo();
      if (worked) {
        videoIdleStep = 0;
        scheduleVideoWorker(3_000);
      } else {
        const delay = videoIdleBackoffMs[Math.min(videoIdleStep, videoIdleBackoffMs.length - 1)];
        videoIdleStep = Math.min(videoIdleStep + 1, videoIdleBackoffMs.length - 1);
        scheduleVideoWorker(delay);
      }
    })().catch((error) => {
      console.error('[Video OpenRouter] Worker gagal:', error);
      scheduleVideoWorker(15_000);
    });
  }, delayMs);
}

export function wakeVideoWorker(): void {
  videoIdleStep = 0;
  if (videoWorkerStarted) scheduleVideoWorker(50);
}

export function startVideoWorker(): void {
  videoWorkerStarted = true;
  videoIdleStep = 0;
  scheduleVideoWorker(0);
}
