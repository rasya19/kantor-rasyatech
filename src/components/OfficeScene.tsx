import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ACTIVE_STAFF, CORE_ROOMS, coreRoomForStaff, getRoomStaff, STAFF, type CoreRoomId } from '../staff';
import type { OfficeDivision, OfficeJob, WorkDraft } from '../workflowTypes';
import { activePrayerBreak, fetchPrayerSchedule, formatJakartaTime, jakartaDateKey } from '../lib/prayerSchedule';
import type { PrayerBreak, PrayerSchedule } from '../lib/prayerSchedule';

const OfficeWorld3D = lazy(() => import('./OfficeWorld3D').then((module) => ({ default: module.OfficeWorld3D })));

export function OfficeScene({ jobs, drafts, initialSelectedStaffId, onAssign, onRetry, onDraft }: {
  jobs: OfficeJob[] | null; drafts: WorkDraft[] | null;
  initialSelectedStaffId?: string;
  onAssign: (division: OfficeDivision, staffId: string) => void;
  onRetry: (id: string) => void; onDraft: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string>(() =>
    ACTIVE_STAFF.find((person) => person.id === initialSelectedStaffId)?.id ?? 'strategist');
  const [selectedRoomId, setSelectedRoomId] = useState<CoreRoomId>(() =>
    coreRoomForStaff(ACTIVE_STAFF.find((person) => person.id === initialSelectedStaffId)?.id ?? 'strategist'));
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
      ACTIVE_STAFF.some((person) => person.id === job.staffId) &&
      now.getTime() - Date.parse(job.updatedAt) >= 0 && now.getTime() - Date.parse(job.updatedAt) < 90_000)
    .map((job) => job.staffId))];
  const staff = STAFF.find((item) => item.id === selected);
  const selectedRoom = CORE_ROOMS.find((room) => room.id === selectedRoomId) ?? CORE_ROOMS[0];
  const divisionStaff = getRoomStaff(selectedRoom.id);
  const assigned = jobs?.filter((job) => job.staffId === selected) || [];

  const selectStaff = (staffId: string) => {
    const person = ACTIVE_STAFF.find((item) => item.id === staffId);
    if (!person) return;
    setSelected(person.id);
    setSelectedRoomId(coreRoomForStaff(person.id));
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="app-eyebrow">Kantor interaktif · Ramping &amp; Fokus Revenue</p>
          <h3 className="mt-0.5 text-lg font-extrabold text-slate-900">Ruang kerja tiga divisi inti</h3>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${jobs ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <span className={`h-2 w-2 rounded-full ${jobs ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {jobs ? 'Antrean terhubung' : 'Status antrean tidak tersedia'}
        </span>
      </div>

      <div className={`rounded-2xl border p-3.5 text-xs leading-relaxed ${prayerBreak ? 'border-violet-200 bg-violet-50 text-violet-900' : 'border-slate-200 bg-slate-50/80 text-slate-700'}`} role="status">
        <p className="font-semibold">
          {prayerBreak
            ? `Simulasi jeda sholat ${prayerBreak.prayer.name} hingga ${formatJakartaTime(prayerBreak.endsAt)} WIB. Semua avatar menuju mushola; status tugas backend tidak berubah.`
            : prayerSchedule
              ? `Jadwal sholat Kuningan hari ini (WIB): ${prayerSchedule.prayers.map((prayer) => `${prayer.name} ${prayer.time}`).join(' · ')}. Simulasi jeda berlangsung 7 menit sejak waktu sholat.`
              : 'Jadwal sholat Kuningan belum tersedia; simulasi jeda tidak dijalankan.'}
        </p>
        {prayerScheduleError && <span className="mt-1 block font-medium text-amber-700">Pembaruan jadwal gagal: {prayerScheduleError}</span>}
        <span className="mt-1 block text-slate-500">Sumber: AlAdhan API, metode Kementerian Agama RI, koordinat Kuningan. Cocokkan waktu dengan jadwal masjid/otoritas setempat. Ini simulasi visual avatar, bukan pemantauan atau pelaksanaan ibadah nyata.</span>
      </div>

      <div className="office-building">
        <div className="office-building-header">
          <div>
            <span className="office-building-eyebrow">RASYATECH DIGITAL ZENITH</span>
            <p>Kampus kantor virtual 3D</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="office-building-badge">{jobs ? '● ANTREAN TERHUBUNG' : '○ ANTREAN TERPUTUS'}</span>
            <span className="office-building-badge">{drafts ? `${drafts.filter((draft) => draft.status === 'PENDING').length} LAPORAN MENUNGGU` : 'LAPORAN TIDAK TERSEDIA'}</span>
          </div>
        </div>
        <Suspense fallback={<div className="office-3d-loading" role="status">Memuat dunia kantor 3D…</div>}>
          <OfficeWorld3D
            jobs={jobs}
            selectedStaffId={selected}
            prayerBreak={prayerBreak}
            reportDeliveryStaffIds={reportDeliveryStaffIds}
            now={now}
            onSelectStaff={selectStaff}
            onExecutiveClick={() => { void openExecutiveSummary(); }}
          />
        </Suspense>
        <div className="office-map-controls" role="group" aria-label="Pilih divisi untuk melihat staf">
          {CORE_ROOMS.map((room) => (
            <button
              key={room.id}
              type="button"
              aria-pressed={selectedRoomId === room.id}
              className={selectedRoomId === room.id ? 'office-map-control-selected' : ''}
              onClick={() => {
                const firstStaff = getRoomStaff(room.id)[0];
                if (firstStaff) {
                  setSelectedRoomId(room.id);
                  setSelected(firstStaff.id);
                }
              }}
            >
              {room.name}
            </button>
          ))}
        </div>
        <div className="office-roster-heading" aria-live="polite">
          <strong>{selectedRoom.name} · {divisionStaff.length} staf</strong>
          <span>Pilih nama untuk melihat tugas dan memberi mandat</span>
        </div>
        <div className="office-3d-roster" aria-label={`Pilih staf divisi ${selectedRoom.name}`}>
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
            return (
              <button
                key={person.id}
                type="button"
                aria-pressed={selected === person.id}
                className={`office-3d-roster-person ${selected === person.id ? 'office-3d-roster-selected' : ''}`}
                onClick={() => selectStaff(person.id)}
              >
                <span className={`office-legend-dot ${delivering ? 'office-legend-delivering' : active ? 'office-legend-active' : queued ? 'office-legend-queued' : failed ? 'office-legend-failed' : 'office-legend-idle'}`} />
                <span>{person.name}</span><small>{status}</small>
              </button>
            );
          })}
        </div>
        <div className="office-campus-facilities">
          <span>🕌 Mushola</span><span>🏊 Kolam renang</span><span>🍽️ Dapur &amp; pantry</span><span>🚻 Toilet</span><span>🌳 Taman dan area istirahat</span>
        </div>
      </div>

      {staff && (
        <div ref={detailsRef} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-bold">{staff.name} <span className="text-xs font-medium text-slate-500">· {staff.role}</span></h4>
              <p className="mt-0.5 text-xs text-slate-500">Status berasal dari antrean aplikasi, bukan aktivitas di sistem luar.</p>
            </div>
            <button
              type="button"
              className="min-h-11 rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-teal-900/10 transition hover:bg-teal-700"
              onClick={() => onAssign(staff.division, staff.id)}
            >
              Beri tugas
            </button>
          </div>
          {'responsibilities' in staff && staff.responsibilities && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-sm">
              <h5 className="font-bold text-teal-900">Tupoksi</h5>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {staff.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}
              </ul>
              {staff.id === 'marketing_manager' && <p className="mt-2.5 text-xs font-medium text-amber-800">Draf pemasaran diproses AI untuk ditinjau. Aplikasi belum memublikasikan, mengaktifkan tautan, atau memproses pembayaran.</p>}
            </div>
          )}
          <div className="space-y-2.5">
            {!jobs ? <p className="text-sm font-medium text-amber-700">Status tugas tidak tersedia.</p> : assigned.length === 0 ? <p className="text-sm text-slate-500">Belum ada tugas terbaru.</p> :
              assigned.slice(0, 10).map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm">
                  <p className="break-words font-semibold text-slate-900">{job.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {job.status === 'PAUSED' ? 'Menunggu dipilih di Bisnis & Kas' : job.status === 'QUEUED' ? 'Menunggu giliran' : job.status === 'RUNNING' ? 'Sedang diproses' : job.status === 'DONE' ? 'Tugas selesai' : 'Gagal diproses'} · {new Date(job.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
                  </p>
                  {job.error && <p className="mt-1.5 text-xs font-medium text-rose-700">{job.error}</p>}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {job.status === 'FAILED' && (
                      <button className="min-h-10 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-bold text-amber-800 hover:bg-amber-100" onClick={() => onRetry(job.id)}>Coba lagi</button>
                    )}
                    {job.status === 'DONE' && job.draftId && (
                      <button className="min-h-10 rounded-xl border border-teal-200 bg-white px-3.5 text-xs font-bold text-teal-800 hover:bg-teal-50" onClick={() => { if (job.draftId) onDraft(job.draftId); }}>Lihat laporan</button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <details className="office-info-box">
        <summary>Tentang simulasi visual avatar &amp; animasi kantor 3D</summary>
        <p className="mt-2 leading-relaxed text-slate-600">
          Pilih staf untuk melihat tugas. Avatar AI bergaya manusia berjalan ke meja saat ada tugas, dan menuju fasilitas saat siaga; animasinya mencakup kedipan, arah pandang, pakaian/penampilan yang bervariasi, mengetik, gestur presentasi, dan gelembung dialog. Ekspresi serta percakapan adalah simulasi visual, bukan aktivitas atau percakapan AI yang benar-benar terjadi. Setelah tugas selesai, animasi dapat mengantar draf ke Ruang Pimpinan; ini simulasi visual, bukan tindakan manusia. Meja, kursi, serta bangunan tetap di tempat.
        </p>
      </details>

      {executiveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeExecutiveSummary();
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="executive-summary-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="app-eyebrow">Pusat komando</p>
                <h3 id="executive-summary-title" className="mt-1 text-xl font-extrabold">Ringkasan Eksekutif</h3>
                <p className="mt-1 text-xs text-slate-500">{now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full' })} · waktu WIB</p>
              </div>
              <button type="button" aria-label="Tutup ringkasan pimpinan" className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={closeExecutiveSummary}>Tutup</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-bold text-teal-800">Status operasional</h4>
                {statusCounts
                  ? <p className="mt-2 text-sm font-medium text-slate-700">{statusCounts.running} berjalan · {statusCounts.queued} antre · {statusCounts.paused} menunggu · {statusCounts.done} selesai · {statusCounts.failed} kendala</p>
                  : <p className="mt-2 text-sm text-amber-700">Data antrean tidak tersedia.</p>}
                <p className="mt-2 text-xs text-slate-500">{drafts ? `${drafts.filter((draft) => draft.status === 'PENDING').length} draf menunggu tinjauan` : 'Status draf tidak tersedia'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-bold text-teal-800">Batas OpenRouter</h4>
                {budgetLoading ? <p role="status" className="mt-2 text-sm text-slate-600">Memuat status batas bulanan…</p>
                  : budgetStatus
                    ? <p className="mt-2 text-sm font-bold text-slate-900">US${budgetStatus.remainingUsd.toFixed(2)} tersisa dari US${budgetStatus.limitUsd.toFixed(2)}</p>
                    : budgetError ? <p role="alert" className="mt-2 text-sm font-medium text-amber-700">{budgetError}</p>
                      : <p className="mt-2 text-sm text-slate-500">Belum tersedia.</p>}
                <p className="mt-2 text-xs text-slate-500">Sisa batas pengeluaran bulanan API, bukan saldo tunai atau jumlah token. Tidak tersedia untuk browser sebelum login admin.</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-bold text-teal-800">Rekap divisi inti</h4>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {CORE_ROOMS.map((room) => {
                  const roomJobs = todayJobs?.filter((job) => (room.staffIds as readonly string[]).includes(job.staffId));
                  const running = roomJobs?.filter((job) => job.status === 'RUNNING').length ?? 0;
                  const queued = roomJobs?.filter((job) => job.status === 'QUEUED').length ?? 0;
                  const failed = roomJobs?.filter((job) => job.status === 'FAILED').length ?? 0;
                  return (
                    <li key={room.id} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm">
                      <strong className="text-slate-900">{room.name}</strong>
                      <span className="mt-0.5 block text-xs text-slate-500">{roomJobs ? `${running} berjalan · ${queued} antre · ${failed} kendala` : 'Status tidak tersedia'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
