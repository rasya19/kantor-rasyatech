import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contentPackageInstruction,
  contentPackageProblems,
  digitalProductPackageInstruction,
  digitalProductPackageProblems,
  digitalProductSystemInstruction,
  splitDigitalProductPackage,
} from '../server/services/contentPackage';
import { createDigitalProductPdf } from '../src/lib/digitalProductPdf';

const complete = `Judul Tren: Ide PAUD
Konsep: Edukasi
Hook 3 Detik: Pertanyaan
Naskah Narasi: Narasi sintetis
Caption: Caption #edukasi
Target Platform: TikTok, Reels, Shorts
Tata Letak Visual: Template 9:16
Hal yang Perlu Diverifikasi: Fitur produk`;

function buildComplete30CaptionProduct(): string {
  const captions = Array.from({ length: 30 }, (_, i) => {
    const num = i + 1;
    return `${num}. Caption UMKM Hari ${num}: Ceritakan keunggulan produk unggulan Anda dengan bahasa hangat, jelaskan manfaat utama untuk pelanggan, dan tutup dengan ajakan bertanya di kolom komentar. #umkm #kontenjualan`;
  }).join('\n');

  return [
    '=== BAGIAN 1: ISI PRODUK PEMBELI (DICETAK KE PDF) ===',
    'Judul Produk: 30 Caption Siap Pakai & Kalender Konten UMKM Kuliner',
    'Subjudul: Panduan lengkap 30 hari promosi organik tanpa bingung mencari ide',
    'Jenis Produk: Kit Konten & Panduan Praktis',
    'Target Pengguna: Pemilik usaha kuliner rumahan dan UMKM pemula',
    'Ringkasan: Panduan ini berisi 30 caption lengkap siap salin, tabel jadwal unggah mingguan, dan kumpulan prompt praktis untuk mempercepat produksi konten harian.',
    'Cara Pakai:',
    '1. Pilih caption sesuai tema hari berjalan dari Bab 1.',
    '2. Ganti nama menu dan lokasi usaha Anda.',
    '3. Cocokkan jadwal posting dengan grid kalender di Bab 2.',
    'Isi Produk:',
    '## Bab 1: 30 Caption Lengkap Siap Pakai',
    captions,
    '',
    '## Bab 2: Grid Kalender Konten Mingguan',
    '| Hari | Fokus Tema | Format | Tujuan |',
    '| --- | --- | --- | --- |',
    '| Senin | Edukasi Bahan Baku | Carousel | Bangun kepercayaan |',
    '| Rabu | Proses Dapur | Reels 9:16 | Tunjukkan kualitas |',
    '| Jumat | Promo Paket Hemat | Foto Produk | Dorong pesan akhir pekan |',
    '',
    '## Bab 3: Koleksi Prompt AI Tambahan',
    '```',
    'Prompt 1: Tulis variasi caption singkat 60 kata untuk menu minuman dingin UMKM dengan nada akrab.',
    'Prompt 2: Susun 5 ide hook visual 3 detik untuk video penyajian makanan hangat.',
    '```',
    '',
    '=== METADATA & LISTING SELLER ===',
    'Deskripsi Listing Lynk.id: Paket PDF berisi 30 caption lengkap siap pakai, grid kalender mingguan, dan prompt tambahan untuk UMKM kuliner.',
    'Saran Harga: Hipotesis saran harga Rp29.000 - Rp49.000 untuk pasar UMKM pemula.',
    'Batasan dan Catatan Verifikasi: Periksa ulang seluruh penulisan dan unggah manual ke halaman Lynk.id.',
  ].join('\n');
}

