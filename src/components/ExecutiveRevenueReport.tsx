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
  recentLeads: Lead[];
};

const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white';
const button = 'min-h-10 rounded-lg bg-teal-400 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50';
const outline = 'min-h-10 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50';
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

  return <dialog ref={dialogRef} aria-labelledby="executive-report-title"
    className="fixed inset-0 m-auto max-h-[92vh] w-[min(100%-1rem,1000px)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl backdrop:bg-black/70 sm:p-6"
    onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Ruang Pimpinan</p>
        <h2 id="executive-report-title" className="mt-1 text-xl font-bold">Laporan pendapatan &amp; kinerja</h2></div>
      <button type="button" className={outline} onClick={onClose}>Tutup</button>
    </div>
    <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
      <label className="block text-sm">Jenis laporan
        <select className={field} value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
          <option value="day">Harian</option><option value="week">Mingguan</option><option value="month">Bulanan</option>
        </select>
      </label>
      <label className="block text-sm">Tanggal acuan (WIB)
        <input className={field} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
    </div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</p>}
    {!report && !error && <p role="status" className="mt-4 text-sm text-slate-300">Memuat laporan dari database…</p>}
    {report && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Pemasukan aktual tercatat" value={idr(report.actualRevenueIdr)} />
        <Metric label="Pemasukan estimasi (bukan revenue)" value={idr(report.estimatedIncomeIdr)} />
        <Metric label="Pengeluaran manual tercatat" value={idr(report.expensesIdr)} />
        <Metric label="Selisih transaksi tercatat (sebelum biaya AI)" value={idr(report.recordedProfitIdr)} />
        <Metric label="Biaya OpenRouter terukur" value={usd(report.aiCostUsdKnown)} />
        <Metric label="Selisih tercatat setelah biaya AI" value={idr(report.netProfitAfterAiIdr)} />
      </div>
      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
        <p className="font-semibold">{period === 'day' ? 'Laporan harian' : period === 'week' ? 'Laporan mingguan' : 'Laporan bulanan'} · {report.startDate} sampai {report.endDate} WIB</p>
        <p>Margin tercatat setelah biaya AI: {report.marginPercent === null ? 'Belum dapat dihitung' : `${report.marginPercent.toFixed(2)}%`}</p>
        <p>Kurs internal yang dipakai: {report.usdIdr === null ? 'Belum dikonfigurasi' : `Rp${new Intl.NumberFormat('id-ID').format(report.usdIdr)} / US$1`}</p>
        <p>Permintaan AI tercatat: {report.aiRequestCount} · tanpa harga: {report.unpricedAiCalls} · usage tidak lengkap: {report.usageIncompleteCalls}</p>
        {(!report.incomeSourceConnected || !report.externalExpensesAutoTracked) && <p className="mt-2 text-amber-300">{!report.incomeSourceConnected ? 'Belum tersambung ke Lynk.id atau sumber pembayaran; pemasukan hanya menghitung transaksi yang dicatat. ' : ''}{!report.externalExpensesAutoTracked ? 'Biaya VPS, domain, dan layanan luar perlu dicatat manual. ' : ''}Angka selisih ini belum tentu laba/rugi lengkap.</p>}
        {(report.usdIdr === null || !report.aiCostComplete) && <p className="mt-2 text-amber-300">
          Selisih setelah AI tidak dihitung karena {report.usdIdr === null ? 'kurs OPENROUTER_USD_IDR belum valid' : 'ada biaya AI tanpa nilai harga'}.
        </p>}
        {report.exchangeRateInvalid && <p role="alert" className="mt-1 text-red-300">OPENROUTER_USD_IDR harus berupa angka rupiah positif.</p>}
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full min-w-[700px] text-left text-sm">
          <caption className="p-3 text-left font-bold">Pemasukan, pengeluaran, dan biaya AI terukur per produk/kategori</caption>
          <thead className="bg-slate-950 text-slate-300"><tr><th className="p-2">Produk</th><th className="p-2">Pemasukan</th><th className="p-2">Estimasi</th><th className="p-2">Pengeluaran</th><th className="p-2">Biaya AI</th><th className="p-2">Selisih setelah AI</th></tr></thead>
          <tbody>{report.financeByProduct.length === 0
            ? <tr><td className="p-3 text-slate-400" colSpan={6}>Belum ada transaksi atau biaya AI tertagih per produk pada periode ini.</td></tr>
            : report.financeByProduct.map((product) => <tr key={product.product} className="border-t border-slate-800">
              <td className="p-2">{productName(product.product)}</td>
              <td className="p-2">{idr(product.actualRevenueIdr)}</td><td className="p-2">{idr(product.estimatedIncomeIdr)}</td>
              <td className="p-2">{idr(product.expensesIdr)}</td><td className="p-2">{usd(product.aiCostUsdKnown)}{product.aiUnpricedCalls ? ` · tanpa harga ${product.aiUnpricedCalls}` : ''}</td>
              <td className="p-2">{idr(product.netRecordedAfterAiIdr)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {report.unattributedAiCalls > 0 && <p className="mt-2 text-xs text-amber-300">{report.unattributedAiCalls} permintaan AI ({usd(report.unattributedAiCostUsdKnown)} biaya terukur) belum terhubung ke produk tertentu, termasuk penggunaan sebelum pencatatan per produk aktif.</p>}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full min-w-[620px] text-left text-sm">
          <caption className="p-3 text-left font-bold">Biaya dan token OpenRouter per divisi ({report.startDate}–{report.endDate} WIB)</caption>
          <thead className="bg-slate-950 text-slate-300"><tr><th className="p-2">Divisi</th><th className="p-2">Permintaan</th><th className="p-2">Token masuk/keluar</th><th className="p-2">Biaya terukur</th><th className="p-2">Tanpa harga</th></tr></thead>
          <tbody>{report.aiByDivision.length === 0
            ? <tr><td className="p-3 text-slate-400" colSpan={5}>Belum ada pemakaian AI tercatat pada periode ini.</td></tr>
            : report.aiByDivision.map((division) => <tr key={division.division} className="border-t border-slate-800">
              <td className="p-2 capitalize">{division.division}</td><td className="p-2">{division.requestCount}</td>
              <td className="p-2">{division.promptTokens.toLocaleString('id-ID')} / {division.completionTokens.toLocaleString('id-ID')}</td>
              <td className="p-2">{usd(division.costUsdKnown)}</td><td className="p-2">{division.unpricedCalls}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">Biaya yang dapat dihitung mencakup respons OpenRouter yang tercatat setelah fitur ini dipasang; cek dashboard OpenRouter untuk tagihan historis, pencarian web, dan pemakaian di luar aplikasi.</p>

      <section className="mt-5 rounded-lg border border-slate-700 p-4">
        <h3 className="font-bold">Pekerjaan kantor &amp; hasil produk</h3>
        <p className="mt-1 text-sm text-slate-300">{report.workSummary.total} tugas tercatat · {report.workSummary.completed} selesai · {report.workSummary.failed} gagal · {report.workSummary.running} berjalan · {report.workSummary.queued} antre · {report.workSummary.paused} menunggu pilihan.</p>
        <h4 className="mt-3 font-semibold">Draf/hasil yang dibuat pada periode ini</h4>
        {report.outputs.length === 0 ? <p className="mt-1 text-sm text-slate-400">Belum ada draf atau produk tercatat dibuat pada periode ini.</p> : <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
          {report.outputs.map((output) => <li key={output.id}>{output.title} · {output.isDigitalProduct ? 'Produk digital' : output.division} · {output.status === 'APPROVED' ? 'disetujui' : 'menunggu tinjauan'} · {new Date(output.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</li>)}
        </ul>}
        <h4 className="mt-3 font-semibold">Aktivitas tugas</h4>
        {report.activities.length === 0 ? <p className="mt-1 text-sm text-slate-400">Belum ada tugas pada periode ini.</p> : <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
          {report.activities.map((activity) => <li key={activity.id}>{activity.title} · {activity.division} · {activity.status} · diperbarui {new Date(activity.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB{activity.error ? ` · ${activity.error}` : ''}</li>)}
        </ul>}
      </section>

      <section className="mt-5 rounded-lg border border-slate-700 p-4">
        <h3 className="font-bold">Status lead &amp; proyek</h3>
        <p className="mt-1 text-sm text-slate-300">Pipeline saat ini: {report.leadPipeline.active} lead aktif · {report.leadPipeline.converted} terkonversi · {report.leadPipeline.sold} terjual · {report.leadPipeline.lost} tidak lanjut. Perubahan pada periode ini: {report.leadPipeline.createdOnDate} lead baru, {report.leadPipeline.convertedOnDate} konversi, {report.leadPipeline.soldOnDate} proyek terjual.</p>
        <p className="mt-1 text-sm text-slate-300">Estimasi nilai pipeline aktif: {idr(report.leadPipeline.pipelineValueIdr)} — bukan pendapatan. Status “terjual” adalah pencatatan manual; catat pembayaran yang benar-benar diterima terpisah sebagai revenue aktual.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void createLead(event)}>
          <label>Produk<select className={field} value={product} onChange={(event) => setProduct(event.target.value as Lead['product'])}>
            <option value="digital">Produk digital (portofolio)</option><option value="scanbite">ScanBite</option><option value="konter">Konter +62</option><option value="lorisan">Lorisan Warung</option>
          </select></label>
          <label>Nilai penawaran/pipeline estimasi (opsional, Rp)<input className={field} type="number" min="1" max="2147483647" step="1" value={valueIdr} onChange={(event) => setValueIdr(event.target.value)} /></label>
          <label className="sm:col-span-2">Catatan anonim, tanpa nama/kontak pelanggan<input className={field} maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <button type="submit" className={button} disabled={busy}>Catat lead baru</button>
        </form>
        <div className="mt-4 space-y-2">
          {report.recentLeads.length === 0 ? <p className="text-sm text-slate-400">Belum ada lead dicatat.</p> : report.recentLeads.map((lead) => <div key={lead.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 p-3 text-sm">
            <div><strong>{productName(lead.product)}</strong> · {statusName[lead.status]}{lead.valueIdr ? ` · estimasi ${idr(lead.valueIdr)}` : ''}
              {lead.note && <p className="text-slate-400">{lead.note}</p>}
              <p className="text-xs text-slate-500">{new Date(lead.createdAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lead.status === 'LEAD' && <>
                <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'CONVERTED')}>Tandai terkonversi</button>
                <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'LOST')}>Tutup lead</button>
              </>}
              {lead.status === 'CONVERTED' && <>
                <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'SOLD')}>Tandai terjual</button>
                <button className={outline} disabled={busy} onClick={() => void changeStatus(lead.id, 'LOST')}>Tutup lead</button>
              </>}
            </div>
          </div>)}
        </div>
        <p className="mt-2 text-xs text-slate-400">Daftar menampilkan maksimal 50 lead terbaru; ringkasan pipeline menghitung seluruh catatan.</p>
      </section>
    </>}
  </dialog>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
    <p className="text-xs text-slate-400">{label}</p><p className="mt-1 break-words text-lg font-bold">{value}</p>
  </div>;
}
