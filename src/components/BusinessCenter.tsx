import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownLeft, ArrowUpRight, BarChart3, CalendarClock, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import type { OfficeJob, WorkDraft } from '../workflowTypes';
import { ExecutiveRevenueReport } from './ExecutiveRevenueReport';

type Product = 'paud' | 'posyandu' | 'scanbite' | 'konter' | 'lorisan' | 'digital' | 'other';
type ResearchProduct = 'paud' | 'posyandu' | 'opportunities';
type Transaction = { id: string; product: Product; kind: 'INCOME' | 'EXPENSE' | 'ESTIMATE'; amount: number; date: string; note: string; voidedAt: string | null };
type BusinessTab = 'research' | 'finance';

const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 shadow-sm';
const button = 'min-h-11 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-teal-900/10 transition hover:bg-teal-700 disabled:opacity-50';
const secondaryButton = 'min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50';
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
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
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
  const [section, setSection] = useState<BusinessTab>('research');
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

  const totalIncome = transactions?.filter((t) => t.kind === 'INCOME' && !t.voidedAt).reduce((s, t) => s + BigInt(t.amount), 0n) ?? 0n;
  const totalExpense = transactions?.filter((t) => t.kind === 'EXPENSE' && !t.voidedAt).reduce((s, t) => s + BigInt(t.amount), 0n) ?? 0n;
  const totalNet = totalIncome - totalExpense;

  return (
    <section className="space-y-5">
      {/* Top Hero Header */}
      <div className="studio-hero-dark flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-teal-200">
            <TrendingUp size={13} /> PELUANG &amp; ARUS KAS
          </span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white">Pusat Bisnis &amp; Keuangan</h2>
          <p className="mt-1 text-sm text-slate-300">Kelola riset peluang berbiaya terkendali, sprint 7 hari, dan pencatatan kas per produk.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {transactions !== null && (
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-right backdrop-blur-sm">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-teal-200">Selisih Kas Tercatat</span>
              <strong className="text-lg font-extrabold text-white">{rupiah(totalNet)}</strong>
            </div>
          )}
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-slate-900 shadow-lg transition hover:bg-emerald-50"
            onClick={() => setExecutiveReportOpen(true)}
          >
            <BarChart3 size={17} className="text-teal-700" /> Buka Ruang Pimpinan
          </button>
        </div>
      </div>

      {/* Animated Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="studio-subtabs" role="tablist" aria-label="Bagian bisnis dan keuangan">
          {([
            ['research', 'Riset & Sprint', Sparkles],
            ['finance', 'Kas & Transaksi', Wallet],
          ] as const).map(([key, label, Icon]) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSection(key)}
                className={`relative flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
                  active ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="business-subtab"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon size={15} className={active ? 'text-teal-600' : ''} />
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ExecutiveRevenueReport open={executiveReportOpen} onClose={() => setExecutiveReportOpen(false)} refreshKey={reportRefreshKey} />
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800">{notice}</p>}

      <AnimatePresence mode="wait">
        {section === 'research' ? (
          <motion.div
            key="research"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="studio-bento-card flex flex-col justify-between space-y-4 p-5 sm:p-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-teal-200 bg-teal-50 text-teal-700">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Rutinitas produk digital harian</h3>
                      <p className="mt-1 text-sm text-slate-600">Disiapkan tiap hari pukul 06.00 WIB dalam status tertahan (Rp0 sampai kamu menekan Mulai).</p>
                    </div>
                  </div>

                  {jobs === null ? <p className="text-sm font-medium text-amber-700">Status tugas harian tidak tersedia.</p> : (
                    <div className="space-y-2.5">
                      {dailyProductJobs.length ? dailyProductJobs.map((job) => (
                        <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm">
                          <div>
                            <strong className="text-slate-900">{job.title}</strong>
                            <span className="ml-2 inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                              {job.status === 'PAUSED' ? 'Menunggu mulai' : job.status === 'QUEUED' ? 'Antre' : job.status === 'RUNNING' ? 'Diproses' : job.status === 'DONE' ? 'Selesai' : 'Gagal'}
                            </span>
                            {job.error && <p className="mt-1 text-xs font-medium text-rose-700">{job.error}</p>}
                          </div>
                          {job.status === 'PAUSED' && (
                            <button className={button} type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
                              if (!window.confirm('Mulai satu tugas riset produk digital? Permintaan AI dapat dikenai biaya sesuai pemakaian dan limit OpenRouter.')) return;
                              setPendingSprintJobId(job.id);
                              void onStartDailyProductJob(job.id).finally(() => setPendingSprintJobId(''));
                            }}>Mulai riset ini</button>
                          )}
                          {job.status === 'FAILED' && (
                            <button className={secondaryButton} type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
                              if (!window.confirm('Ulangi riset produk digital? Permintaan AI dapat dikenai biaya sesuai pemakaian dan limit OpenRouter.')) return;
                              setPendingSprintJobId(job.id);
                              void onRetry(job.id).finally(() => setPendingSprintJobId(''));
                            }}>Coba lagi</button>
                          )}
                        </div>
                      )) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Tugas hari ini belum dijadwalkan (otomatis dibuat setelah 06.00 WIB saat server aktif).</p>}
                    </div>
                  )}
                </div>

                <details className="office-info-box">
                  <summary>Alur MVP &amp; aturan biaya harian</summary>
                  <p className="mt-2 leading-relaxed text-slate-600">Fokus berganti antar UMKM, kreator, pekerja, pencari kerja, pendidikan, rumah tangga, dan komunitas. Setelah riset disetujui, Script-AI membuat MVP; setelah MVP disetujui, staf menyiapkan draf pemasaran.</p>
                </details>
              </div>

              <div className="studio-bento-card flex flex-col justify-between space-y-4 p-5 sm:p-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
                        <CalendarClock size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Riset &amp; Sprint Validasi 7 Hari</h3>
                        <p className="mt-1 text-sm text-slate-600">Validasi produk aplikasi atau cari konsep produk digital baru berbasis web search.</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${schedule ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                      Jadwal Senin: {schedule === null ? '—' : schedule ? 'Aktif' : 'OFF (Hemat)'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button className={button} disabled={busy} onClick={() => void startSprint()}>Mulai sprint 7 hari</button>
                    <button className={secondaryButton} disabled={busy} onClick={() => void research('opportunities')}>Riset produk digital</button>
                    <button className={secondaryButton} disabled={busy} onClick={() => void research('paud')}>Riset PAUD</button>
                    <button className={secondaryButton} disabled={busy} onClick={() => void research('posyandu')}>Riset Posyandu</button>
                  </div>
                </div>

                <details className="office-info-box">
                  <summary>Detail siklus mingguan &amp; batas US$25/bulan</summary>
                  <p className="mt-2 leading-relaxed text-slate-600">
                    Sprint memakai 1 pencarian web OpenRouter dan hingga 11 tugas AI lanjutan yang ditahan agar dapat dipilih satu per satu. Biaya dapat timbul meski gagal. Batas aplikasi maksimal US$25/bulan.
                  </p>
                </details>
              </div>
            </div>

            <div className="studio-bento-card space-y-3 p-5 sm:p-6">
              <h4 className="text-base font-extrabold text-slate-900">Antrean riset dan siklus mingguan</h4>
              {jobs === null ? <p className="text-sm font-medium text-amber-700">Status antrean tidak tersedia.</p> : sprintJobs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Belum ada tugas sprint atau riset aktif.</p>
              ) : (
                <div className="space-y-2">
                  {sprintJobs.map((job) => (
                    <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <strong className="text-slate-900">{job.title}</strong>
                        <span className="ml-2 inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                          {job.status === 'PAUSED' ? 'Menunggu pilihan' : job.status === 'QUEUED' ? 'Antre' : job.status === 'RUNNING' ? 'Diproses' : job.status === 'DONE' ? 'Selesai' : 'Gagal'}
                        </span>
                        {job.error && <p className="mt-1 text-xs font-medium text-rose-700">{job.error}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {job.status === 'PAUSED' && (
                          <button className={secondaryButton} type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
                            setPendingSprintJobId(job.id);
                            void onStartSprintJob(job.id).finally(() => setPendingSprintJobId(''));
                          }}>Jalankan tugas ini saja</button>
                        )}
                        {job.status === 'FAILED' && (
                          <>
                            <button className={secondaryButton} type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
                              setPendingSprintJobId(job.id);
                              void onRetry(job.id).finally(() => setPendingSprintJobId(''));
                            }}>Coba lagi (berbiaya)</button>
                            <button className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50" type="button" disabled={busy || pendingSprintJobId === job.id} onClick={() => {
                              if (!window.confirm(`Hapus tugas gagal "${job.title}" dari daftar? Tugas tidak akan dijalankan ulang otomatis. Riwayat tetap tersimpan di database.`)) return;
                              setPendingSprintJobId(job.id);
                              void onDismissSprint(job.id).finally(() => setPendingSprintJobId(''));
                            }}>Hapus</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="finance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Summary 3-Card Bento */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="studio-bento-card p-5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Total Pemasukan Aktual</span>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><ArrowDownLeft size={15} /></span>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700">{rupiah(totalIncome)}</p>
              </div>
              <div className="studio-bento-card p-5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>Total Pengeluaran</span>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600"><ArrowUpRight size={15} /></span>
                </div>
                <p className="mt-2 text-2xl font-extrabold text-rose-700">{rupiah(totalExpense)}</p>
              </div>
              <div className="studio-bento-card bg-gradient-to-br from-teal-50/90 to-white p-5">
                <div className="flex items-center justify-between text-xs font-bold text-teal-800">
                  <span>Selisih Kas Bersih</span>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-100 text-teal-700"><Wallet size={15} /></span>
                </div>
                <p className={`mt-2 text-2xl font-extrabold ${totalNet >= 0n ? 'text-teal-800' : 'text-rose-700'}`}>{rupiah(totalNet)}</p>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-5">
              {/* Transaction Form (2 cols) */}
              <div className="studio-bento-card space-y-4 p-5 sm:p-6 lg:col-span-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Catat Transaksi Baru</h3>
                  <p className="mt-1 text-xs text-slate-500">Disimpan lokal di database, tidak dikirim ke AI. Jangan masukkan nama/rekening pelanggan.</p>
                </div>
                <form className="space-y-3.5" onSubmit={(event) => void save(event)}>
                  <div>
                    <span className="block text-xs font-bold text-slate-600">Jenis transaksi</span>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
                      {([
                        ['INCOME', 'Masuk'],
                        ['ESTIMATE', 'Estimasi'],
                        ['EXPENSE', 'Keluar'],
                      ] as const).map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setKind(val)}
                          className={`rounded-lg py-2 text-xs font-bold transition ${kind === val ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">Produk
                    <select className={field} value={product} onChange={(e) => setProduct(e.target.value as Product)}>
                      <option value="digital">Produk digital (portofolio)</option>
                      <option value="scanbite">ScanBite</option>
                      <option value="konter">Konter +62</option>
                      <option value="lorisan">Lorisan Warung</option>
                      <option value="paud">Siput PAUD</option>
                      <option value="posyandu">Siput Posyandu</option>
                      <option value="other">Aplikasi lain</option>
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <label className="block text-sm font-semibold text-slate-700">Nominal rupiah
                      <input className={field} type="number" min="1" max="2147483647" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">Tanggal transaksi
                      <input className={field} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">Catatan anonim
                    <input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Penjualan template bulan ini" />
                  </label>
                  <button className={`${button} w-full`} disabled={busy}>Simpan transaksi</button>
                </form>
              </div>

              {/* Per-Product Breakdown (3 cols) */}
              <div className="studio-bento-card space-y-4 p-5 sm:p-6 lg:col-span-3">
                <h3 className="text-base font-extrabold text-slate-900">Ringkasan per Produk</h3>
                {transactions === null ? <p className="text-sm text-slate-500">Data belum tersedia.</p> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(['digital', 'scanbite', 'konter', 'lorisan', 'paud', 'posyandu', 'other'] as const).map((item) => {
                      const income = transactions.filter((t) => t.product === item && t.kind === 'INCOME' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
                      const expense = transactions.filter((t) => t.product === item && t.kind === 'EXPENSE' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
                      const estimate = transactions.filter((t) => t.product === item && t.kind === 'ESTIMATE' && !t.voidedAt).reduce((sum, t) => sum + BigInt(t.amount), 0n);
                      const net = income - expense;
                      return (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm transition hover:border-teal-200">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-extrabold text-slate-900">{productName(item)}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${net >= 0n ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {rupiah(net)}
                            </span>
                          </div>
                          <dl className="mt-2.5 space-y-1 text-xs">
                            <div className="flex justify-between"><dt className="text-slate-500">Aktual</dt><dd className="font-bold text-emerald-700">{rupiah(income)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Estimasi</dt><dd className="font-semibold text-slate-700">{rupiah(estimate)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Keluar</dt><dd className="font-semibold text-rose-700">{rupiah(expense)}</dd></div>
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {transactions && (
              <div className="studio-bento-card space-y-3 p-5 sm:p-6">
                <h4 className="text-base font-extrabold text-slate-900">Riwayat transaksi</h4>
                {transactions.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">Belum ada transaksi yang dicatat.</p>}
                <div className="space-y-2">
                  {transactions.map((t) => (
                    <div key={t.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3.5 text-sm ${t.voidedAt ? 'border-slate-200 bg-slate-100/70 text-slate-400 line-through' : 'border-slate-200 bg-slate-50/60 text-slate-800'}`}>
                      <div>
                        <span className="font-mono text-xs text-slate-500">{t.date}</span> · <strong>{productName(t.product)}</strong> · {t.kind === 'INCOME' ? 'Pemasukan aktual' : t.kind === 'ESTIMATE' ? 'Estimasi pemasukan' : 'Pengeluaran'} · <strong>{rupiah(BigInt(t.amount))}</strong>{t.note && ` · ${t.note}`}
                      </div>
                      {t.voidedAt ? <span className="text-xs font-semibold no-underline">Dibatalkan</span> : (
                        <button type="button" className="text-xs font-bold text-rose-600 underline hover:text-rose-800" disabled={busy} onClick={() => void voidTransaction(t.id)}>Batalkan transaksi</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
