import { useState } from 'react';
import { createCapCutExport } from '../lib/capcutExport';

const button = 'min-h-11 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-800 shadow-sm transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50';

export function CapCutExportActions({ title, content }: { title: string; content: string }) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function copyScript() {
    setError('');
    setNotice('');
    try {
      await navigator.clipboard.writeText(createCapCutExport(title, content).script);
      setNotice('Naskah voiceover per scene disalin. Gunakan di timeline editor biasa; tidak perlu Script to Video.');
    } catch (cause) {
      setError(cause instanceof Error ? `Gagal menyalin naskah: ${cause.message}` : 'Gagal menyalin naskah. Izinkan akses clipboard lalu coba lagi.');
    }
  }

  function downloadJson() {
    setError('');
    setNotice('');
    try {
      const result = createCapCutExport(title, content);
      const blob = new Blob([`${JSON.stringify(result.json, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice('Panduan edit JSON berhasil diunduh. Ini bukan file proyek CapCut; gunakan sebagai referensi timeline manual.');
    } catch (cause) {
      setError(cause instanceof Error ? `Gagal membuat JSON: ${cause.message}` : 'Gagal membuat file JSON.');
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4" aria-label="Panduan edit video">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={downloadJson}>Unduh Panduan Edit / JSON</button>
        <button type="button" className={button} onClick={() => void copyScript()}>Copy All Script</button>
      </div>
      <p className="text-xs leading-relaxed text-slate-600">Tidak perlu CapCut Pro: rakit manual di timeline biasa memakai rekaman sendiri, potongan sederhana, teks dasar, dan voiceover. Hindari Script to Video serta aset/fitur berlabel Pro; ganti dengan opsi dasar bila diminta upgrade. File JSON hanya panduan edit, bukan file proyek CapCut. Timing subtitle hanya perkiraan 150 kata/menit—sesuaikan dengan audio.</p>
      {notice && <p role="status" className="text-xs font-medium text-teal-700">{notice}</p>}
      {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
    </section>
  );
}
