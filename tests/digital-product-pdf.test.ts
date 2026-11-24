import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalProductPdf } from '../src/lib/digitalProductPdf';

test('digital product content exports as a clean buyer-ready multi-page PDF without seller metadata or internal watermarks', () => {
  const content = [
    'Judul Produk: Kit Konten UMKM',
    'Subjudul: Koleksi template konten dan panduan kalender siap pakai',
    'Jenis Produk: Template konten',
    'Target Pengguna: Pemilik usaha kecil',
    'Ringkasan: Materi konten praktis yang langsung siap dipakai untuk promosi harian.',
    'Cara Pakai: Pilih template yang sesuai lalu isi nama usaha dan produk Anda.',
    'Isi Produk:',
    '## Bab 1: Template Caption Siap Pakai',
    '1. Caption pengenalan produk unggulan untuk pelanggan baru.',
    '2. Caption cerita di balik dapur produksi usaha Anda.',
    '',
    '## Bab 2: Jadwal Publikasi',
    '| Hari | Topik | Format |',
    '| --- | --- | --- |',
    '| Senin | Edukasi | Carousel |',
    '| Kamis | Promo | Reels |',
    '',
    'Laporan disampaikan untuk ditinjau pimpinan.',
    'Contoh Uji Sintetis: Contoh rekaan, bukan testimoni.',
    'Batasan dan Hal yang Perlu Diverifikasi: Periksa semua klaim sebelum digunakan.',
    '=== METADATA & LISTING SELLER ===',
    'Deskripsi Listing Lynk.id: Kit konten untuk dicoba dan disesuaikan. Uji: “UMKM” – cepat • cocok.',
    'Saran Harga: Rp35.000 sebagai saran awal.',
    'Batasan dan Catatan Verifikasi: Cek ulang sebelum unggah ke Lynk.id.',
  ].join('\n');

  const { pdf, filename } = createDigitalProductPdf('Kit Konten UMKM', content);
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  const decoded = new TextDecoder().decode(bytes);

  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert.equal(filename, 'kit-konten-umkm.pdf');
  assert.ok(pdf.internal.pages.length >= 4);
  assert.match(decoded, /Kit Konten UMKM/);
  assert.match(decoded, /Template Caption Siap Pakai/);
  assert.match(decoded, /Jadwal Publikasi/);

  // Must never include seller metadata or internal watermarks
  assert.doesNotMatch(decoded, /Tinjau dan sesuaikan sebelum dijual/i);
  assert.doesNotMatch(decoded, /Contoh Uji Sintetis/i);
  assert.doesNotMatch(decoded, /Batasan dan Hal yang Perlu Diverifikasi/i);
  assert.doesNotMatch(decoded, /Batasan dan Catatan Verifikasi/i);
  assert.doesNotMatch(decoded, /Deskripsi Listing/i);
  assert.doesNotMatch(decoded, /Rp35\.000/);
  assert.doesNotMatch(decoded, /Laporan disampaikan untuk ditinjau pimpinan/i);
});
