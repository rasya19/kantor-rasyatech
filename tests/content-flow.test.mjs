import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardContentStage } from '../server/services/contentFlow.ts';

test('content stages retain the original staff mandate and adapt instructions to each draft', async () => {
  const jobs = [];
  const tx = {
    officeJob: {
      findFirst: async () => ({ instruction: 'Mandat: buat konten untuk guru PAUD berdasarkan laporan yang disetujui.' }),
      create: async ({ data }) => jobs.push(data),
    },
  };

  await forwardContentStage(tx, 'flow-1', 'trendy', 'Ide Trendy: konten edukasi tentang tema laporan.');
  assert.match(jobs[0].instruction, /untuk guru PAUD/);
  assert.match(jobs[0].instruction, /Ide Trendy: konten edukasi/);
  assert.match(jobs[0].instruction, /Sesuaikan audiens/);

  await forwardContentStage(tx, 'flow-1', 'script_ai', 'Naskah: narasi utuh untuk video.');
  assert.match(jobs[1].instruction, /untuk guru PAUD/);
  assert.match(jobs[1].instruction, /narasi utuh untuk video/);
  assert.match(jobs[1].instruction, /jangan meringkas menjadi jawaban satu-dua kalimat/);
});
