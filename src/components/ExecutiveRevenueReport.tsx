import { useEffect, useRef, useState, type FormEvent } from 'react';
import { jakartaDateKey } from '../lib/prayerSchedule';

type LeadStatus = 'LEAD' | 'CONVERTED' | 'SOLD' | 'LOST';
type ReportPeriod = 'day' | 'week' | 'month';
type Lead = {
  id: string;
  product: 'scanbite' | 'konter' | 'lorisan' | 'digital';
  status: LeadStatus;
  valueIdr: number | null;
  note: string;
  createdAt: string;
};
type DivisionUsage = {
  division: string;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  costUsdKnown: number;
  unpricedCalls: number;
  usageIncompleteCalls: number;
};
type Report = {
  date: string;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  actualRevenueIdr: number;
  estimatedIncomeIdr: number;
  expensesIdr: number;
  recordedProfitIdr: number;
  aiRequestCount: number;
  aiCostUsdKnown: number;
  unpricedAiCalls: number;
  usageIncompleteCalls: number;
  aiCostComplete: boolean;
  usdIdr: number | null;
  netProfitAfterAiIdr: number | null;
  marginPercent: number | null;
  aiByDivision: DivisionUsage[];
  financeByProduct: { product: string; actualRevenueIdr: number; estimatedIncomeIdr: number; expensesIdr: number; aiCostUsdKnown: number; aiUnpricedCalls: number; netRecordedAfterAiIdr: number | null }[];
  unattributedAiCalls: number;
  unattributedAiCostUsdKnown: number;
  incomeSourceConnected: boolean;
  externalExpensesAutoTracked: boolean;
  workSummary: { total: number; completed: number; failed: number; queued: number; running: number; paused: number };
  activities: { id: string; title: string; division: string; status: string; draftId: string | null; error: string | null; createdAt: string; updatedAt: string }[];
  outputs: { id: string; title: string; division: string; status: string; isDigitalProduct: boolean; createdAt: string }[];
  leadPipeline: {
    active: number;
    converted: number;
    sold: number;
    lost: number;
    pipelineValueIdr: number;
    createdOnDate: number;
    convertedOnDate: number;
    soldOnDate: number;
    lostOnDate: number;
  };
  exchangeRateInvalid: boolean;
  exchangeRateSource?: 'live' | 'env' | 'unavailable';
  exchangeRateProvider?: string | null;
  exchangeRateUpdatedAt?: string | null;
  openRouterLive?: {
    keyLimitUsd: number | null;
    keyRemainingUsd: number | null;
    accountTotalCredits: number | null;
    accountTotalUsage: number | null;
    accountRemainingCredits: number | null;
  };
  recentLeads: Lead[];
};

const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 shadow-sm';
const button = 'min-h-10 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50';
const outline = 'min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50';
const idr = (value: number | null) => value === null ? 'Belum dapat dihitung' : `Rp${new Intl.NumberFormat('id-ID').format(value)}`;
const usd = (value: number) => `US$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value)}`;
const productNames: Record<string, string> = {
  scanbite: 'ScanBite',
  konter: 'Konter +62',
  lorisan: 'Lorisan Warung',
  digital: 'Produk digital (portofolio)',
  paud: 'Siput PAUD',
  posyandu: 'SIP Posyandu',
  other: 'Produk lain',
};
const productName = (product: string) => productNames[product] ?? product;
const statusName: Record<LeadStatus, string> = { LEAD: 'Lead baru', CONVERTED: 'Terkonversi', SOLD: 'Terjual', LOST: 'Tidak lanjut' };

