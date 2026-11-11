import { useEffect, useState, type FormEvent } from 'react';
import type { OfficeJob, WorkDraft } from '../workflowTypes';
import { ExecutiveRevenueReport } from './ExecutiveRevenueReport';

type Product = 'paud' | 'posyandu' | 'scanbite' | 'konter' | 'lorisan' | 'digital' | 'other';
type ResearchProduct = 'paud' | 'posyandu' | 'opportunities';
type Transaction = { id: string; product: Product; kind: 'INCOME' | 'EXPENSE' | 'ESTIMATE'; amount: number; date: string; note: string; voidedAt: string | null };
const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white';
const button = 'min-h-11 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50';
const rupiah = (value: bigint) => `Rp${new Intl.NumberFormat('id-ID').format(value)}`;
const productName = (product: Product) => ({
  paud: 'Siput PAUD',
  posyandu: 'Siput Posyandu',
  scanbite: 'ScanBite',
  konter: 'Konter +62',
  lorisan: 'Lorisan Warung',
  digital: 'Produk digital (portofolio)',
  other: 'Aplikasi lain',
}[product]);

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

export function BusinessCenter({ onDraft, jobs, onRetry, onDismissSprint, onStartSprintJob, onStartDailyProductJob }: {
  onDraft: (draft: WorkDraft) => void;
  jobs: OfficeJob[] | null;
  onRetry: (id: string) => Promise<void>;
  onDismissSprint: (id: string) => Promise<void>;
  onStartSprintJob: (id: string) => Promise<void>;
  onStartDailyProductJob: (id: string) => Promise<void>;
}) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [product, setProduct] = useState<Product>('digital');
  const [kind, setKind] = useState<Transaction['kind']>('INCOME');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState<boolean | null>(null);
  const [executiveReportOpen, setExecutiveReportOpen] = useState(false);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);
  const [pendingSprintJobId, setPendingSprintJobId] = useState('');
  const dailyProductJobs = jobs?.filter((job) => job.id.startsWith('daily-digital-product-')) ?? [];
  const sprintJobs = jobs?.filter((job) => job.id.startsWith('weekly-research-') || job.id.startsWith('manual-research-') || job.id.startsWith('digital-product-research-')) ?? [];

  async function load() {
    const data = await request<{ transactions: Transaction[] }>('/transactions');
    setTransactions(data.transactions);
  }
  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Transaksi tidak tersedia.'));
    void request<{ enabled: boolean }>('/schedule').then((data) => setSchedule(data.enabled)).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Status jadwal tidak tersedia.'));
  }, []);

  async function research(target: ResearchProduct) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (target === 'opportunities') {
        const { id } = await request<{ id: string }>('/research', { product: target });
        setNotice(`Tugas riset eksternal sudah diberikan ke Strategi Konten/Kreator (${id}). Hasil beserta sumber akan muncul sebagai draf setelah tugas selesai.`);
        return;
      }
      const { draft } = await request<{ draft: WorkDraft }>('/research', { product: target });
      onDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Riset gagal.');
    } finally { setBusy(false); }
  }
  async function startSprint() {
    if (!window.confirm('Mulai sprint 7 hari untuk ScanBite, Konter +62, Lorisan Warung, siput.id, dan SIP Posyandu? Riset web dan hingga 11 permintaan AI lanjutan dapat menimbulkan biaya, termasuk jika gagal.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<{ id: string; alreadyActive: boolean }>('/opportunities/sprint', {});
      setNotice(result.alreadyActive
        ? 'Sprint peluang minggu ini sudah tercatat. Periksa antrean, termasuk tugas yang gagal, sebelum memulai lagi.'
        : 'Sprint dimulai. Setelah riset selesai, 11 tugas spesialis akan menunggu pilihan dan tidak berjalan otomatis.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sprint gagal dimulai.');
    } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await request('/transactions', { product, kind, amount: Number(amount), date, note });
      setAmount(''); setNote('');
      await load();
      setReportRefreshKey((key) => key + 1);
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
      setReportRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaksi gagal dibatalkan.');
    } finally { setBusy(false); }
  }

  return <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Peluang Produk &amp; Keuangan</h2>
      <button type="button" className={button} onClick={() => setExecutiveReportOpen(true)}>Buka Ruang Pimpinan</button>
    </div>
    <ExecutiveRevenueReport open={executiveReportOpen} onClose={() => setExecutiveReportOpen(false)} refreshKey={reportRefreshKey} />
    {error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-teal-950 p-3 text-sm text-teal-200">{notice}</p>}
    <div className="space-y-3 rounded-lg border border-slate-700 p-4">
      <h3 className="font-bold">Rutinitas produk digital harian</h3>
      <p className="text-sm text-slate-300">Setiap hari setelah pukul 06.00 WIB, kantor menyiapkan satu tugas riset produk digital non-aplikasi dengan fokus yang berganti di antara kebutuhan UMKM, kreator, pekerja, pencari kerja, pendidikan, rumah tangga, dan komunitas. Riset membandingkan beberapa konsep berdasarkan bukti; bukan hanya produk guru atau paket prompt. Tugas menunggu pilihanmu dan tidak memanggil AI atau menimbulkan biaya sampai kamu menekan tombol mulai. Setelah riset disetujui, Script-AI membuat MVP sesuai konsep terpilih (misalnya template, panduan, workbook, kit konten, atau prompt/workflow); setelah MVP disetujui, staf menyiapkan draf pemasaran. Publikasi, kontak pelanggan, dan video berbayar tetap memerlukan tindakan terpisah darimu.</p>
      {jobs === null ? <p className="text-sm text-amber-300">Status tugas harian tidak tersedia.</p> : <div className="space-y-2">{dailyProductJobs.length ? dailyProductJobs.map((job) => <div key={job.id} className="rounded-lg bg-slate-950 p-3 text-sm">
        <strong>{job.title}</strong> · {job.status === 'PAUSED' ? 'Menunggu kamu mulai' : job.status === 'QUEUED' ? 'Antre' : job.status === 'RUNNING' ? 'Diproses' : job.status === 'DONE' ? 'Selesai' : 'Gagal'}
        {job.error && <p className="text-amber-300">{job.error}</p>}
        {job.status === 'PAUSED' && <button className="mt-2 underline disabled:opacity-50" type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
          if (!window.confirm('Mulai satu tugas riset produk digital? Permintaan AI dapat dikenai biaya sesuai pemakaian dan limit OpenRouter.')) return;
          setPendingSprintJobId(job.id);
          void onStartDailyProductJob(job.id).finally(() => setPendingSprintJobId(''));
        }}>Mulai riset ini (dapat berbiaya)</button>}
        {job.status === 'FAILED' && <button className="mt-2 underline disabled:opacity-50" type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
          if (!window.confirm('Ulangi riset produk digital? Permintaan AI dapat dikenai biaya sesuai pemakaian dan limit OpenRouter.')) return;
          setPendingSprintJobId(job.id);
          void onRetry(job.id).finally(() => setPendingSprintJobId(''));
        }}>Coba lagi (mungkin berbiaya)</button>}
      </div>) : <p className="text-sm text-slate-400">Tugas hari ini belum dijadwalkan. Jadwal dibuat setelah pukul 06.00 WIB ketika server aktif.</p>}</div>}
    </div>
    <div className="space-y-3 rounded-lg border border-slate-700 p-4">
      <h3 className="font-bold">Riset peluang &amp; sprint validasi 7 hari</h3>
      <p className="text-sm text-slate-300">Jadwal mingguan: {schedule === null ? 'status tidak tersedia' : schedule ? 'aktif' : 'nonaktif'}. Setiap Senin setelah 06.00 WIB, atau saat server pertama aktif dalam minggu itu, sistem mengantrekan riset untuk ScanBite, Konter +62, dan Lorisan Warung. Jika riset berhasil, Engineer dan Cyber Security masing-masing menyiapkan review untuk ketiga proyek, Kreator membuat materi validasi per proyek, lalu PAUD dan Posyandu mendapat checklist administrasi siput.id dan SIP Posyandu dalam denah kantor yang sama.</p>
      <p className="text-sm text-slate-300">Target 7 hari adalah batas eksperimen validasi, bukan janji mendapat pelanggan atau uang. Pimpinan tetap perlu memeriksa bukti dan kemampuan produk, menyetujui penawaran, menghubungi calon pelanggan secara manual, serta mencatat hanya pembayaran yang benar-benar diterima.</p>
      <p className="text-sm text-amber-300">Satu siklus menggunakan satu permintaan OpenRouter dengan pencarian web dan hingga 11 permintaan AI lanjutan. Biaya dapat timbul meskipun gagal. Batas aplikasi maksimal US$25 per bulan; atur batas kunci yang sama atau lebih rendah di OpenRouter, lalu periksa harga dan pemakaian. Nonaktifkan jadwal melalui konfigurasi dan mulai ulang server.</p>
      <p className="text-sm text-slate-300">Riset produk digital non-aplikasi ditangani Strategi Konten di divisi Kreator (DeepSeek Chat sebagai model utama). Fokus harian berganti dan dapat mencakup berbagai kelompok pengguna; setiap laporan membandingkan hingga tiga konsep dengan bukti bertanggal, menandai informasi yang belum terverifikasi, lalu merekomendasikan satu eksperimen murah. Draf hanya dibuat jika ada minimal tiga sumber; riset tidak memulai tugas lanjutan atau publikasi sampai disetujui.</p>
      <p className="text-sm text-slate-300">Untuk mengantrekan riset mingguan beserta 11 tugas spesialis di lima divisi sekarang, gunakan tombol sprint dengan sadar akan potensi biaya.</p>
      <p className="text-sm text-teal-300">Tugas lanjutan sprint dijalankan satu per satu: pilih “Jalankan tugas ini saja” untuk memulai satu tugas. Tugas berikutnya tetap ditahan sampai tugas aktif selesai atau gagal.</p>
      <p className="text-sm text-amber-300">Hasil dan sumber harus diverifikasi. Persetujuan hanya menyetujui ide, bukan menghubungi pelanggan, mengubah kode, atau mempublikasikan konten.</p>
      <button className={button} disabled={busy} onClick={() => void startSprint()}>Mulai sprint pemasukan sekarang</button>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void research('paud')}>Riset Siput PAUD</button>
        <button className={button} disabled={busy} onClick={() => void research('posyandu')}>Riset Siput Posyandu</button>
        <button className={button} disabled={busy} onClick={() => void research('opportunities')}>Riset peluang produk digital baru</button>
      </div>
      <h4 className="font-bold">Antrean riset dan siklus mingguan</h4>
      {jobs === null ? <p className="text-sm text-amber-300">Status antrean tidak tersedia.</p> : sprintJobs.length === 0 ? <p className="text-sm text-slate-400">Belum ada tugas sprint.</p> : <div className="space-y-2">{sprintJobs.map((job) => <div key={job.id} className="rounded-lg bg-slate-950 p-3 text-sm">
        <strong>{job.title}</strong> · {job.status === 'PAUSED' ? 'Menunggu pilihan' : job.status === 'QUEUED' ? 'Antre' : job.status === 'RUNNING' ? 'Diproses' : job.status === 'DONE' ? 'Selesai' : 'Gagal'}
        {job.error && <p className="text-amber-300">{job.error}</p>}
        {job.status === 'PAUSED' && <button className="mt-2 underline disabled:opacity-50" type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
          setPendingSprintJobId(job.id);
          void onStartSprintJob(job.id).finally(() => setPendingSprintJobId(''));
        }}>Jalankan tugas ini saja</button>}
        {job.status === 'FAILED' && <div className="mt-2 flex flex-wrap gap-3">
          <button className="underline disabled:opacity-50" type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
            setPendingSprintJobId(job.id);
            void onRetry(job.id).finally(() => setPendingSprintJobId(''));
          }}>Coba lagi (mungkin berbiaya)</button>
          <button className="underline text-red-300 disabled:opacity-50" type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
            if (!window.confirm(`Hapus tugas gagal "${job.title}" dari daftar? Tugas tidak akan dijalankan ulang otomatis. Riwayat tetap tersimpan di database.`)) return;
            setPendingSprintJobId(job.id);
            void onDismissSprint(job.id).finally(() => setPendingSprintJobId(''));
          }}>Hapus dari daftar</button>
        </div>}
      </div>)}</div>}
    </div>
    <div className="space-y-3 rounded-lg border border-slate-700 p-4">
      <h3 className="font-bold">Catatan transaksi &amp; estimasi</h3>
      <p className="text-sm text-slate-300">Catat pemasukan hanya setelah pembayaran benar-benar diterima. Nilai estimasi tetap terpisah dari revenue. Data disimpan dalam database aplikasi, tidak dikirim untuk riset AI. Jangan masukkan nama pelanggan, nomor rekening, atau data pribadi. Ringkasan ini bukan laporan akuntansi atau bukti pembayaran.</p>
      {transactions === null ? <p className="text-sm text-slate-400">Data belum tersedia.</p> : <div className="grid gap-3 sm:grid-cols-2">
        {(['digital', 'scanbite', 'konter', 'lorisan', 'paud', 'posyandu', 'other'] as const).map((item) => {
          const income = transactions.filter((t) => t.product === item && t.kind === 'INCOME' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
          const expense = transactions.filter((t) => t.product === item && t.kind === 'EXPENSE' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
          const estimate = transactions.filter((t) => t.product === item && t.kind === 'ESTIMATE' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
          return <div key={item} className="rounded-lg bg-slate-950 p-3 text-sm">
            <h4 className="font-bold">{productName(item)}</h4>
            <p>Revenue aktual: {rupiah(income)}</p><p>Estimasi pemasukan: {rupiah(estimate)}</p><p>Pengeluaran: {rupiah(expense)}</p><p>Selisih aktual: {rupiah(income - expense)}</p>
          </div>;
        })}
      </div>}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
        <label>Produk<select className={field} value={product} onChange={(e) => setProduct(e.target.value as Product)}><option value="digital">Produk digital (portofolio)</option><option value="scanbite">ScanBite</option><option value="konter">Konter +62</option><option value="lorisan">Lorisan Warung</option><option value="paud">Siput PAUD</option><option value="posyandu">Siput Posyandu</option><option value="other">Aplikasi lain</option></select></label>
        <label>Jenis<select className={field} value={kind} onChange={(e) => setKind(e.target.value as Transaction['kind'])}><option value="INCOME">Pemasukan aktual</option><option value="ESTIMATE">Estimasi pemasukan</option><option value="EXPENSE">Pengeluaran</option></select></label>
        <label>Nominal rupiah<input className={field} type="number" min="1" max="2147483647" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>Tanggal transaksi<input className={field} type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="sm:col-span-2">Catatan tanpa data pribadi<input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button className={button} disabled={busy}>Simpan transaksi</button>
      </form>
      <p className="text-xs text-slate-400">Untuk koreksi, batalkan transaksi yang salah lalu catat transaksi yang benar. Riwayat pembatalan tetap tersimpan.</p>
      {transactions && <div className="space-y-2"><h4 className="font-bold">Riwayat transaksi</h4>
        {transactions.length === 0 && <p className="text-sm text-slate-400">Belum ada transaksi yang dicatat.</p>}
        {transactions.map((t) => <div key={t.id} className="rounded-lg bg-slate-950 p-3 text-sm">{t.date} · {productName(t.product)} · {t.kind === 'INCOME' ? 'Pemasukan aktual' : t.kind === 'ESTIMATE' ? 'Estimasi pemasukan' : 'Pengeluaran'} · {rupiah(BigInt(t.amount))}{t.note && ` · ${t.note}`} {t.voidedAt ? '· Dibatalkan' : <button type="button" className="ml-2 underline" disabled={busy} onClick={() => void voidTransaction(t.id)}>Batalkan transaksi</button>}</div>)}
      </div>}
    </div>
  </section>;
}
