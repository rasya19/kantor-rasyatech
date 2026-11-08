import { useRef, useState, type CSSProperties } from 'react';
import { STAFF } from '../staff';
import type { OfficeDivision, OfficeJob, WorkDraft } from '../workflowTypes';

const rooms: { division: OfficeDivision; name: string; color: string; icon: string }[] = [
  { division: 'paud', name: 'Siput PAUD', color: '#f4a83c', icon: '✦' },
  { division: 'posyandu', name: 'Siput Posyandu', color: '#44b68b', icon: '✚' },
  { division: 'creator', name: 'Content Creator', color: '#cb75b5', icon: '▶' },
  { division: 'engineer', name: 'Web Engineer', color: '#639ddd', icon: '⌘' },
  { division: 'cyber', name: 'Cyber Security', color: '#df7c76', icon: '◆' },
];

export function OfficeScene({ jobs, drafts, onAssign, onRetry, onDraft }: {
  jobs: OfficeJob[] | null; drafts: WorkDraft[] | null;
  onAssign: (division: OfficeDivision, staffId: string) => void;
  onRetry: (id: string) => void; onDraft: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string>('arka');
  const detailsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const staff = STAFF.find((item) => item.id === selected);
  const assigned = jobs?.filter((job) => job.staffId === selected) || [];
  function showRoom(id: string) {
    const viewport = mapRef.current;
    const target = viewport?.querySelector<HTMLElement>(`[data-room="${id}"]`);
    if (viewport && target) viewport.scrollTo({ left: Math.max(0, target.offsetLeft - 16), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Kantor interaktif</p>
        <h3 className="mt-1 text-lg font-bold">Ruang kerja lima divisi</h3></div>
      <span className={`rounded-full border px-3 py-1 text-xs ${jobs ? 'border-teal-700 text-teal-200' : 'border-amber-700 text-amber-200'}`}>
        {jobs ? 'Antrean terhubung' : 'Status antrean tidak tersedia'}
      </span>
    </div>
    <p className="text-xs text-slate-400">Pilih staf untuk melihat tugas. Karakter bergerak saat tugas antreannya diproses; revisi AI langsung dan aktivitas di sistem luar tidak tercakup.</p>
    <div className="office-building">
      <div className="office-building-header">
        <div><span className="office-building-eyebrow">RASYATECH DIGITAL ZENITH</span><p>Kantor AI · Dunia kerja virtual</p></div>
        <span className="office-building-badge">{jobs ? '● ANTREAN TERHUBUNG' : '○ ANTREAN TERPUTUS'}</span>
      </div>
      <div className="office-map-controls" aria-label="Pilih ruang di denah">
        {rooms.map((room) => <button key={room.division} type="button" onClick={() => showRoom(room.division)}>{room.name}</button>)}
        <button type="button" onClick={() => showRoom('pimpinan')}>Ruang pimpinan</button>
      </div>
      <p className="office-map-hint">Geser denah ke samping atau pilih nama ruang untuk menjelajah.</p>
      <div ref={mapRef} className="office-map-viewport" tabIndex={0} role="region" aria-label="Denah kantor, geser ke samping untuk menjelajah">
      <div className="office-world">
        <div className="office-garden" aria-hidden="true"><span className="office-tree" /><span className="office-tree" /><span className="office-path">RASYATECH CAMPUS</span><span className="office-tree" /><span className="office-tree" /></div>
        <div className="office-plan">
      {rooms.map((room) => <section key={room.division} data-room={room.division} className="office-room" style={{ '--room-color': room.color } as CSSProperties} aria-label={`Ruang ${room.name}`}>
        <div className="office-wall"><span className="office-room-icon" aria-hidden="true">{room.icon}</span><h4>{room.name}</h4>
          <span className="office-room-count">{jobs ? `${jobs.filter((job) => job.division === room.division && job.status === 'QUEUED').length} antre` : 'Tidak diketahui'}</span></div>
        <div className="office-floor">
          <div className="office-room-decor" aria-hidden="true"><span className="office-plant" /><span className="office-whiteboard" /><span className="office-cabinet" /></div>
          <div className="office-desks">
          {STAFF.filter((item) => item.division === room.division).map((person) => {
            const personJobs = jobs?.filter((job) => job.staffId === person.id) ?? [];
            const active = personJobs.some((job) => job.status === 'RUNNING');
            const queued = personJobs.filter((job) => job.status === 'QUEUED').length;
            const latestFinished = personJobs.filter((job) => job.status === 'DONE' || job.status === 'FAILED')
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            const failed = !active && !queued && latestFinished?.status === 'FAILED';
            const status = !jobs ? 'Tidak diketahui' : active ? 'Bekerja' : queued ? `${queued} antre` : failed ? 'Tugas gagal' : 'Siaga';
            return <button key={person.id} type="button" aria-pressed={selected === person.id} onClick={() => {
              setSelected(person.id);
              if (window.matchMedia('(max-width: 500px)').matches) {
                detailsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
              }
            }}
              className={`office-workstation ${selected === person.id ? 'office-workstation-selected' : ''} ${active ? 'office-workstation-active' : ''} ${failed ? 'office-workstation-failed' : ''}`}
              aria-label={`${person.name}, ${status}`}>
              <span className="office-workstation-scene" aria-hidden="true">
                <span className="office-task-bubble">{active ? '•••' : failed ? '!' : queued ? '··' : ''}</span>
                <span className="office-chair" />
                <span className={`office-person ${active ? 'office-person-working' : ''}`}><span className="office-person-head" /><span className="office-person-arm office-person-arm-left" /><span className="office-person-arm office-person-arm-right" /></span>
                <span className="office-desk-top"><span className="office-screen" /><span className="office-keyboard" /><span className="office-cup" /></span>
                <span className="office-status-dot" />
              </span>
              <span className="office-person-name">{person.name}</span>
              <span className="office-person-status">{status}</span>
            </button>;
          })}
          </div>
        </div>
      </section>)}
      <div className="office-executive" data-room="pimpinan">
        <div className="office-wall"><span className="office-room-icon" aria-hidden="true">★</span><h4>Ruang pimpinan</h4><span className="office-room-count">Persetujuan</span></div>
        <div className="office-executive-floor">
          <div className="office-executive-desk" aria-hidden="true"><span /></div>
          <div><h4 className="font-bold">Meja Bos Ismanto</h4>
            <p className="mt-1 text-xs">{drafts ? `${drafts.filter((draft) => draft.status === 'PENDING').length} laporan menunggu persetujuan` : 'Jumlah laporan tidak tersedia'}</p>
            <p className="mt-2 text-xs">Tindakan keluar dilakukan manual setelah persetujuan.</p></div>
        </div>
      </div>
      </div>
      <div className="office-corridor" aria-hidden="true"><span /> KORIDOR KANTOR <span /></div>
      </div>
      </div>
    </div>
    {staff && <div ref={detailsRef} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="font-bold">{staff.name} <span className="text-xs font-normal text-slate-400">· {staff.role}</span></h4>
          <p className="text-xs text-slate-400">Status berasal dari antrean aplikasi, bukan aktivitas di sistem luar.</p></div>
        <button type="button" className="min-h-11 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950" onClick={() => onAssign(staff.division, staff.id)}>Beri tugas</button>
      </div>
      {!jobs ? <p className="text-sm text-amber-200">Status tugas tidak tersedia.</p> : assigned.length === 0 ? <p className="text-sm text-slate-400">Belum ada tugas terbaru.</p> :
        assigned.slice(0, 10).map((job) => <div key={job.id} className="rounded-lg border border-slate-700 p-3 text-sm">
          <p className="break-words font-medium">{job.title}</p>
          <p className="mt-1 text-xs text-slate-400">{job.status === 'QUEUED' ? 'Menunggu giliran' : job.status === 'RUNNING' ? 'Sedang diproses' : job.status === 'DONE' ? 'Tugas selesai' : 'Gagal diproses'} · {new Date(job.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
          {job.error && <p className="mt-1 text-xs text-rose-300">{job.error}</p>}
          {job.status === 'FAILED' && <button className="mt-2 min-h-10 rounded-lg border border-amber-500 px-3 text-xs text-amber-200" onClick={() => onRetry(job.id)}>Coba lagi</button>}
          {job.status === 'DONE' && job.draftId && <button className="mt-2 min-h-10 rounded-lg border border-teal-500 px-3 text-xs text-teal-200" onClick={() => { if (job.draftId) onDraft(job.draftId); }}>Lihat laporan</button>}
        </div>)}
    </div>}
  </section>;
}
