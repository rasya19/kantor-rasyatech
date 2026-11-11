import { useState } from 'react';
import { createDigitalProductPdf } from '../lib/digitalProductPdf';

const button = 'min-h-11 rounded-lg border border-teal-700 px-4 py-2 text-sm font-bold text-teal-100 hover:bg-teal-950 disabled:opacity-50';

export function DigitalProductDownload({ title, content }: { title: string; content: string }) {
  const [error, setError] = useState('');
  return <section className="space-y-2 rounded-lg border border-teal-900 bg-slate-950 p-3" aria-label="Berkas produk digital">
    <p className="text-sm font-semibold text-teal-200">Paket produk digital</p>
    <p className="text-xs text-slate-400">Unduh PDF untuk ditinjau dan diunggah manual ke Lynk.id. Belum ada upload otomatis atau koneksi akun Lynk.</p>
    <button type="button" className={button} onClick={() => {
      setError('');
      try {
        const result = createDigitalProductPdf(title, content);
        result.pdf.save(result.filename);
      } catch (cause) {
        setError(cause instanceof Error ? `PDF gagal dibuat: ${cause.message}` : 'PDF gagal dibuat.');
      }
    }}>Unduh produk PDF</button>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </section>;
}
