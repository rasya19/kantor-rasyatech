import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfficeScene } from '../src/components/OfficeScene';
import type { OfficeJob } from '../src/workflowTypes';

const now = '2026-11-08T03:00:00.000Z';
const job = (staffId: string, status: OfficeJob['status']): OfficeJob => ({
  id: staffId, division: 'paud', staffId, title: 'Tugas uji', status,
  ticketId: null, draftId: null, error: null, createdAt: now, updatedAt: now,
});
const render = (jobs: OfficeJob[] | null, initialSelectedStaffId?: string) => renderToStaticMarkup(createElement(OfficeScene, {
  jobs, drafts: [], initialSelectedStaffId, onAssign: () => {}, onRetry: () => {}, onDraft: () => {},
}));

test('3D office roster reflects each staff member queue status, including completion', () => {
  const html = render([job('arka', 'RUNNING'), job('lisa', 'QUEUED'), job('dewi', 'FAILED'), job('budi', 'DONE')]);
  assert.match(html, /Arka<\/span><small>Bekerja<\/small>/);
  assert.match(html, /Lisa<\/span><small>1 antre<\/small>/);
  assert.match(html, /Dewi<\/span><small>Tugas gagal<\/small>/);
  assert.match(html, /Mitra PAUD<\/span><small>Siaga<\/small>/);
  assert.match(html, /Siput PAUD · 4 staf/);
  assert.doesNotMatch(html, /Strategi Konten<\/span>/);
  assert.match(html, /Kampus kantor virtual 3D/);
  assert.match(html, /Mushola/);
  assert.match(html, /Kolam renang/);
  assert.match(html, /Dapur &amp; pantry/);
  assert.match(html, /Toilet/);
  assert.match(html, /Avatar AI bergaya manusia berjalan ke meja/);
  assert.match(html, /gestur presentasi/);
  assert.match(html, /Ekspresi serta percakapan adalah simulasi visual/);
  assert.match(html, /Meja, kursi, serta bangunan tetap di tempat/);
});

test('unavailable queue does not portray staff as active or idle', () => {
  const html = render(null);
  assert.match(html, /Arka<\/span><small>Tidak diketahui<\/small>/);
  assert.match(html, /Status antrean tidak tersedia/);
  assert.doesNotMatch(html, /office-person-working/);
});

test('recently completed creator work is marked as a simulated report delivery', () => {
  const completed: OfficeJob = { ...job('strategist', 'DONE'), division: 'creator', draftId: 'draft-1', updatedAt: new Date().toISOString() };
  const html = render([completed], 'strategist');
  assert.match(html, /Strategi Konten<\/span><small>Mengantar laporan \(simulasi\)<\/small>/);
  assert.match(html, /simulasi visual, bukan tindakan manusia/);
});

test('denah restores the selected staff member after returning from mandate', () => {
  const html = render([], 'clipper');
  assert.match(html, /Content Creator · 4 staf/);
  assert.match(html, /aria-pressed="true" class="office-map-control-selected">Content Creator/);
  assert.match(html, /aria-pressed="true" class="office-3d-roster-person office-3d-roster-selected"><span class="office-legend-dot office-legend-idle"><\/span><span>Clipper<\/span>/);
  assert.doesNotMatch(html, /Arka<\/span>/);
  assert.match(html, /<h4 class="font-bold">Clipper/);
});

test('selecting a division opens its own highlighted roster', () => {
  const html = render([], 'audit');
  assert.match(html, /Cyber Security · 3 staf/);
  assert.match(html, /aria-pressed="true" class="office-map-control-selected">Cyber Security/);
  assert.match(html, /Sentinel/);
  assert.match(html, /Guard-AI/);
  assert.match(html, /Audit/);
  assert.doesNotMatch(html, /Arka<\/span>/);
});

test('finance and marketing managers have operational rooms, duties, and separate staff filters', () => {
  const finance = render([], 'finance_manager');
  assert.match(finance, /Financial &amp; Reporting · 1 staf/);
  assert.match(finance, /Manajer Keuangan &amp; Pelaporan · Delegasi Tepercaya Pimpinan/);
  assert.match(finance, /Menyusun rekap harian, mingguan, dan bulanan/);
  assert.match(finance, /angka transaksi tidak dikirim ke AI/);
  assert.doesNotMatch(finance, /Manajer Pemasaran<\/span>/);

  const marketing = render([], 'marketing_manager');
  assert.match(marketing, /Digital Marketing &amp; Distribution · 1 staf/);
  assert.match(marketing, /Manajer Pemasaran &amp; Distribusi Digital · Delegasi Tepercaya Pimpinan/);
  assert.match(marketing, /Menyiapkan draf listing, caption, hashtag/);
  assert.match(marketing, /belum memublikasikan, mengaktifkan tautan/);
  assert.doesNotMatch(marketing, /Manajer Keuangan<\/span>/);
});