test('content package requires all non-empty sections and a supported platform', () => {
  assert.deepEqual(contentPackageProblems(complete), []);
  assert.deepEqual(contentPackageProblems(complete.replace('Caption: Caption #edukasi', 'Caption:')), ['Caption']);
  assert.deepEqual(contentPackageProblems(complete.replace('TikTok, Reels, Shorts', 'Blog')), ['Target Platform (TikTok, Reels, atau Shorts)']);
  assert.ok(contentPackageProblems('Paket singkat').includes('Judul Tren'));
  assert.deepEqual(contentPackageProblems(complete.replace('Judul Tren:', '## **Judul Tren:**')), []);
  assert.ok(contentPackageProblems(complete.replace('Naskah Narasi: Narasi sintetis', 'Naskah Narasi: Beli sekarang, link di bio')).includes('Ajakan pembelian tanpa tautan resmi yang diberikan'));
  assert.deepEqual(contentPackageProblems(complete.replace('Naskah Narasi: Narasi sintetis', 'Naskah Narasi: Beli sekarang di https://example.org')), []);
  assert.deepEqual(contentPackageProblems(complete.replace('Judul Tren: Ide PAUD', '## Judul Tren\nIde PAUD')), []);
  assert.match(contentPackageInstruction, /Jangan menyuruh audiens membeli.*link di bio kecuali tautan\/cara pemesanan resmi/i);

  const numberedAndBulleted = [
    '1. **Judul Tren:** Pembukuan UMKM anti boncos',
    '### 2. Konsep',
    'Edukasi pembukuan harian warung',
    '- **Hook 3 Detik:** Jualan ramai tapi uangnya ke mana?',
    '4. **Naskah Narasi:** Pakai tabel kas harian praktis ini. Klik link di bio sekarang!',
    '5. Caption : Simpan postingan ini #umkm',
    '6. **Target Platform:** TikTok & Reels',
    '7. **Tata Letak Visual:** Rekaman layar PDF',
    '8. **Hal yang Perlu Diverifikasi:** Harga produk',
  ].join('\n');
  assert.deepEqual(
    contentPackageProblems(numberedAndBulleted, 'Pemesanan resmi via https://wa.me/6281918226387 atau 0819-1822-6387.'),
    [],
  );
  assert.deepEqual(
    contentPackageProblems(numberedAndBulleted, 'Hubungi WA 0819-1822-6387 untuk memesan.'),
    [],
  );
});

test('digital product package instruction mandates complete buyer-ready content and separates seller metadata', () => {
  assert.match(digitalProductSystemInstruction, /SIAP JUAL|SIAP PAKAI/i);
  assert.match(digitalProductSystemInstruction, /METADATA & LISTING SELLER/i);
  assert.match(digitalProductPackageInstruction, /=== METADATA & LISTING SELLER ===/);
  assert.match(digitalProductPackageInstruction, /Deskripsi Listing Lynk\.id:/);
  assert.match(digitalProductPackageInstruction, /Saran Harga:/);
  assert.match(digitalProductPackageInstruction, /Batasan dan Catatan Verifikasi:/);
  assert.match(digitalProductPackageInstruction, /ISI PRODUK UTUH DAN LENGKAP/i);
  assert.match(digitalProductPackageInstruction, /1 sampai 30|1–30/i);
  assert.match(digitalProductPackageInstruction, /DILARANG.*Contoh Uji Sintetis/i);
});

test('digital product package validator enforces full promised item count and rejects placeholders or internal leaks', () => {
  const fullPackage = buildComplete30CaptionProduct();
  assert.deepEqual(digitalProductPackageProblems(fullPackage), []);

  // Rejects when title promises 30 captions but content only provides 2 synthetic examples
  const truncatedPackage = fullPackage.replace(
    /## Bab 1: 30 Caption Lengkap Siap Pakai[\s\S]*?## Bab 2:/,
    '## Bab 1: 30 Caption Lengkap Siap Pakai\n1. Caption contoh pertama.\n2. Caption contoh kedua, dan seterusnya sampai 30.\n\n## Bab 2:',
  );
  const truncatedProblems = digitalProductPackageProblems(truncatedPackage);
  assert.ok(truncatedProblems.some((p) => /placeholder\/singkatan daftar/i.test(p)));
  assert.ok(truncatedProblems.some((p) => /ditemukan 2 dari 30 caption/i.test(p)));

  // Rejects internal notes leaked into buyer content
  const leakedInternal = `${fullPackage.replace(
    'Ringkasan: Panduan ini',
    'Ringkasan: Laporan disampaikan untuk ditinjau pimpinan. Panduan ini',
  )}\nContoh Uji Sintetis: Contoh rekaan internal.`;
  const leakedProblems = digitalProductPackageProblems(leakedInternal);
  assert.ok(leakedProblems.some((p) => /Contoh Uji Sintetis/i.test(p)));
  assert.ok(leakedProblems.some((p) => /Laporan disampaikan untuk ditinjau pimpinan/i.test(p)));
});

