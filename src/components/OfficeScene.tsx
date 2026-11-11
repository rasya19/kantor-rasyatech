import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { STAFF } from '../staff';
import type { OfficeDivision, OfficeJob, WorkDraft } from '../workflowTypes';
import { activePrayerBreak, fetchPrayerSchedule, formatJakartaTime, jakartaDateKey } from '../lib/prayerSchedule';
import type { PrayerBreak, PrayerSchedule } from '../lib/prayerSchedule';

const OfficeWorld3D = lazy(() => import('./OfficeWorld3D').then((module) => ({ default: module.OfficeWorld3D })));

const rooms: { division: OfficeDivision; name: string }[] = [
  { division: 'paud', name: 'Siput PAUD' },
  { division: 'posyandu', name: 'Siput Posyandu' },
  { division: 'creator', name: 'Content Creator' },
  { division: 'engineer', name: 'Web Engineer' },
  { division: 'cyber', name: 'Cyber Security' },
  { division: 'finance', name: 'Financial & Reporting' },
  { division: 'marketing', name: 'Digital Marketing & Distribution' },
];

export function OfficeScene({ jobs, drafts, initialSelectedStaffId, onAssign, onRetry, onDraft }: {
  jobs: OfficeJob[] | null; drafts: WorkDraft[] | null;
  initialSelectedStaffId?: string;
  onAssign: (division: OfficeDivision, staffId: string) => void;
  onRetry: (id: string) => void; onDraft: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string>(() =>
    STAFF.find((person) => person.id === initialSelectedStaffId)?.id ?? 'arka');
  const [selectedDivision, setSelectedDivision] = useState<OfficeDivision>(() =>
    STAFF.find((person) => person.id === initialSelectedStaffId)?.division ?? 'paud');
  const [prayerSchedule, setPrayerSchedule] = useState<PrayerSchedule | null>(null);
  const [prayerScheduleError, setPrayerScheduleError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [executiveOpen, setExecutiveOpen] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<{ limitUsd: number; remainingUsd: number; reset: 'monthly' } | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState('');
  const budgetRequestRef = useRef<AbortController | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const prayerScheduleRef = useRef<PrayerSchedule | null>(null);
  const requestedPrayerDateRef = useRef('');
  const lastPrayerFetchRef = useRef(0);
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      const requestTime = new Date();
      requestedPrayerDateRef.current = jakartaDateKey(requestTime);
      lastPrayerFetchRef.current = Date.now();
      try {
        const schedule = await fetchPrayerSchedule(requestTime, controller.signal);
        if (disposed) return;
        prayerScheduleRef.current = schedule;
        setPrayerSchedule(schedule);
        setPrayerScheduleError('');
      } catch (error) {
        if (disposed || (error instanceof Error && error.name === 'AbortError')) return;
        const message = error instanceof Error ? error.message : 'Jadwal sholat tidak dapat dimuat.';
        console.error('[Jadwal sholat] Gagal memuat jadwal Kuningan:', message);
        setPrayerScheduleError(message);
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      const current = new Date();
      setNow(current);
      const dateChanged = requestedPrayerDateRef.current !== jakartaDateKey(current);
      const retryAfterFailure = !prayerScheduleRef.current && Date.now() - lastPrayerFetchRef.current >= 5 * 60 * 1000;
      const refreshIntervalElapsed = Date.now() - lastPrayerFetchRef.current >= 6 * 60 * 60 * 1000;
      if (dateChanged || retryAfterFailure || refreshIntervalElapsed) void refresh();
    }, 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' &&
          Date.now() - lastPrayerFetchRef.current >= 5 * 60 * 1000) void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      controller?.abort();
      budgetRequestRef.current?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
  const prayerBreak: PrayerBreak | null = activePrayerBreak(prayerSchedule, now);
  const reportDeliveryStaffIds = [...new Set((jobs ?? [])
    .filter((job) => job.status === 'DONE' && job.draftId !== null &&
      (job.division === 'engineer' || job.division === 'creator') &&
      now.getTime() - Date.parse(job.updatedAt) >= 0 && now.getTime() - Date.parse(job.updatedAt) < 90_000)
    .map((job) => job.staffId))];
  const staff = STAFF.find((item) => item.id === selected);
  const selectedRoom = rooms.find((room) => room.division === selectedDivision);
  const divisionStaff = STAFF.filter((person) => person.division === selectedDivision);
  const assigned = jobs?.filter((job) => job.staffId === selected) || [];
  const selectStaff = (staffId: string) => {
    const person = STAFF.find((item) => item.id === staffId);
    if (!person) return;
    setSelected(person.id);
    setSelectedDivision(person.division);
  };
  const openExecutiveSummary = async () => {
    setExecutiveOpen(true);
    setBudgetStatus(null);
    setBudgetError('');
    setBudgetLoading(true);
    budgetRequestRef.current?.abort();
    const controller = new AbortController();
    budgetRequestRef.current = controller;
    try {
      const response = await fetch('/api/workflow/admin/openrouter-budget', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('Sisa batas API hanya tersedia setelah login admin.');
      }
      if (!response.ok) throw new Error(`Status batas API tidak tersedia (HTTP ${response.status}).`);
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('limitUsd' in value) || typeof value.limitUsd !== 'number' ||
          !('remainingUsd' in value) || typeof value.remainingUsd !== 'number' ||
          !('reset' in value) || value.reset !== 'monthly') {
        throw new Error('Format status batas API tidak valid.');
      }
      setBudgetStatus({ limitUsd: value.limitUsd, remainingUsd: value.remainingUsd, reset: 'monthly' });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('[Ringkasan pimpinan] Gagal memuat sisa batas OpenRouter:', error);
      setBudgetError(error instanceof Error ? error.message : 'Sisa batas OpenRouter tidak dapat dimuat.');
    } finally {
      if (!controller.signal.aborted) setBudgetLoading(false);
    }
  };
  const closeExecutiveSummary = () => {
    budgetRequestRef.current?.abort();
    setExecutiveOpen(false);
    setBudgetLoading(false);
  };
  const todayJobs = jobs?.filter((job) => jakartaDateKey(new Date(job.updatedAt)) === jakartaDateKey(now)) ?? null;
  const statusCounts = todayJobs ? {
    running: todayJobs.filter((job) => job.status === 'RUNNING').length,
    queued: todayJobs.filter((job) => job.status === 'QUEUED').length,
    paused: todayJobs.filter((job) => job.status === 'PAUSED').length,
    failed: todayJobs.filter((job) => job.status === 'FAILED').length,
    done: todayJobs.filter((job) => job.status === 'DONE').length,
  } : null;
  return <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Kantor interaktif</p>
        <h3 className="mt-1 text-lg font-bold">Ruang kerja tujuh divisi</h3></div>
      <span className={`rounded-full border px-3 py-1 text-xs ${jobs ? 'border-teal-700 text-teal-200' : 'border-amber-700 text-amber-200'}`}>
        {jobs ? 'Antrean terhubung' : 'Status antrean tidak tersedia'}
      </span>
    </div>
    <p className="text-xs text-slate-400">Pilih staf untuk melihat tugas. Avatar AI bergaya manusia berjalan ke meja saat ada tugas, dan menuju fasilitas saat siaga; animasinya mencakup kedipan, arah pandang, pakaian/penampilan yang bervariasi, mengetik, gestur presentasi, dan gelembung dialog. Ekspresi serta percakapan adalah simulasi visual, bukan aktivitas atau percakapan AI yang benar-benar terjadi. Setelah tugas Engineer/Kreator selesai, animasi dapat mengantar draf ke Ruang Pimpinan; ini simulasi visual, bukan tindakan manusia. Meja, kursi, serta bangunan tetap di tempat.</p>
    <div className={`rounded-lg border p-3 text-sm ${prayerBreak ? 'border-violet-700 bg-violet-950/60 text-violet-100' : 'border-slate-700 bg-slate-900 text-slate-300'}`} role="status">
      {prayerBreak
        ? `Simulasi jeda sholat ${prayerBreak.prayer.name} hingga ${formatJakartaTime(prayerBreak.endsAt)} WIB. Semua avatar menuju mushola; status tugas backend tidak berubah.`
        : prayerSchedule
          ? `Jadwal sholat Kuningan hari ini (WIB): ${prayerSchedule.prayers.map((prayer) => `${prayer.name} ${prayer.time}`).join(' · ')}. Simulasi jeda berlangsung 7 menit sejak waktu sholat.`
          : 'Jadwal sholat Kuningan belum tersedia; simulasi jeda tidak dijalankan.'}
      {prayerScheduleError && <span className="mt-1 block text-amber-300">Pembaruan jadwal gagal: {prayerScheduleError}</span>}
      <span className="mt-1 block text-xs text-slate-400">Sumber: AlAdhan API, metode Kementerian Agama RI, koordinat Kuningan. Cocokkan waktu dengan jadwal masjid/otoritas setempat. Ini simulasi visual avatar, bukan pemantauan atau pelaksanaan ibadah nyata.</span>
    </div>
    <div className="office-building">
      <div className="office-building-header">
        <div><span className="office-building-eyebrow">RASYATECH DIGITAL ZENITH</span><p>Kampus kantor virtual 3D</p></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="office-building-badge">{jobs ? '● ANTREAN TERHUBUNG' : '○ ANTREAN TERPUTUS'}</span>
          <span className="office-building-badge">{drafts ? `${drafts.filter((draft) => draft.status === 'PENDING').length} LAPORAN MENUNGGU` : 'LAPORAN TIDAK TERSEDIA'}</span>
        </div>
      </div>
      <Suspense fallback={<div className="office-3d-loading" role="status">Memuat dunia kantor 3D…</div>}>
        <OfficeWorld3D jobs={jobs} selectedStaffId={selected} prayerBreak={prayerBreak} reportDeliveryStaffIds={reportDeliveryStaffIds} now={now}
          onSelectStaff={selectStaff} onExecutiveClick={() => { void openExecutiveSummary(); }} />
      </Suspense>
      <div className="office-map-controls" role="group" aria-label="Pilih divisi untuk melihat staf">
        {rooms.map((room) => <button key={room.division} type="button" aria-pressed={selectedDivision === room.division}
          className={selectedDivision === room.division ? 'office-map-control-selected' : ''}
          onClick={() => {
            const firstStaff = STAFF.find((person) => person.division === room.division);
            if (firstStaff) {
              setSelectedDivision(room.division);
              setSelected(firstStaff.id);
            }
          }}>{room.name}</button>)}
      </div>
      <div className="office-roster-heading" aria-live="polite">
        <strong>{selectedRoom?.name ?? 'Divisi'} · {divisionStaff.length} staf</strong>
        <span>Pilih nama untuk melihat tugas dan memberi mandat</span>
      </div>
      <div className="office-3d-roster" aria-label={`Pilih staf divisi ${selectedRoom?.name ?? ''}`}>
        {divisionStaff.map((person) => {
          const personJobs = jobs?.filter((job) => job.staffId === person.id) ?? [];
          const active = personJobs.some((job) => job.status === 'RUNNING');
          const queued = personJobs.filter((job) => job.status === 'QUEUED').length;
          const latestFinished = personJobs.filter((job) => job.status === 'DONE' || job.status === 'FAILED')
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          const failed = !active && !queued && latestFinished?.status === 'FAILED';
          const done = !active && !queued && latestFinished?.status === 'DONE';
          const delivering = reportDeliveryStaffIds.includes(person.id);
          const status = prayerBreak ? 'Sholat (simulasi)' : delivering ? 'Mengantar laporan (simulasi)' : !jobs ? 'Tidak diketahui' : active ? 'Bekerja' : queued ? `${queued} antre` : failed ? 'Tugas gagal' : done ? 'Selesai' : 'Siaga';
          return <button key={person.id} type="button" aria-pressed={selected === person.id}
            className={`office-3d-roster-person ${selected === person.id ? 'office-3d-roster-selected' : ''}`}
            onClick={() => selectStaff(person.id)}>
            <span className={`office-legend-dot ${delivering ? 'office-legend-delivering' : active ? 'office-legend-active' : queued ? 'office-legend-queued' : failed ? 'office-legend-failed' : 'office-legend-idle'}`} />
            <span>{person.name}</span><small>{status}</small>
          </button>;
        })}
      </div>
      <div className="office-campus-facilities">
        <span>🕌 Mushola</span><span>🏊 Kolam renang</span><span>🍽️ Dapur &amp; pantry</span><span>🚻 Toilet</span><span>🌳 Taman dan area istirahat</span>
      </div>
    </div>
    {staff && <div ref={detailsRef} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="font-bold">{staff.name} <span className="text-xs font-normal text-slate-400">· {staff.role}</span></h4>
          <p className="text-xs text-slate-400">Status berasal dari antrean aplikasi, bukan aktivitas di sistem luar.</p></div>
        <button type="button" className="min-h-11 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950" onClick={() => onAssign(staff.division, staff.id)}>Beri tugas</button>
      </div>
      {'responsibilities' in staff && staff.responsibilities && <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
        <h5 className="font-semibold text-teal-200">Tupoksi</h5>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
          {staff.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}
        </ul>
        {staff.id === 'finance_manager' && <p className="mt-2 text-xs text-amber-200">Laporan dihitung lokal dari catatan aplikasi; angka transaksi tidak dikirim ke AI. Saldo bank/e-wallet dan pemasukan eksternal belum terhubung.</p>}
        {staff.id === 'marketing_manager' && <p className="mt-2 text-xs text-amber-200">Draf pemasaran diproses AI untuk ditinjau. Aplikasi belum memublikasikan, mengaktifkan tautan, atau memproses pembayaran.</p>}
      </div>}
      {!jobs ? <p className="text-sm text-amber-200">Status tugas tidak tersedia.</p> : assigned.length === 0 ? <p className="text-sm text-slate-400">Belum ada tugas terbaru.</p> :
        assigned.slice(0, 10).map((job) => <div key={job.id} className="rounded-lg border border-slate-700 p-3 text-sm">
          <p className="break-words font-medium">{job.title}</p>
          <p className="mt-1 text-xs text-slate-400">{job.status === 'PAUSED' ? 'Menunggu dipilih di Peluang & Keuangan' : job.status === 'QUEUED' ? 'Menunggu giliran' : job.status === 'RUNNING' ? 'Sedang diproses' : job.status === 'DONE' ? 'Tugas selesai' : 'Gagal diproses'} · {new Date(job.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
          {job.error && <p className="mt-1 text-xs text-rose-300">{job.error}</p>}
          {job.status === 'FAILED' && <button className="mt-2 min-h-10 rounded-lg border border-amber-500 px-3 text-xs text-amber-200" onClick={() => onRetry(job.id)}>Coba lagi</button>}
          {job.status === 'DONE' && job.draftId && <button className="mt-2 min-h-10 rounded-lg border border-teal-500 px-3 text-xs text-teal-200" onClick={() => { if (job.draftId) onDraft(job.draftId); }}>Lihat laporan</button>}
        </div>)}
    </div>}
    {executiveOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeExecutiveSummary();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="executive-summary-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-teal-700 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Pusat komando</p>
            <h3 id="executive-summary-title" className="mt-1 text-xl font-bold">Ringkasan Eksekutif</h3>
            <p className="mt-1 text-xs text-slate-400">{now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full' })} · waktu WIB</p>
          </div>
          <button type="button" aria-label="Tutup ringkasan pimpinan" className="min-h-10 rounded-lg border border-slate-600 px-3 text-sm" onClick={closeExecutiveSummary}>Tutup</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
            <h4 className="font-semibold text-teal-200">Status operasional</h4>
            {statusCounts
              ? <p className="mt-2 text-sm text-slate-300">{statusCounts.running} berjalan · {statusCounts.queued} antre · {statusCounts.paused} menunggu · {statusCounts.done} selesai · {statusCounts.failed} kendala</p>
              : <p className="mt-2 text-sm text-amber-200">Data antrean tidak tersedia.</p>}
            <p className="mt-2 text-xs text-slate-400">{drafts ? `${drafts.filter((draft) => draft.status === 'PENDING').length} draf menunggu tinjauan` : 'Status draf tidak tersedia'}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
            <h4 className="font-semibold text-teal-200">Batas OpenRouter</h4>
            {budgetLoading ? <p role="status" className="mt-2 text-sm text-slate-300">Memuat status batas bulanan…</p>
              : budgetStatus
                ? <p className="mt-2 text-sm text-slate-200">US${budgetStatus.remainingUsd.toFixed(2)} tersisa dari US${budgetStatus.limitUsd.toFixed(2)}</p>
                : budgetError ? <p role="alert" className="mt-2 text-sm text-amber-200">{budgetError}</p>
                  : <p className="mt-2 text-sm text-slate-400">Belum tersedia.</p>}
            <p className="mt-2 text-xs text-slate-400">Sisa batas pengeluaran bulanan API, bukan saldo tunai atau jumlah token. Tidak tersedia untuk browser sebelum login admin.</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <h4 className="font-semibold text-teal-200">Rekap divisi</h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {rooms.map((room) => {
              const divisionJobs = todayJobs?.filter((job) => job.division === room.division);
              const running = divisionJobs?.filter((job) => job.status === 'RUNNING').length ?? 0;
              const queued = divisionJobs?.filter((job) => job.status === 'QUEUED').length ?? 0;
              const failed = divisionJobs?.filter((job) => job.status === 'FAILED').length ?? 0;
              return <li key={room.division} className="rounded-lg border border-slate-800 px-3 py-2 text-sm">
                <strong>{room.name}</strong>
                <span className="block text-xs text-slate-400">{divisionJobs ? `${running} berjalan · ${queued} antre · ${failed} kendala` : 'Status tidak tersedia'}</span>
              </li>;
            })}
          </ul>
        </div>
      </section>
    </div>}
  </section>;
}
