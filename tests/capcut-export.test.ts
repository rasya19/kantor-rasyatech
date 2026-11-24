import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCapCutExport } from '../src/lib/capcutExport';
import { CapCutExportActions } from '../src/components/CapCutExportActions';

const content = `Judul Tren: Ide edukasi
Konsep: Video edukatif pendek.
Hook 3 Detik: Pernah bingung mencatat kegiatan hari ini?
Naskah Narasi:
Scene 1: Pernah bingung mencatat kegiatan hari ini?
Scene 2: Catat kegiatan secara teratur. Simpan ringkasannya agar mudah ditinjau.
Caption: Catatan sederhana, aktivitas lebih tertata. #edukasi
Target Platform: TikTok, Reels, Shorts
Tata Letak Visual:
Scene 1: Close-up buku catatan, cahaya pagi, vertikal 9:16.
Scene 2: Tangan merapikan catatan di meja, vertikal 9:16.
Hal yang Perlu Diverifikasi: Verifikasi fitur sebelum membuat klaim.`;

test('CapCut export maps scene voiceover, visual prompts and estimated subtitle timings', () => {
  const result = createCapCutExport('Ide Konten: Edukasi', content);
  assert.equal(result.json.format, 'manual-video-editing-guide-v1');
  assert.equal(result.json.scenes.length, 2);
  assert.equal(result.json.scenes[0].voiceoverText, 'Pernah bingung mencatat kegiatan hari ini?');
  assert.equal(result.json.scenes[0].visualPrompt, 'Close-up buku catatan, cahaya pagi, vertikal 9:16.');
  assert.equal(result.json.scenes[0].startSeconds, 0);
  assert.ok(result.json.scenes[0].endSeconds > 0);
  assert.equal(result.json.scenes[1].startSeconds, result.json.scenes[0].endSeconds);
  assert.equal(result.json.scenes[1].timing, 'estimated');
  assert.equal(result.json.captionSubtitleTimings.length, 2);
  assert.match(result.json.captionTimingNote, /bukan timing audio/);
  assert.equal(result.script, 'Pernah bingung mencatat kegiatan hari ini?\n\nCatat kegiatan secara teratur. Simpan ringkasannya agar mudah ditinjau.');
  assert.equal(result.filename, 'ide-konten-edukasi.json');
});

test('CapCut export uses hook when narration omits it and supports unmarked narration', () => {
  const result = createCapCutExport('Konten', content
    .replace(/Scene 1: Pernah bingung mencatat kegiatan hari ini\?\r?\n/, '')
    .replace(/Scene 2: Catat kegiatan secara teratur\. Simpan ringkasannya agar mudah ditinjau\./, 'Mulai dengan satu catatan singkat. Lanjutkan setiap hari.'));
  assert.equal(result.json.scenes.length, 2);
  assert.equal(result.json.scenes[0].voiceoverText, 'Pernah bingung mencatat kegiatan hari ini?');
  assert.match(result.script, /Mulai dengan satu catatan singkat/);
});

test('creator result actions describe free manual editing, JSON guide, and script controls', () => {
  const html = renderToStaticMarkup(createElement(CapCutExportActions, { title: 'Konten', content }));
  assert.match(html, /Unduh Panduan Edit \/ JSON/);
  assert.match(html, /Copy All Script/);
  assert.match(html, /150 kata\/menit/);
  assert.match(html, /Tidak perlu CapCut Pro/);
  assert.match(html, /bukan file proyek CapCut/);
});

test('CapCut export rejects packages without voiceover text', () => {
  assert.throws(() => createCapCutExport('Kosong', 'Caption: tanpa narasi'), /tidak berisi hook atau naskah narasi/);
});

test('CapCut export parses numbered and bulleted markdown section headings', () => {
  const numbered = [
    '1. **Judul Tren:** Ide warung',
    '2. **Konsep:** Edukasi',
    '- **Hook 3 Detik:** Pernah uang dagang tercampur?',
    '4. **Naskah Narasi:**',
    'Scene 1: Pernah uang dagang tercampur? Mulai catat kas harian sekarang.',
    '5. **Caption:** Yuk rapi #umkm',
    '6. **Target Platform:** TikTok, Reels, Shorts',
    '7. **Tata Letak Visual:**',
    'Scene 1: Rekaman layar tabel kas 9:16.',
    '8. **Hal yang Perlu Diverifikasi:** Harga promo.',
  ].join('\n');
  const result = createCapCutExport('Warung', numbered);
  assert.equal(result.json.scenes.length, 1);
  assert.equal(result.json.scenes[0].voiceoverText, 'Pernah uang dagang tercampur? Mulai catat kas harian sekarang.');
  assert.equal(result.json.scenes[0].visualPrompt, 'Rekaman layar tabel kas 9:16.');
});
