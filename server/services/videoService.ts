import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';

const directory = path.resolve(process.cwd(), 'video-storage');
const model = 'gemini-omni-1.2-flash';

export function videoPath(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('ID video tidak valid.');
  return path.join(directory, `${id}.mp4`);
}

export function videoEnabled(): boolean {
  return process.env.VIDEO_ENABLED === 'true';
}

let busy = false;
export async function processNextVideo(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await prisma.videoJob.updateMany({
      where: { status: 'RUNNING', updatedAt: { lt: new Date(Date.now() - 300000) } },
      data: { status: 'UNKNOWN', error: 'Pemrosesan terputus; tagihan atau hasil mungkin ada. Periksa Google sebelum meminta video baru.' },
    });
    if (!videoEnabled()) return;
    const job = await prisma.videoJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } });
    if (!job) return;
    const claim = await prisma.videoJob.updateMany({ where: { id: job.id, status: 'QUEUED' }, data: { status: 'RUNNING' } });
    if (!claim.count) return;
    let status = 'UNKNOWN';
    let error = 'Hasil video tidak dapat dipastikan. Periksa tagihan Google sebelum membuat ulang.';
    try {
      const key = process.env.GEMINI_API_KEY;
      if (!key || key === 'MY_GEMINI_API_KEY') {
        status = 'FAILED';
        error = 'GEMINI_API_KEY belum dikonfigurasi.';
        throw new Error(error);
      }
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          model, store: false,
          input: `Buat video vertikal pendek untuk media sosial dari paket berikut. Gunakan narasi bahasa Indonesia dan audio yang sesuai. Prioritaskan hook dan adegan yang dapat disampaikan dalam 10 detik. Jangan membuat klaim yang tidak ada dalam paket. Hasil adalah draf yang akan ditinjau manusia.\n\n${job.prompt}`,
          response_format: { type: 'video', aspect_ratio: '9:16', resolution: '720p', duration: '10s' },
        }),
        signal: AbortSignal.timeout(180000),
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) status = 'FAILED';
        error = `Gemini menolak pembuatan video (HTTP ${response.status}). Periksa akses model, billing, kuota dan kebijakan Google. Periksa tagihan sebelum membuat ulang.`;
        throw new Error(error);
      }
      const result: unknown = await response.json();
      const steps = result && typeof result === 'object' && 'steps' in result && Array.isArray(result.steps) ? result.steps : [];
      const content: unknown[] = steps.flatMap((step: unknown) =>
        step && typeof step === 'object' && 'type' in step && step.type === 'model_output' && 'content' in step && Array.isArray(step.content) ? step.content : []);
      const video = content.find((item) => item && typeof item === 'object' && 'type' in item && item.type === 'video' &&
        'mime_type' in item && item.mime_type === 'video/mp4' && 'data' in item && typeof item.data === 'string');
      if (!video || typeof video !== 'object' || !('data' in video) || typeof video.data !== 'string' || video.data.length > 100_000_000) {
        error = 'Respons tidak berisi video MP4 yang valid atau melebihi batas ukuran. Periksa tagihan Google.';
        throw new Error(error);
      }
      const data = Buffer.from(video.data, 'base64');
      if (data.length < 12 || data.toString('ascii', 4, 8) !== 'ftyp') {
        error = 'Video yang diterima bukan MP4 valid. Periksa tagihan Google.';
        throw new Error(error);
      }
      await mkdir(directory, { recursive: true });
      await writeFile(videoPath(job.id), data, { flag: 'wx' });
      const completed = await prisma.videoJob.updateMany({ where: { id: job.id, status: 'RUNNING' }, data: { status: 'READY', error: null } });
      if (!completed.count) throw new Error('Status tugas berubah sebelum video tersimpan.');
      return;
    } catch (cause) {
      console.error('[Video] Pembuatan gagal:', cause instanceof Error ? cause.name : 'UnknownError');
      await prisma.videoJob.updateMany({ where: { id: job.id, status: 'RUNNING' }, data: { status, error } });
    }
  } finally {
    busy = false;
  }
}

export function startVideoWorker(): void {
  const run = () => { void processNextVideo().catch((error) => console.error('[Video] Worker gagal:', error)); };
  run();
  setInterval(run, 5000);
}
