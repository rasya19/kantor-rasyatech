import { useMemo, useState } from 'react';
import { Check, Copy, Download, EyeOff, FileText, ShieldAlert, Tag } from 'lucide-react';
import { createDigitalProductPdf } from '../lib/digitalProductPdf';
import { splitDigitalProductPackage } from '../lib/digitalProductContent';

const downloadButton = 'inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-teal-900/10 transition hover:bg-teal-700 disabled:opacity-50';
const copyButton = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50';

export function DigitalProductDownload({ title, content }: { title: string; content: string }) {
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<'listing' | 'price' | null>(null);

  const parsed = useMemo(() => splitDigitalProductPackage(content, title), [content, title]);
  const chapterCount = parsed.buyer.chapters.filter((ch) => ch.heading.trim().length > 0).length;

  const copyText = async (value: string, key: 'listing' | 'price') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch {
      setError('Gagal menyalin teks ke clipboard.');
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 sm:p-5" aria-label="Berkas produk digital">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-teal-800">
              <FileText size={14} /> File PDF Produk Pembeli (Siap Jual Lynk.id)
            </div>
            <p className="text-base font-extrabold text-slate-900">{parsed.buyer.title}</p>
            <p className="text-xs leading-relaxed text-slate-600">
              PDF ini hanya mencetak cover produk, pengantar, cara pakai, dan isi produk lengkap untuk pembeli. Metadata seller, saran harga, dan catatan verifikasi otomatis dipisahkan dan tidak pernah masuk ke file PDF.
            </p>
          </div>
          <button
            type="button"
            className={downloadButton}
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
            <Download size={16} />
            Unduh produk PDF
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-teal-900">
          {parsed.buyer.productType && (
            <span className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 font-semibold">
              Jenis: {parsed.buyer.productType}
            </span>
          )}
          {chapterCount > 0 && (
            <span className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 font-semibold">
              {chapterCount} bagian/bab rapi
            </span>
          )}
          <span className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 font-semibold">
            Tanpa watermark draf internal
          </span>
        </div>

        {error && <p role="alert" className="text-xs font-medium text-rose-700">{error}</p>}
      </section>

      {parsed.hasSellerMetadata && (
        <section
          className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5"
          aria-label="Metadata dan Listing Seller"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-amber-950">Metadata &amp; Listing Seller</h3>
              <p className="text-xs text-amber-900/80">
                Khusus tampilan panel pratinjau aplikasi untuk keperluan unggah manual ke Lynk.id.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-900">
              <EyeOff size={13} /> Tidak dicetak ke PDF
            </span>
          </div>

          {parsed.seller.listingDescription && (
            <div className="space-y-1.5 rounded-xl border border-amber-200/80 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  Deskripsi Listing Lynk.id
                </p>
                <button
                  type="button"
                  className={copyButton}
                  onClick={() => void copyText(parsed.seller.listingDescription, 'listing')}
                >
                  {copiedKey === 'listing' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copiedKey === 'listing' ? 'Tersalin' : 'Salin listing'}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {parsed.seller.listingDescription}
              </p>
            </div>
          )}

          {parsed.seller.suggestedPrice && (
            <div className="space-y-1.5 rounded-xl border border-amber-200/80 bg-white p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-700">
                  <Tag size={13} className="text-teal-700" /> Saran Harga
                </p>
                <button
                  type="button"
                  className={copyButton}
                  onClick={() => void copyText(parsed.seller.suggestedPrice, 'price')}
                >
                  {copiedKey === 'price' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copiedKey === 'price' ? 'Tersalin' : 'Salin'}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {parsed.seller.suggestedPrice}
              </p>
            </div>
          )}

          {parsed.seller.verificationNotes && (
            <div className="space-y-1.5 rounded-xl border border-amber-200/80 bg-white p-3.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-900">
                <ShieldAlert size={13} className="text-amber-700" /> Batasan &amp; Catatan Verifikasi
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {parsed.seller.verificationNotes}
              </p>
            </div>
          )}

          {parsed.seller.extraNotes && (
            <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white/80 p-3.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                Catatan Internal Tambahan
              </p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                {parsed.seller.extraNotes}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
