import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentPackageInstruction, contentPackageProblems } from '../server/services/contentPackage';

const complete = `Judul Tren: Ide PAUD
Konsep: Edukasi
Hook 3 Detik: Pertanyaan
Naskah Narasi: Narasi sintetis
Caption: Caption #edukasi
Target Platform: TikTok, Reels, Shorts
Tata Letak Visual: Template 9:16
Hal yang Perlu Diverifikasi: Fitur produk`;

test('content package requires all non-empty sections and a supported platform', () => {
  assert.deepEqual(contentPackageProblems(complete), []);
  assert.deepEqual(contentPackageProblems(complete.replace('Caption: Caption #edukasi', 'Caption:')), ['Caption']);
  assert.deepEqual(contentPackageProblems(complete.replace('TikTok, Reels, Shorts', 'Blog')), ['Target Platform (TikTok, Reels, atau Shorts)']);
  assert.ok(contentPackageProblems('Paket singkat').includes('Judul Tren'));
  assert.deepEqual(contentPackageProblems(complete.replace('Judul Tren:', '## **Judul Tren:**')), []);
  assert.ok(contentPackageProblems(complete.replace('Naskah Narasi: Narasi sintetis', 'Naskah Narasi: Beli sekarang, link di bio')).includes('Ajakan pembelian tanpa tautan resmi yang diberikan'));
  assert.deepEqual(contentPackageProblems(complete.replace('Naskah Narasi: Narasi sintetis', 'Naskah Narasi: Beli sekarang di https://example.org')), []);
  assert.match(contentPackageInstruction, /Jangan menyuruh audiens membeli.*link di bio kecuali tautan\/cara pemesanan resmi/i);
});
