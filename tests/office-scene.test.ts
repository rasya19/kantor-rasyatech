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
const render = (jobs: OfficeJob[] | null) => renderToStaticMarkup(createElement(OfficeScene, {
  jobs, drafts: [], onAssign: () => {}, onRetry: () => {}, onDraft: () => {},
}));

test('office characters reflect only their queue status', () => {
  const html = render([job('arka', 'RUNNING'), job('lisa', 'QUEUED'), job('dewi', 'FAILED')]);
  assert.match(html, /aria-label="Arka, Bekerja"/);
  assert.match(html, /aria-label="Lisa, 1 antre"/);
  assert.match(html, /aria-label="Dewi, Tugas gagal"/);
  assert.match(html, /aria-label="Audit, Siaga"/);
  assert.equal((html.match(/office-person office-person-working/g) ?? []).length, 1);
  assert.equal((html.match(/class="office-workstation /g) ?? []).length, 15);
});

test('unavailable queue does not portray staff as active or idle', () => {
  const html = render(null);
  assert.match(html, /aria-label="Arka, Tidak diketahui"/);
  assert.match(html, /Status antrean tidak tersedia/);
  assert.doesNotMatch(html, /office-person-working/);
});