test('digital product splitter and PDF generator exclude all seller metadata and internal watermarks', () => {
  const rawWithLegacyLeaks = [
    buildComplete30CaptionProduct(),
    'Contoh Uji Sintetis: RAHASIA_CONTOH_SINTETIS_JANGAN_CETAK',
    'Batasan dan Hal yang Perlu Diverifikasi: RAHASIA_BATASAN_INTERNAL_JANGAN_CETAK',
  ].join('\n').replace(
    '## Bab 1: 30 Caption Lengkap Siap Pakai',
    'Laporan disampaikan untuk ditinjau pimpinan.\nTinjau dan sesuaikan sebelum dijual.\n## Bab 1: 30 Caption Lengkap Siap Pakai',
  );

  const parsed = splitDigitalProductPackage(rawWithLegacyLeaks, 'MVP produk digital · 30 Caption UMKM');
  assert.equal(parsed.hasSellerMetadata, true);
  assert.match(parsed.seller.listingDescription, /Paket PDF berisi 30 caption lengkap/);
  assert.match(parsed.seller.suggestedPrice, /Rp29\.000/);
  assert.match(parsed.seller.verificationNotes, /unggah manual ke halaman Lynk\.id/);
  assert.equal(parsed.buyer.chapters.length, 3);
  assert.doesNotMatch(parsed.buyer.mainContent, /Laporan disampaikan untuk ditinjau pimpinan/i);
  assert.doesNotMatch(parsed.buyer.mainContent, /Tinjau dan sesuaikan sebelum dijual/i);
  assert.doesNotMatch(parsed.buyer.mainContent, /RAHASIA_CONTOH_SINTETIS_JANGAN_CETAK/);

  const { pdf, filename } = createDigitalProductPdf('MVP produk digital · 30 Caption Siap Pakai & Kalender Konten UMKM Kuliner', rawWithLegacyLeaks);
  const rawPdfText = new TextDecoder().decode(new Uint8Array(pdf.output('arraybuffer')));

  assert.equal(filename, '30-caption-siap-pakai-kalender-konten-umkm-kuliner.pdf');
  assert.ok(pdf.internal.pages.length >= 4, 'PDF should include cover, intro/TOC, and structured chapter pages');

  // Buyer content MUST be present in PDF
  assert.match(rawPdfText, /30 Caption Siap Pakai/);
  assert.match(rawPdfText, /Caption UMKM Hari 1:/);
  assert.match(rawPdfText, /Caption UMKM Hari 30:/);
  assert.match(rawPdfText, /Grid Kalender Konten Mingguan/);
  assert.match(rawPdfText, /Prompt 1:/);

  // Seller metadata & internal office strings MUST NEVER appear in PDF
  assert.doesNotMatch(rawPdfText, /Deskripsi Listing Lynk\.id/i);
  assert.doesNotMatch(rawPdfText, /Saran Harga/i);
  assert.doesNotMatch(rawPdfText, /Rp29\.000/);
  assert.doesNotMatch(rawPdfText, /Batasan dan Catatan Verifikasi/i);
  assert.doesNotMatch(rawPdfText, /Batasan dan Hal yang Perlu Diverifikasi/i);
  assert.doesNotMatch(rawPdfText, /Contoh Uji Sintetis/i);
  assert.doesNotMatch(rawPdfText, /RAHASIA_CONTOH_SINTETIS_JANGAN_CETAK/);
  assert.doesNotMatch(rawPdfText, /RAHASIA_BATASAN_INTERNAL_JANGAN_CETAK/);
  assert.doesNotMatch(rawPdfText, /Laporan disampaikan untuk ditinjau pimpinan/i);
  assert.doesNotMatch(rawPdfText, /Tinjau dan sesuaikan sebelum dijual/i);
  assert.doesNotMatch(rawPdfText, /Draf produk digital untuk ditinjau/i);
});
