import { useState } from 'react';
import { createDigitalProductPdf } from '../lib/digitalProductPdf';

const button = 'min-h-11 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-bold text-teal-800 shadow-sm transition hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50';

export function DigitalProductDownload({ title, content }: { title: string; content: string }) {
  const [error, setError] = useState('');
  return (
    <section className="space-y-2.5 rounded-2xl border border-teal-200 bg-teal-50/60 p-4" aria-label="Berkas produk digital">
      <p className="text-sm font-bold text-teal-900">Paket produk digital</p>
      <p className="text-xs leading-relaxed text-slate-600">Unduh PDF untuk ditinjau dan diunggah manual ke Lynk.id. Belum ada upload otomatis atau koneksi akun Lynk.</p>
      <button
        type="button"
        className={button}
        onClick={() => {
          setError('');
          try {
            const result = createDigitalProductPdf(title, content);
            result.pdf.save(result.filename);
          } catch (cause) {
            setError(cause instanceof Error ? `PDF gagal dibuat: ${cause.message}` : 'PDF gagal dibuat.');
          }
        }}
      >
        Unduh produk PDF
      </button>
      {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
    </section>
  );
}
