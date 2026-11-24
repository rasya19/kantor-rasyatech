import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfficeScene } from '../src/components/OfficeScene';
import type { OfficeJob } from '../src/workflowTypes';

const now = '2026-11-08T03:00:00.000Z';
const job = (staffId: string, status: OfficeJob['status']): OfficeJob => ({
  id: staffId, division: 'creator', staffId, title: 'Tugas uji', status,
  ticketId: null, draftId: null, error: null, createdAt: now, updatedAt: now,
});
const render = (jobs: OfficeJob[] | null, initialSelectedStaffId?: string) => renderToStaticMarkup(createElement(OfficeScene, {
  jobs, drafts: [], initialSelectedStaffId, onAssign: () => {}, onRetry: () => {}, onDraft: () => {},
}));

test('3D office roster reflects each core room staff member queue status', () => {
  const html = render([job('strategist', 'RUNNING'), job('script_ai', 'QUEUED'), job('arka', 'FAILED')]);
  assert.match(html, /Strategi Konten<\/span><small>Bekerja<\/small>/);
  assert.match(html, /Script-AI<\/span><small>1 antre<\/small>/);
  assert.match(html, /Produk &amp; Riset · 2 staf/);
  assert.doesNotMatch(html, /Arka<\/span>/);
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
  assert.match(html, /Strategi Konten<\/span><small>Tidak diketahui<\/small>/);
  assert.match(html, /Status antrean tidak tersedia/);
  assert.doesNotMatch(html, /office-person-working/);
});

test('recently completed core staff work is marked as a simulated report delivery', () => {
  const completed: OfficeJob = { ...job('strategist', 'DONE'), division: 'creator', draftId: 'draft-1', updatedAt: new Date().toISOString() };
  const html = render([completed], 'strategist');
  assert.match(html, /Strategi Konten<\/span><small>Mengantar laporan \(simulasi\)<\/small>/);
  assert.match(html, /simulasi visual, bukan tindakan manusia/);
});

test('denah restores the selected staff member after returning from mandate', () => {
  const html = render([], 'clipper');
  assert.match(html, /Konten &amp; Penjualan · 2 staf/);
  assert.match(html, /aria-pressed="true" class="office-map-control-selected">Konten &amp; Penjualan/);
  assert.match(html, /aria-pressed="true" class="office-3d-roster-person office-3d-roster-selected"><span class="office-legend-dot office-legend-idle"><\/span><span>Clipper<\/span>/);
  assert.doesNotMatch(html, /Strategi Konten<\/span>/);
  assert.match(html, /<h4 class="font-bold">Clipper/);
});

test('client service room displays Arka and Dr. AI with live statuses', () => {
  const html = render([{ ...job('arka', 'FAILED'), division: 'paud' }], 'arka');
  assert.match(html, /Layanan Klien · 2 staf/);
  assert.match(html, /aria-pressed="true" class="office-map-control-selected">Layanan Klien/);
  assert.match(html, /Arka<\/span><small>Tugas gagal<\/small>/);
  assert.match(html, /Dr\. AI<\/span><small>Siaga<\/small>/);
});

test('marketing manager keeps distribution duties inside Content & Sales room', () => {
  const marketing = render([], 'marketing_manager');
  assert.match(marketing, /Konten &amp; Penjualan · 2 staf/);
  assert.match(marketing, /Manajer Pemasaran/);
  assert.match(marketing, /Menyiapkan draf listing, caption, hashtag/);
  assert.match(marketing, /belum memublikasikan, mengaktifkan tautan/);
  assert.doesNotMatch(marketing, /Strategi Konten<\/span>/);
});
