import { useEffect, useState, type FormEvent } from 'react';
import type { OfficeJob, WorkDraft } from '../workflowTypes';

type Product = 'paud' | 'posyandu' | 'other';
type ResearchProduct = 'paud' | 'posyandu' | 'opportunities';
type Transaction = { id: string; product: Product; kind: 'INCOME' | 'EXPENSE'; amount: number; date: string; note: string; voidedAt: string | null };
const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white';
const button = 'min-h-11 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50';
const rupiah = (value: bigint) => `Rp${new Intl.NumberFormat('id-ID').format(value)}`;

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/business${path}`, {
    method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Kesalahan server (${response.status}).`);
  return data as T;
}

export function BusinessCenter({ onDraft, jobs, onRetry }: { onDraft: (draft: WorkDraft) => void; jobs: OfficeJob[] | null; onRetry: (id: string) => void }) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [product, setProduct] = useState<Product>('paud');
  const [kind, setKind] = useState<Transaction['kind']>('INCOME');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState<boolean | null>(null);

  async function load() {
    const data = await request<{ transactions: Transaction[] }>('/transactions');
    setTransactions(data.transactions);
  }
  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Transaksi tidak tersedia.'));
    void request<{ enabled: boolean }>('/schedule').then((data) => setSchedule(data.enabled)).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Status jadwal tidak tersedia.'));
  }, []);

  async function research(target: ResearchProduct) {
    setBusy(true); setError('');
    try {
      const { draft } = await request<{ draft: WorkDraft }>('/research', { product: target });
      onDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riset gagal.');
    } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await request('/transactions', { product, kind, amount: Number(amount), date, note });
      setAmount(''); setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaksi gagal disimpan.');
    } finally { setBusy(false); }
  }
  async function voidTransaction(id: string) {
    if (!window.confirm('Batalkan transaksi ini? Riwayat tetap tersimpan, tetapi nominal tidak lagi dihitung.')) return;
    setBusy(true); setError('');
    try {
      await request(`/transactions/${encodeURIComponent(id)}/void`, {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaksi gagal dibatalkan.');
    } finally { setBusy(false); }
  }

  return <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
    <h2 className="text-xl font-bold">Peluang Produk &amp; Keuangan</h2>
    {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    <div className="space-y-3 rounded-lg border border-slate-700 p-4">
      <h3 className="font-bold">Riset peluang produk</h3>
      <p className="text-sm text-slate-300">Jadwal mingguan: {schedule === null ? 'status tidak tersedia' : schedule ? 'aktif' : 'nonaktif'}. Setiap Senin setelah 06.00 WIB, atau saat server pertama aktif dalam minggu itu, sistem mengantrekan satu riset peluang aplikasi baru. Jika riset berhasil, lima divisi menyiapkan masing-masing satu draf secara otomatis.</p>
      <p className="text-sm text-amber-300">Satu siklus menggunakan satu permintaan OpenRouter dengan pencarian web dan hingga lima permintaan AI lanjutan. Biaya dapat timbul meskipun gagal. Kunci harus dibatasi maksimal US$5 per bulan di OpenRouter; periksa harga dan penggunaan. Nonaktifkan jadwal melalui konfigurasi dan mulai ulang server.</p>
      <p className="text-sm text-slate-300">Tombol di bawah menjalankan riset tambahan secara langsung dan tidak memulai alur lima divisi.</p>
      <p className="text-sm text-amber-300">Hasil dan sumber harus diverifikasi. Persetujuan hanya menyetujui ide, bukan menghubungi pelanggan, mengubah kode, atau mempublikasikan konten.</p>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void research('paud')}>Riset Siput PAUD</button>
        <button className={button} disabled={busy} onClick={() => void research('posyandu')}>Riset Siput Posyandu</button>
        <button className={button} disabled={busy} onClick={() => void research('opportunities')}>Riset ide aplikasi baru</button>
      </div>
      <h4 className="font-bold">Antrean siklus mingguan</h4>
      {jobs === null ? <p className="text-sm text-amber-300">Status antrean tidak tersedia.</p> : jobs.filter((job) => job.id.startsWith('weekly-research-')).length === 0 ? <p className="text-sm text-slate-400">Belum ada tugas siklus mingguan.</p> : <div className="space-y-2">{jobs.filter((job) => job.id.startsWith('weekly-research-')).map((job) => <div key={job.id} className="rounded-lg bg-slate-950 p-3 text-sm">
        <strong>{job.title}</strong> · {job.status === 'QUEUED' ? 'Antre' : job.status === 'RUNNING' ? 'Diproses' : job.status === 'DONE' ? 'Selesai' : 'Gagal'}
        {job.error && <p className="text-amber-300">{job.error}</p>}
        {job.status === 'FAILED' && <button className="mt-1 underline" type="button" onClick={() => onRetry(job.id)}>Coba lagi (mungkin berbiaya)</button>}
      </div>)}</div>}
    </div>
    <div className="space-y-3 rounded-lg border border-slate-700 p-4">
      <h3 className="font-bold">Catatan transaksi nyata</h3>
      <p className="text-sm text-slate-300">Catat hanya transaksi yang benar-benar terjadi. Data disimpan dalam database aplikasi, tidak dikirim untuk riset AI. Jangan masukkan nama pelanggan, nomor rekening, atau data pribadi. Ringkasan ini bukan laporan akuntansi atau bukti pembayaran.</p>
      {transactions === null ? <p className="text-sm text-slate-400">Data belum tersedia.</p> : <div className="grid gap-3 sm:grid-cols-2">
        {(['paud', 'posyandu', 'other'] as const).map((item) => {
          const income = transactions.filter((t) => t.product === item && t.kind === 'INCOME' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
          const expense = transactions.filter((t) => t.product === item && t.kind === 'EXPENSE' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
          return <div key={item} className="rounded-lg bg-slate-950 p-3 text-sm">
            <h4 className="font-bold">{item === 'paud' ? 'Siput PAUD' : item === 'posyandu' ? 'Siput Posyandu' : 'Aplikasi lain'}</h4>
            <p>Pemasukan: {rupiah(income)}</p><p>Pengeluaran: {rupiah(expense)}</p><p>Selisih: {rupiah(income - expense)}</p>
          </div>;
        })}
      </div>}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
        <label>Produk<select className={field} value={product} onChange={(e) => setProduct(e.target.value as Product)}><option value="paud">Siput PAUD</option><option value="posyandu">Siput Posyandu</option><option value="other">Aplikasi lain</option></select></label>
        <label>Jenis<select className={field} value={kind} onChange={(e) => setKind(e.target.value as Transaction['kind'])}><option value="INCOME">Pemasukan</option><option value="EXPENSE">Pengeluaran</option></select></label>
        <label>Nominal rupiah<input className={field} type="number" min="1" max="2147483647" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Tanggal transaksi<input className={field} type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="sm:col-span-2">Catatan tanpa data pribadi<input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button className={button} disabled={busy}>Simpan transaksi</button>
      </form>
      <p className="text-xs text-slate-400">Untuk koreksi, batalkan transaksi yang salah lalu catat transaksi yang benar. Riwayat pembatalan tetap tersimpan.</p>
      {transactions && <div className="space-y-2"><h4 className="font-bold">Riwayat transaksi</h4>
        {transactions.length === 0 && <p className="text-sm text-slate-400">Belum ada transaksi yang dicatat.</p>}
        {transactions.map((t) => <div key={t.id} className="rounded-lg bg-slate-950 p-3 text-sm">{t.date} · {t.product === 'paud' ? 'Siput PAUD' : t.product === 'posyandu' ? 'Siput Posyandu' : 'Aplikasi lain'} · {t.kind === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} · {rupiah(BigInt(t.amount))}{t.note && ` · ${t.note}`} {t.voidedAt ? '· Dibatalkan' : <button type="button" className="ml-2 underline" disabled={busy} onClick={() => void voidTransaction(t.id)}>Batalkan transaksi</button>}</div>)}
      </div>}
    </div>
  </section>;
}
