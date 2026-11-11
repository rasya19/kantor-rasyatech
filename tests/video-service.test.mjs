import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/lib/prisma.ts';
import { processNextVideo, videoEnabled, videoDurationForPrompt, videoScriptFromContent } from '../server/services/videoService.ts';

test('video duration follows the quoted narration timeline and rejects scripts longer than the model limit', () => {
  const durations = [3, 5, 10, 15];
  assert.equal(videoDurationForPrompt('Naskah Narasi: Hai semua.\nCaption: #contoh', durations), 3);
  const script = `**Naskah Narasi:**
1. **Detik 4-10:**
   *“Salin prompt ini, tempel ke AI, dan dapatkan draf modul ajar dalam 10 detik. Hasilnya siap diedit sesuai kebutuhan kelas!”*
   *(Visual: Screen recording ChatGPT dengan Prompt 1, watermark “Contoh: Perlu Verifikasi Guru”)*
2. **Detik 11-20:**
   *“Dari soal HOTS sampai rubrik penilaian, semua bisa dibuat lebih cepat. Perhatikan tanda 🔍 untuk bagian yang perlu penyesuaian.”*
   *(Visual: Hasil AI berganti-ganti dengan teks merah “Contoh” di sudut)*
3. **Detik 21-27:**
   *“Unduh paket 10 Prompt lengkap di Lynk.id! Link ada di bio.”*
   *(Visual: Thumbnail PDF dengan teks “Prompt Praktis untuk Guru”)*
**Caption:**
Jangan jadikan caption sebagai dialog.`;
  const heygenDurations = Array.from({ length: 26 }, (_, index) => index + 5);
  assert.equal(videoDurationForPrompt(script, heygenDurations), 27);
  assert.match(videoScriptFromContent(script), /Detik 21-27/);
  assert.doesNotMatch(videoScriptFromContent(script), /Jangan jadikan caption/);
  assert.throws(() => videoDurationForPrompt(script, [5, 15]), /membutuhkan sekitar 27 detik/);
  assert.throws(() => videoScriptFromContent('Judul Tren: ide\nCaption: #contoh'), /tidak memiliki bagian Naskah Narasi/);
});

test('video generation stays disabled in runtime config even with the legacy flag enabled', async (t) => {
  const previous = process.env.VIDEO_ENABLED;
  process.env.VIDEO_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.VIDEO_ENABLED; else process.env.VIDEO_ENABLED = previous; });
  const originalUpdate = prisma.videoJob.updateMany;
  const originalFind = prisma.videoJob.findFirst;
  t.after(() => { prisma.videoJob.updateMany = originalUpdate; prisma.videoJob.findFirst = originalFind; });
  const originalConfig = prisma.videoRuntimeConfig.upsert;
  prisma.videoRuntimeConfig.upsert = async () => ({ enabled: false, approvedBudgetIdr: 100000 });
  t.after(() => { prisma.videoRuntimeConfig.upsert = originalConfig; });
  prisma.videoJob.updateMany = async () => ({ count: 0 });
  let finds = 0;
  prisma.videoJob.findFirst = async () => { finds++; throw new Error('Queue must not be read'); };
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Video must not be sent'); });
  assert.equal(await videoEnabled(), false);
  await processNextVideo();
  assert.equal(finds, 0);
  assert.equal(fetch.mock.calls.length, 0);
});