async function request<T>(path: string, method: 'GET' | 'POST' | 'PATCH', body?: object): Promise<T> {
  const response = await fetch(`/api/business${path}`, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Kesalahan server (${response.status}).`);
  return data as T;
}

export function ExecutiveRevenueReport({ open, onClose, refreshKey }: {
  open: boolean;
  onClose: () => void;
  refreshKey: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(() => jakartaDateKey(new Date()));
  const [period, setPeriod] = useState<ReportPeriod>('day');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<Lead['product']>('scanbite');
  const [valueIdr, setValueIdr] = useState('');
  const [note, setNote] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError('');
    void fetch(`/api/business/executive-report?date=${encodeURIComponent(date)}&period=${period}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Kesalahan server (${response.status}).`);
        return data as { report: Report };
      })
      .then((data) => setReport(data.report))
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Laporan tidak tersedia.');
      });
    return () => controller.abort();
  }, [open, date, period, refreshKey, reload]);

  async function createLead(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/leads', 'POST', { product, valueIdr: valueIdr ? Number(valueIdr) : null, note });
      setValueIdr('');
      setNote('');
      setReload((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lead gagal dicatat.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: Exclude<LeadStatus, 'LEAD'>) {
    setBusy(true);
    setError('');
    try {
      await request(`/leads/${encodeURIComponent(id)}/status`, 'PATCH', { status });
      setReload((count) => count + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Status lead gagal diperbarui.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="executive-report-title"
      className="fixed inset-0 m-auto max-h-[92vh] w-[min(100%-1rem,1040px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm sm:p-7"
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="app-eyebrow">Ruang Pimpinan</p>
          <h2 id="executive-report-title" className="mt-1 text-xl font-extrabold text-slate-900">Laporan pendapatan &amp; kinerja</h2>
        </div>
        <button type="button" className={outline} onClick={onClose}>Tutup</button>
      </div>

      <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">Jenis laporan
          <select className={field} value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
            <option value="day">Harian</option><option value="week">Mingguan</option><option value="month">Bulanan</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Tanggal acuan (WIB)
          <input className={field} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-800">{error}</p>}
      {!report && !error && <p role="status" className="mt-4 text-sm text-slate-500">Memuat laporan dari database…</p>}

      {report && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Pemasukan aktual tercatat" value={idr(report.actualRevenueIdr)} highlight="emerald" />
            <Metric label="Pemasukan estimasi (bukan revenue)" value={idr(report.estimatedIncomeIdr)} />
            <Metric label="Pengeluaran manual tercatat" value={idr(report.expensesIdr)} highlight="rose" />
            <Metric label="Selisih transaksi tercatat (sebelum biaya AI)" value={idr(report.recordedProfitIdr)} />
            <Metric label="Biaya OpenRouter terukur" value={usd(report.aiCostUsdKnown)} />
            <Metric label="Selisih tercatat setelah biaya AI" value={idr(report.netProfitAfterAiIdr)} highlight="teal" />
          </div>

          {report.openRouterLive && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                <p className="text-xs font-semibold text-sky-900">Sisa Limit Key Bulanan (OpenRouter Live)</p>
                {report.openRouterLive.keyRemainingUsd !== null && report.openRouterLive.keyLimitUsd !== null ? (
                  <>
                    <p className="mt-1 text-lg font-extrabold text-sky-950">
                      US${report.openRouterLive.keyRemainingUsd.toFixed(2)}{' '}
                      <span className="text-xs font-semibold text-sky-700">/ US${report.openRouterLive.keyLimitUsd.toFixed(2)}</span>
                    </p>
                    {report.usdIdr !== null && (
                      <p className="mt-0.5 text-xs text-sky-800">
                        Estimasi sisa limit: {idr(Math.round(report.openRouterLive.keyRemainingUsd * report.usdIdr))}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-600">Tidak tersedia (cek OPENROUTER_API_KEY)</p>
                )}
              </div>

              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                <p className="text-xs font-semibold text-violet-900">Saldo Kredit Akun OpenRouter (Live)</p>
                {report.openRouterLive.accountRemainingCredits !== null && report.openRouterLive.accountTotalCredits !== null ? (
                  <>
                    <p className="mt-1 text-lg font-extrabold text-violet-950">
                      US${report.openRouterLive.accountRemainingCredits.toFixed(4)}
                      {report.usdIdr !== null && (
                        <span className="ml-2 text-xs font-semibold text-violet-700">
                          (± {idr(Math.round(report.openRouterLive.accountRemainingCredits * report.usdIdr))})
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-violet-800">
                      Terpakai US${(report.openRouterLive.accountTotalUsage ?? 0).toFixed(4)} dari total top-up US${report.openRouterLive.accountTotalCredits.toFixed(4)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Isi <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">OPENROUTER_MANAGEMENT_KEY</code> di .env untuk melihat saldo kredit akun secara langsung.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
            <p className="font-bold text-slate-900">{period === 'day' ? 'Laporan harian' : period === 'week' ? 'Laporan mingguan' : 'Laporan bulanan'} · {report.startDate} sampai {report.endDate} WIB</p>
            <p className="mt-1">
              Margin tercatat setelah biaya AI: <strong>{report.marginPercent === null ? 'Belum dapat dihitung' : `${report.marginPercent.toFixed(2)}%`}</strong> · Kurs USD/IDR:{' '}
              <strong>
                {report.usdIdr === null
                  ? 'Belum tersedia'
                  : `Rp${new Intl.NumberFormat('id-ID').format(report.usdIdr)} / US$1`}
              </strong>
              {report.exchangeRateSource === 'live' && (
                <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  Otomatis · {report.exchangeRateProvider}
                </span>
              )}
              {report.exchangeRateSource === 'env' && (
                <span className="ml-2 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                  Manual (.env)
                </span>
              )}
            </p>
            <p className="mt-1">Permintaan AI tercatat: <strong>{report.aiRequestCount}</strong> · tanpa harga: <strong>{report.unpricedAiCalls}</strong> · usage tidak lengkap: <strong>{report.usageIncompleteCalls}</strong></p>
            {(!report.incomeSourceConnected || !report.externalExpensesAutoTracked) && (
              <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-800">
                {!report.incomeSourceConnected ? 'Belum tersambung ke Lynk.id atau sumber pembayaran; pemasukan hanya menghitung transaksi yang dicatat. ' : ''}
                {!report.externalExpensesAutoTracked ? 'Biaya VPS, domain, dan layanan luar perlu dicatat manual. ' : ''}
                Angka selisih ini belum tentu laba/rugi lengkap.
              </p>
            )}
            {(report.usdIdr === null || !report.aiCostComplete) && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Selisih setelah AI tidak dihitung karena {report.usdIdr === null ? 'kurs USD/IDR belum tersedia (jaringan gagal dan OPENROUTER_USD_IDR belum diisi)' : 'ada biaya AI tanpa nilai harga'}.
              </p>
            )}
            {report.exchangeRateInvalid && <p role="alert" className="mt-1 text-xs font-semibold text-rose-700">OPENROUTER_USD_IDR harus berupa angka rupiah positif.</p>}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <caption className="border-b border-slate-100 p-3.5 text-left font-bold text-slate-900">Pemasukan, pengeluaran, dan biaya AI terukur per produk/kategori</caption>
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="p-3">Produk</th><th className="p-3">Pemasukan</th><th className="p-3">Estimasi</th><th className="p-3">Pengeluaran</th><th className="p-3">Biaya AI</th><th className="p-3">Selisih setelah AI</th></tr>
              </thead>
              <tbody>
                {report.financeByProduct.length === 0
                  ? <tr><td className="p-4 text-slate-500" colSpan={6}>Belum ada transaksi atau biaya AI tertagih per produk pada periode ini.</td></tr>
                  : report.financeByProduct.map((prod) => (
                    <tr key={prod.product} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="p-3 font-semibold text-slate-900">{productName(prod.product)}</td>
                      <td className="p-3 text-emerald-700">{idr(prod.actualRevenueIdr)}</td>
                      <td className="p-3 text-slate-600">{idr(prod.estimatedIncomeIdr)}</td>
                      <td className="p-3 text-rose-700">{idr(prod.expensesIdr)}</td>
                      <td className="p-3 font-mono text-xs">{usd(prod.aiCostUsdKnown)}{prod.aiUnpricedCalls ? ` · tanpa harga ${prod.aiUnpricedCalls}` : ''}</td>
                      <td className="p-3 font-bold">{idr(prod.netRecordedAfterAiIdr)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {report.unattributedAiCalls > 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">{report.unattributedAiCalls} permintaan AI ({usd(report.unattributedAiCostUsdKnown)} biaya terukur) belum terhubung ke produk tertentu, termasuk penggunaan sebelum pencatatan per produk aktif.</p>
          )}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="border-b border-slate-100 p-3.5 text-left font-bold text-slate-900">Biaya dan token OpenRouter per divisi ({report.startDate}–{report.endDate} WIB)</caption>
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr><th className="p-3">Divisi</th><th className="p-3">Permintaan</th><th className="p-3">Token masuk/keluar</th><th className="p-3">Biaya terukur</th><th className="p-3">Tanpa harga</th></tr>
              </thead>
              <tbody>
                {report.aiByDivision.length === 0
                  ? <tr><td className="p-4 text-slate-500" colSpan={5}>Belum ada pemakaian AI tercatat pada periode ini.</td></tr>
                  : report.aiByDivision.map((division) => (
                    <tr key={division.division} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="p-3 font-semibold capitalize text-slate-900">{division.division}</td>
                      <td className="p-3">{division.requestCount}</td>
                      <td className="p-3 font-mono text-xs">{division.promptTokens.toLocaleString('id-ID')} / {division.completionTokens.toLocaleString('id-ID')}</td>
                      <td className="p-3 font-mono text-xs font-semibold text-teal-800">{usd(division.costUsdKnown)}</td>
                      <td className="p-3">{division.unpricedCalls}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Biaya yang dapat dihitung mencakup respons OpenRouter yang tercatat setelah fitur ini dipasang; cek dashboard OpenRouter untuk tagihan historis, pencarian web, dan pemakaian di luar aplikasi.</p>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="font-bold text-slate-900">Pekerjaan kantor &amp; hasil produk</h3>
            <p className="mt-1 text-sm text-slate-600">{report.workSummary.total} tugas tercatat · {report.workSummary.completed} selesai · {report.workSummary.failed} gagal · {report.workSummary.running} berjalan · {report.workSummary.queued} antre · {report.workSummary.paused} menunggu pilihan.</p>
            <h4 className="mt-3 text-sm font-bold text-slate-800">Draf/hasil yang dibuat pada periode ini</h4>
            {report.outputs.length === 0 ? <p className="mt-1 text-sm text-slate-500">Belum ada draf atau produk tercatat dibuat pada periode ini.</p> : (
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-700">
                {report.outputs.map((output) => <li key={output.id}>{output.title} · {output.isDigitalProduct ? 'Produk digital' : output.division} · {output.status === 'APPROVED' ? 'disetujui' : 'menunggu tinjauan'} · {new Date(output.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</li>)}
              </ul>
            )}
            <h4 className="mt-3 text-sm font-bold text-slate-800">Aktivitas tugas</h4>
            {report.activities.length === 0 ? <p className="mt-1 text-sm text-slate-500">Belum ada tugas pada periode ini.</p> : (
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-slate-700">
                {report.activities.map((activity) => <li key={activity.id}>{activity.title} · {activity.division} · {activity.status} · diperbarui {new Date(activity.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB{activity.error ? ` · ${activity.error}` : ''}</li>)}
              </ul>
            )}
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="font-bold text-slate-900">Status lead &amp; proyek</h3>
            <p className="mt-1 text-sm text-slate-600">Pipeline saat ini: {report.leadPipeline.active} lead aktif · {report.leadPipeline.converted} terkonversi · {report.leadPipeline.sold} terjual · {report.leadPipeline.lost} tidak lanjut. Perubahan pada periode ini: {report.leadPipeline.createdOnDate} lead baru, {report.leadPipeline.convertedOnDate} konversi, {report.leadPipeline.soldOnDate} proyek terjual.</p>
            <p className="mt-1 text-xs text-slate-500">Estimasi nilai pipeline aktif: {idr(report.leadPipeline.pipelineValueIdr)} — bukan pendapatan. Status “terjual” adalah pencatatan manual; catat pembayaran yang benar-benar diterima terpisah sebagai revenue aktual.</p>
            <form className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2" onSubmit={(event) => void createLead(event)}>
              <label className="text-sm font-semibold text-slate-700">Produk
                <select className={field} value={product} onChange={(event) => setProduct(event.target.value as Lead['product'])}>
                  <option value="digital">Produk digital (portofolio)</option><option value="scanbite">ScanBite</option><option value="konter">Konter +62</option><option value="lorisan">Lorisan Warung</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Nilai penawaran/pipeline estimasi (opsional, Rp)
                <input className={field} type="number" min="1" max="2147483647" step="1" value={valueIdr} onChange={(event) => setValueIdr(event.target.value)} />
              </label>
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Catatan anonim, tanpa nama/kontak pelanggan
                <input className={field} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className={button} disabled={busy}>Catat lead baru</button>
              </div>
            </form>
            <div className="mt-4 space-y-2">
              {report.recentLeads.length === 0 ? <p className="text-sm text-slate-500">Belum ada lead dicatat.</p> : report.recentLeads.map((lead) => (
                <div key={lead.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm">
                  <div>
                    <strong className="text-slate-900">{productName(lead.product)}</strong>
                    <span className={`ml-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${lead.status === 'SOLD' ? 'bg-emerald-100 text-emerald-800' : lead.status === 'CONVERTED' ? 'bg-teal-100 text-teal-800' : lead.status === 'LOST' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                      {statusName[lead.status]}
                    </span>
                    {lead.valueIdr ? <span className="ml-2 text-xs font-semibold text-slate-600">estimasi {idr(lead.valueIdr)}</span> : null}
                    {lead.note && <p className="mt-1 text-slate-600">{lead.note}</p>}
                    <p className="mt-0.5 text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lead.status === 'LEAD' && (
                      <>
                        <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'CONVERTED')}>Tandai terkonversi</button>
                        <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'LOST')}>Tutup lead</button>
                      </>
                    )}
                    {lead.status === 'CONVERTED' && (
                      <>
                        <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'SOLD')}>Tandai terjual</button>
                        <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'LOST')}>Tutup lead</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Daftar menampilkan maksimal 50 lead terbaru; ringkasan pipeline menghitung seluruh catatan.</p>
          </section>
        </>
      )}
    </dialog>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: 'emerald' | 'rose' | 'teal' }) {
  const tone = highlight === 'emerald'
    ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
    : highlight === 'rose'
      ? 'border-rose-200 bg-rose-50/70 text-rose-900'
      : highlight === 'teal'
        ? 'border-teal-200 bg-teal-50/70 text-teal-900'
        : 'border-slate-200 bg-slate-50/80 text-slate-900';
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1.5 break-words text-lg font-extrabold">{value}</p>
    </div>
  );
}
