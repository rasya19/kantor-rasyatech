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
    '=== BAGIAN 1: ISI PRODUK PEMBELI (DICETAK KE PDF) ===',
    'Judul Produk: Kit Konten UMKM',
    'Subjudul: Koleksi aset konten siap pakai untuk bisnis rumahan',
    'Jenis Produk: Template konten',
    'Target Pengguna: Pemilik usaha kecil',
    'Ringkasan: Template konten praktis yang langsung dapat disalin.',
    'Cara Pakai: Pilih template dan isi detail produk Anda.',
    'Isi Produk:',
    '## Bab 1: Template Utama',
    '1. Template pengenalan produk lengkap siap unggah.',
    '',
    '=== METADATA & LISTING SELLER ===',
    'Deskripsi Listing Lynk.id: Kit konten siap pakai untuk pemilik UMKM.',
    'Saran Harga: Saran hipotesis Rp29.000 - Rp49.000.',
    'Batasan dan Catatan Verifikasi: Periksa ulang sebelum diunggah ke Lynk.id.',
  ].join('\n');
  assert.deepEqual(digitalProductPackageProblems(content), []);
  assert.deepEqual(digitalProductPackageProblems('Judul Produk: Produk kecil'), [
    'Jenis Produk',
    'Target Pengguna',
    'Ringkasan',
    'Cara Pakai',
    'Isi Produk',
    'Deskripsi Listing Lynk.id',
    'Saran Harga',
    'Batasan dan Catatan Verifikasi',
  ]);
});

test('digital product follow-up creates a complete buyer-ready product only from the explicitly selected idea', () => {
  const instruction = digitalProductFollowupInstruction('Riset tentang template konten untuk UMKM.', '## IDE PRODUK 2: Template konten UMKM\nFormat: template.');
  assert.match(instruction, /hanya dari ide yang dipilih langsung oleh pimpinan/i);
  assert.match(instruction, /panduan\/workbook/i);
  assert.match(instruction, /IDE YANG DIPILIH PIMPINAN:[\s\S]*IDE PRODUK 2/);
  assert.match(instruction, /link di bio kecuali tautan pemesanan resmi diberikan/i);
  assert.match(instruction, /Isi Produk:/);
  assert.match(instruction, /=== METADATA & LISTING SELLER ===/);
  assert.doesNotMatch(instruction, /tepat 10 prompt/i);
});
