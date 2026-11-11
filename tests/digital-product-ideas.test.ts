import test from 'node:test';
import assert from 'node:assert/strict';
import { digitalProductIdeaJobId, extractDigitalProductIdeas } from '../src/lib/digitalProductIdeas';

test('digital product research concepts can be selected independently from their report', () => {
  const content = [
    'Ringkasan peluang.',
    '## IDE PRODUK 1: Workbook UMKM',
    'Kelompok pengguna: Pemilik usaha kecil.',
    'Format: Workbook.',
    '## IDE PRODUK 2: Kit Konten Kreator',
    'Kelompok pengguna: Kreator mandiri.',
    'Format: Kit konten.',
    '## Daftar Sumber Rujukan',
    '1. Sumber A: https://example.org/a',
  ].join('\n');
  const ideas = extractDigitalProductIdeas(content);
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].title, 'Workbook UMKM');
  assert.match(ideas[0].content, /Kelompok pengguna: Pemilik usaha kecil/);
  assert.doesNotMatch(ideas[0].content, /Kit Konten Kreator/);
  assert.doesNotMatch(ideas[1].content, /Daftar Sumber Rujukan/);
  assert.notEqual(digitalProductIdeaJobId('draft-1', ideas[0].key), digitalProductIdeaJobId('draft-1', ideas[1].key));
});

test('old research reports without structured concept headings require manual selection', () => {
  assert.deepEqual(extractDigitalProductIdeas('Ide 1: Workbook UMKM\nKonten lama tanpa judul terstruktur.'), []);
});
