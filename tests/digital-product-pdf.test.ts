import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalProductPdf } from '../src/lib/digitalProductPdf';

test('digital product content exports as a valid multi-page-ready PDF file', () => {
  const content = [
    'Judul Produk: Kit Konten UMKM',
    'Jenis Produk: Template konten',
    'Target Pengguna: Pemilik usaha kecil',
    'Ringkasan: Materi konten yang dapat disunting.',
    'Cara Pakai: Pilih template dan isi detail produk.',
    'Isi Produk: Template caption, kalender publikasi, dan daftar pemeriksaan.',
    'Contoh Uji Sintetis: Contoh rekaan, bukan testimoni.',
    'Batasan dan Hal yang Perlu Diverifikasi: Periksa semua klaim sebelum digunakan.',
    'Deskripsi Listing Produk: Kit konten untuk dicoba dan disesuaikan. Uji: “UMKM” – cepat • cocok.',
  ].join('\n');
  const { pdf, filename } = createDigitalProductPdf('Kit Konten UMKM', content);
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert.equal(filename, 'kit-konten-umkm.pdf');
  assert.ok(pdf.internal.pages.length > 1);
  assert.match(new TextDecoder().decode(bytes), /UMKM/);
});
