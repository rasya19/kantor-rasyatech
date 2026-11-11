import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creatorFollowupInstruction,
  creatorFollowupJobId,
  digitalProductFollowupInstruction,
  digitalProductPackageProblems,
  mandateRequestsContent,
  sourceDraftForCreatorFollowup,
} from '../server/services/creatorFollowup';

test('only content-related mandates qualify for the optional Creator handoff', () => {
  assert.equal(mandateRequestsContent('Buat panduan dan konten menarik untuk klien'), true);
  assert.equal(mandateRequestsContent('Periksa alur administrasi PAUD'), false);
});

test('Creator follow-up IDs preserve and recover the exact source draft ID', () => {
  const draftId = 'job-root:child';
  const jobId = creatorFollowupJobId(draftId);
  assert.equal(jobId, 'job-root:child:creator-followup');
  assert.equal(sourceDraftForCreatorFollowup(jobId), draftId);
  assert.equal(sourceDraftForCreatorFollowup('unrelated-job'), undefined);
});

test('Creator follow-up treats prior AI output as context and only uses owner-verified features', () => {
  const instruction = creatorFollowupInstruction(
    'Buat konten untuk klien',
    'AI mengklaim fitur tidak terverifikasi',
    'Fitur A tersedia; Fitur B belum ada',
  );
  assert.match(instruction, /Draf sebelumnya hanya konteks, bukan bukti produk/);
  assert.match(instruction, /satu-satunya fakta fitur yang boleh dinyatakan/);
  assert.match(instruction, /Jangan menambahkan fitur, integrasi, hasil/);
  assert.match(instruction, /Fitur A tersedia; Fitur B belum ada/);
  assert.match(instruction, /Jangan menghubungi klien.*membuat video.*memublikasikan/);
});

test('digital product package validation accepts different complete product formats', () => {
  const content = [
    'Judul Produk: Kit Konten UMKM',
    'Jenis Produk: Template konten',
    'Target Pengguna: Pemilik usaha kecil',
    'Ringkasan: Template konten praktis.',
    'Cara Pakai: Pilih template dan isi detail produk.',
    'Isi Produk: Sepuluh template yang dapat diedit.',
    'Contoh Uji Sintetis: Data rekaan.',
    'Batasan dan Hal yang Perlu Diverifikasi: Tinjau klaim produk.',
    'Deskripsi Listing Produk: Kit konten untuk ditinjau.',
  ].join('\n');
  assert.deepEqual(digitalProductPackageProblems(content), []);
  assert.deepEqual(digitalProductPackageProblems('Judul Produk: Produk kecil'), [
    'Jenis Produk',
    'Target Pengguna',
    'Ringkasan',
    'Cara Pakai',
    'Isi Produk',
    'Contoh Uji Sintetis',
    'Batasan dan Hal yang Perlu Diverifikasi',
    'Deskripsi Listing Produk',
  ]);
});

test('digital product follow-up creates an MVP only from the explicitly selected idea', () => {
  const instruction = digitalProductFollowupInstruction('Riset tentang template konten untuk UMKM.', '## IDE PRODUK 2: Template konten UMKM\nFormat: template.');
  assert.match(instruction, /hanya dari ide yang dipilih langsung oleh pimpinan/i);
  assert.match(instruction, /panduan\/workbook/);
  assert.match(instruction, /IDE YANG DIPILIH PIMPINAN:[\s\S]*IDE PRODUK 2/);
  assert.match(instruction, /link di bio kecuali tautan pemesanan resmi diberikan/i);
  assert.match(instruction, /Isi Produk:/);
  assert.doesNotMatch(instruction, /tepat 10 prompt/i);
});
