import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingBriefInstruction, type MarketingBrief } from '../src/lib/marketingBrief';

const brief: MarketingBrief = {
  product: 'Siput PAUD',
  audience: 'Pengelola PAUD',
  verifiedFeatures: 'Rekap kehadiran',
  unavailableFeatures: 'Pembayaran online belum tersedia',
  priceAndLink: '',
  channels: 'Instagram',
};

test('marketing brief includes owner facts, asks for usable content, and marks missing details', () => {
  const instruction = marketingBriefInstruction(brief);
  assert.match(instruction, /Target pengguna\/pembeli: Pengelola PAUD/);
  assert.match(instruction, /Fitur yang sudah dikonfirmasi pemilik: Rekap kehadiran/);
  assert.match(instruction, /Harga dan tautan resmi: \[PERLU KONFIRMASI\]/);
  assert.match(instruction, /3 ide konten beserta caption dan hashtag/);
  assert.match(instruction, /Jangan mengarang fitur, harga, tautan, testimoni/);
});
