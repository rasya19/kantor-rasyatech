import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ClipboardCheck, Film, Headphones, LayoutDashboard, Menu, X } from 'lucide-react';
import { workflowClient } from './api/workflowClient';
import type { DraftEvent, OfficeJob, OfficeDivision, Ticket, TicketCategory, TicketDivision, TicketStatus, VideoJob, WorkDraft } from './workflowTypes';
import { OfficeScene } from './components/OfficeScene';
import { InstallApp } from './components/InstallApp';
import { STAFF } from './staff';

const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-base text-white';
const button = 'min-h-11 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50';
const secondary = 'min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100 disabled:opacity-50';
const panel = 'rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4';
const labels: Record<TicketStatus, string> = {
  OPEN: 'Baru', IN_PROGRESS: 'Sedang ditangani', WAITING: 'Menunggu', RESOLVED: 'Selesai',
};
const divisions = [
  { id: 'paud', title: 'Siput PAUD', staff: 'Arka · Lisa · Dewi', focus: 'Laporan klien, kendala PAUD, panduan dan draf jawaban.' },
  { id: 'posyandu', title: 'Siput Posyandu', staff: 'Dr. AI · Budi · Sari', focus: 'Laporan aplikasi kader, pertanyaan, dan alur pelaporan.' },
  { id: 'creator', title: 'Content Creator', staff: 'Trendy · Script-AI · Clipper', focus: 'Ide, hook, naskah 9:16, caption dan peluang monetisasi.' },
  { id: 'engineer', title: 'Web App Engineer', staff: 'Dev-Ops · Code-AI · Architect', focus: 'Analisis arsitektur, database, dan rencana teknis.' },
  { id: 'cyber', title: 'Cyber Security', staff: 'Sentinel · Guard-AI · Audit', focus: 'Laporan keamanan, usulan audit log, perlindungan data, dan mitigasi risiko.' },
] as const;
type Tab = 'dashboard' | 'map' | 'drafts' | 'publication' | 'staff' | 'engineer' | 'cyber' | 'history' | 'tickets' | 'content' | 'guide' | 'mandate';

function OfficeNavigation({ tab, pendingCount, navigate }: {
  tab: Tab;
  pendingCount: number | null;
  navigate: (tab: Tab) => void;
}) {
  const items: [Tab, string][] = [
    ['dashboard', '📊 Dashboard Utama'],
    ['map', '🗺️ Denah Isometrik'],
    ['drafts', `✅ Daftar Persetujuan (${pendingCount ?? '?'})`],
    ['publication', '📣 Siap Publikasi'],
    ['staff', '👥 Staf Virtual'],
    ['engineer', '💻 Ruang Web Engineer'],
    ['cyber', '🛡️ Cyber Security'],
    ['history', '📜 Riwayat Sistem'],
    ['tickets', '🎧 Layanan Klien'],
    ['content', '🎬 Konten Kreator'],
    ['guide', '📘 Alur Kerja'],
  ];
  return <>
    <nav className="mt-5 grid gap-1" aria-label="Menu kantor">
      {items.map(([id, label]) => (
        <button key={id} type="button" onClick={() => navigate(id)} aria-current={tab === id ? 'page' : undefined}
          className={`min-h-11 rounded-lg px-3 py-2 text-left text-sm ${tab === id ? 'bg-teal-500/20 text-teal-300' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</button>
      ))}
    </nav>
    <button className={`${button} mt-5 w-full`} onClick={() => navigate('mandate')}>🚀 Beri Mandat Bos</button>
    <div className="mt-3"><InstallApp /></div>
  </>;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [drafts, setDrafts] = useState<WorkDraft[]>([]);
  const [draftsAvailable, setDraftsAvailable] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [division, setDivision] = useState<TicketDivision>('paud');
  const [category, setCategory] = useState<TicketCategory>('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TicketStatus>('OPEN');
  const [notes, setNotes] = useState('');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [revision, setRevision] = useState('');
  const [mandateDivision, setMandateDivision] = useState<WorkDraft['division']>('paud');
  const [mandate, setMandate] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [jobs, setJobs] = useState<OfficeJob[] | null>(null);
  const [videos, setVideos] = useState<{ enabled: boolean; jobs: VideoJob[] } | null>(null);
  const [continuation, setContinuation] = useState<{ id: string; eligible: boolean; forwarded: boolean } | null>(null);
  const [mandateStaff, setMandateStaff] = useState('arka');
  const completedJobs = useRef('');
  const menuRef = useRef<HTMLDialogElement>(null);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId);
  const pendingCount = draftsAvailable ? drafts.filter((draft) => draft.status === 'PENDING').length : null;
  const readyForPublication = drafts.filter((draft) => draft.contentPackageVersion === 1 && draft.status === 'APPROVED');
  const selectedVideo = videos?.jobs.find((job) => job.draftId === selectedDraftId);

  const loadVideos = useCallback(async () => {
    try { setVideos(await workflowClient.videos()); }
    catch (err) { setVideos(null); throw err; }
  }, []);

  useEffect(() => {
    let active = true;
    const poll = () => { void loadVideos().catch((err) => { if (active) setError(`Status video tidak tersedia: ${message(err)}`); }); };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [loadVideos]);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const [ticketData, draftData] = await Promise.all([workflowClient.tickets(), workflowClient.drafts()]);
      setTickets(ticketData.tickets);
      setDrafts(draftData.drafts);
      setDraftsAvailable(true);
    } catch (error) {
      setDraftsAvailable(false);
      throw error;
    }
  }, []);

  useEffect(() => {
    load().catch((err) => setError(message(err)));
    const timer = setInterval(() => {
      load().catch((err) => setError(message(err)));
    }, 60000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const snapshot = await workflowClient.jobs();
        if (active) {
          setJobs(snapshot.jobs);
          const completed = snapshot.jobs.filter((job) => job.status === 'DONE').map((job) => job.id).join(',');
          if (completed !== completedJobs.current) {
            completedJobs.current = completed;
            void load().catch((err) => setError(message(err)));
          }
        }
      } catch (err) {
        if (active) {
          console.warn('[Antrean] Status tidak tersedia:', err);
          setJobs(null);
        }
      } finally {
        if (active) timer = setTimeout(poll, 3000);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    if (selectedTicket) {
      setStatus(selectedTicket.status);
      setNotes(selectedTicket.notes);
    }
  }, [selectedTicketId, selectedTicket?.updatedAt]);

  useEffect(() => {
    setContent(selectedDraft?.content || '');
    setRevision('');
    setEvents([]);
  }, [selectedDraftId, selectedDraft?.updatedAt]);

  useEffect(() => {
    setContinuation(null);
    if (!selectedDraft || selectedDraft.division !== 'creator' || selectedDraft.status !== 'APPROVED') return;
    let active = true;
    workflowClient.contentContinuation(selectedDraft.id).then((result) => {
      if (active) setContinuation({ id: selectedDraft.id, ...result });
    }).catch((err) => { if (active) setError(`Status penerusan tidak tersedia: ${message(err)}`); });
    return () => { active = false; };
  }, [selectedDraftId, selectedDraft?.updatedAt, selectedDraft?.status, selectedDraft?.division]);

  async function run(action: () => Promise<void>, success?: string) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await action();
      if (success) setNotice(success);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  function addDraft(draft: WorkDraft) {
    setDrafts((old) => [draft, ...old.filter((item) => item.id !== draft.id)]);
    setSelectedDraftId(draft.id);
    setTab('drafts');
  }

  function submitTicket(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const { ticket } = await workflowClient.enqueueTicket({ division, category, title, description });
      setTickets((old) => [ticket, ...old]);
      setSelectedTicketId(ticket.id);
      setTitle('');
      setDescription('');
    }, 'Laporan tersimpan dan ditambahkan ke antrean staf.');
  }

  const sceneProps = {
    jobs,
    drafts: draftsAvailable ? drafts : null,
    onAssign: (next: OfficeDivision, staffId: string) => {
      setMandateDivision(next);
      setMandateStaff(staffId);
      setTab('mandate');
    },
    onRetry: (id: string) => void run(async () => {
      await workflowClient.retryJob(id);
    }, 'Tugas dikembalikan ke antrean.'),
    onDraft: (id: string) => void run(async () => {
      await load();
      setSelectedDraftId(id);
      setTab('drafts');
    }),
  };

  function updateDraft(action: 'EDIT' | 'APPROVE' | 'REVISE') {
    if (!selectedDraft) return;
    if (action !== 'EDIT' && content !== selectedDraft.content) {
      setError('Simpan perubahan isi terlebih dahulu sebelum menyetujui atau meminta revisi.');
      return;
    }
    void run(async () => {
      const result = await workflowClient.updateDraft(selectedDraft.id, { action, content, notes: revision });
      addDraft(result.draft);
      if (action === 'APPROVE' && selectedDraft.contentPackageVersion === 1) await loadVideos();
    }, action === 'APPROVE'
      ? selectedDraft.contentPackageVersion === 1
        ? 'Paket disetujui. Periksa status video di Siap Publikasi; belum ada konten yang dipublikasikan.'
        : 'Draf disetujui untuk tindak lanjut manual. Belum ada pesan dikirim atau konten dipublikasikan.'
      : 'Draf tersimpan dan menunggu persetujuan.');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <aside className="hidden overflow-y-auto border-r border-slate-800 bg-slate-900 p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-72 lg:shrink-0">
        <h1 className="text-lg font-bold">PT Rasyatech Digital Zenith</h1>
        <p className="mt-1 text-xs text-teal-300">Kantor AI Bos Ismanto</p>
        <OfficeNavigation tab={tab} pendingCount={pendingCount} navigate={setTab} />
      </aside>
      <dialog ref={menuRef} aria-labelledby="mobile-menu-title"
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(85vw,320px)] max-w-none overflow-y-auto border-r border-slate-700 bg-slate-900 p-4 text-slate-100 backdrop:bg-black/70 lg:hidden"
        onClick={(event) => { if (event.target === event.currentTarget) menuRef.current?.close(); }}>
        <div className="flex items-start justify-between gap-2">
          <div><h2 id="mobile-menu-title" className="font-bold">Kantor AI Rasyatech</h2><p className="mt-1 text-xs text-teal-300">Menu kantor</p></div>
          <button type="button" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800" aria-label="Tutup menu" onClick={() => menuRef.current?.close()}><X size={22} /></button>
        </div>
        <OfficeNavigation tab={tab} pendingCount={pendingCount} navigate={(next) => { setTab(next); menuRef.current?.close(); }} />
      </dialog>
      <div className="min-w-0 flex-1">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-2 backdrop-blur lg:hidden">
        <div><p className="text-sm font-bold">Kantor AI Rasyatech</p><p className="text-xs text-teal-300">Meja Bos Ismanto</p></div>
        <button type="button" className="rounded-xl border border-slate-700 p-2.5 text-slate-100" aria-label="Buka menu" onClick={() => menuRef.current?.showModal()}><Menu size={21} /></button>
      </div>
      <main className="mobile-content-space mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:pb-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">Laporan dahulu · persetujuan pimpinan · tindak lanjut manual</p>
          <button className={secondary} disabled={busy} onClick={() => void run(load, 'Data diperbarui.')}>Muat ulang</button>
        </header>
        {!online && <div role="status" className="rounded-lg border border-amber-700 bg-amber-950 p-3 text-sm text-amber-200">Anda sedang offline. Data tidak disimpan di perangkat; sambungkan kembali sebelum melanjutkan.</div>}
        {error && <div role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-teal-800 bg-teal-950 p-3 text-sm text-teal-200">{notice}</div>}

        {tab === 'dashboard' && <section className={panel}>
          <h2 className="text-xl font-bold">Dashboard Utama</h2>
          <p className="text-sm text-slate-300">Lima divisi siap menyusun laporan saat diminta. Sistem tidak memantau produk atau melayani klien secara otomatis.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-950 p-4"><span className="text-slate-400">Laporan klien</span><p className="text-2xl font-bold">{draftsAvailable ? tickets.length : '—'}</p></div>
            <div className="rounded-lg bg-slate-950 p-4"><span className="text-slate-400">Menunggu persetujuan</span><p className="text-2xl font-bold">{pendingCount ?? '—'}</p></div>
            <div className="rounded-lg bg-slate-950 p-4"><span className="text-slate-400">Disetujui</span><p className="text-2xl font-bold">{draftsAvailable ? drafts.filter((draft) => draft.status === 'APPROVED').length : '—'}</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setTab('tickets')}>Catat laporan klien</button><button className={secondary} onClick={() => setTab('content')}>Buat konten</button></div>
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-bold">Aktivitas antrean staf</h3>
                <p className="mt-1 text-xs text-slate-400">Ringkasan tugas antrean, bukan aktivitas di sistem luar.</p></div>
              <button className={secondary} onClick={() => setTab('map')}>Buka denah kantor</button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-slate-900 p-3"><span className="text-xs text-slate-400">Staf bekerja</span><p className="text-xl font-bold text-teal-300">{jobs ? new Set(jobs.filter((job) => job.status === 'RUNNING').map((job) => job.staffId)).size : '—'}</p></div>
              <div className="rounded-lg bg-slate-900 p-3"><span className="text-xs text-slate-400">Tugas antre</span><p className="text-xl font-bold">{jobs ? jobs.filter((job) => job.status === 'QUEUED').length : '—'}</p></div>
              <div className="rounded-lg bg-slate-900 p-3"><span className="text-xs text-slate-400">Gagal terbaru*</span><p className="text-xl font-bold text-amber-300">{jobs ? jobs.filter((job) => job.status === 'FAILED').length : '—'}</p></div>
            </div>
            <p className="mt-2 text-xs text-slate-400">{jobs ? '*Dari 100 tugas terakhir yang selesai atau gagal.' : 'Status antrean tidak tersedia.'}</p>
          </div>
          <p className="text-xs text-slate-400">Jadwal harian hanya berjalan saat server, database, dan penyedia AI tersedia; layanan 24/7 memerlukan hosting dan pemantauan terpisah.</p>
        </section>}

        {(tab === 'map' || tab === 'staff') && <section className={panel}>
          <h2 className="text-lg font-bold">{tab === 'map' ? 'Denah Isometrik Kantor Virtual' : 'Staf Virtual · 5 Divisi'}</h2>
          <p className="text-sm text-slate-400">Pembagian peran virtual untuk penyusunan laporan; bukan pegawai yang memantau sistem secara langsung.</p>
          {tab === 'map' && <OfficeScene {...sceneProps} />}
          <div className="grid gap-4 sm:grid-cols-2">
            {divisions.map((item) => <div key={item.id} className="rounded-xl border border-teal-800/50 bg-slate-950 p-5 shadow-lg">
              <h3 className="font-bold text-teal-300">{item.title}</h3>
              <p className="mt-2 text-sm text-white">{item.staff}</p><p className="mt-2 text-sm text-slate-400">{item.focus}</p>
              <button className={`${secondary} mt-4`} onClick={() => { setMandateDivision(item.id); setMandateStaff(STAFF.find((staff) => staff.division === item.id)!.id); setTab('mandate'); }}>Beri mandat divisi</button>
            </div>)}
          </div>
        </section>}

        {(tab === 'engineer' || tab === 'cyber' || tab === 'mandate') && <section className={panel}>
          <h2 className="text-lg font-bold">{tab === 'engineer' ? 'Ruang Kerja Web App Engineer' : tab === 'cyber' ? 'Ruang Cyber Security' : 'Mandat Bos'}</h2>
          <p className="text-sm text-slate-300">Mandat menghasilkan laporan untuk pimpinan, bukan akses repository, perubahan kode, eksekusi query, atau deployment. Kode mentah hanya disiapkan bila diminta secara eksplisit.</p>
          <p className="text-xs text-amber-300">Instruksi dikirim ke Gemini atau Copilot sesuai konfigurasi. Jangan sertakan kode sensitif, kredensial, data anak, data kesehatan, atau data pribadi.</p>
          {tab === 'cyber' && <div className="space-y-2 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
            <p><strong>Sentinel · Guard-AI · Audit:</strong> susun rekomendasi pemantauan, audit log, perlindungan data, dan mitigasi berdasarkan informasi yang diberikan.</p>
            <p>Belum terhubung ke log, database produk, pemindai keamanan, atau sistem eksternal. Tidak ada pemantauan atau audit otomatis. Jangan masukkan kredensial, data pribadi, atau log mentah sensitif.</p>
          </div>}
          {tab === 'engineer' && <div className="text-sm text-slate-400">
            Repository rujukan: <a className="text-teal-300 underline" href="https://github.com/rasya19/siputv1" target="_blank" rel="noreferrer">Siput PAUD</a> · <a className="text-teal-300 underline" href="https://github.com/rasya19/Posyandu" target="_blank" rel="noreferrer">Siput Posyandu</a>. Aplikasi belum terhubung ke GitHub.
          </div>}
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const target = tab === 'engineer' || tab === 'cyber' ? tab : mandateDivision;
              const chosen = STAFF.find((person) => person.id === mandateStaff && person.division === target) || STAFF.find((person) => person.division === target);
              if (!chosen) throw new Error('Staf untuk divisi tidak ditemukan.');
              await workflowClient.enqueue(target, chosen.id, mandate);
              setMandate('');
              setTab('map');
            }, 'Tugas ditambahkan ke antrean. Laporan akan muncul setelah selesai.');
          }}>
            {tab === 'mandate' && <label className="block text-sm">Divisi
              <select className={field} value={mandateDivision} onChange={(e) => {
                const next = e.target.value as WorkDraft['division'];
                setMandateDivision(next);
                setMandateStaff(STAFF.find((person) => person.division === next)!.id);
              }}>
                {divisions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>}
            <label className="block text-sm">Staf penanggung jawab
              <select className={field}
                value={STAFF.some((person) => person.id === mandateStaff && person.division === (tab === 'engineer' || tab === 'cyber' ? tab : mandateDivision)) ? mandateStaff : STAFF.find((person) => person.division === (tab === 'engineer' || tab === 'cyber' ? tab : mandateDivision))?.id}
                onChange={(event) => setMandateStaff(event.target.value)}>
                {STAFF.filter((person) => person.division === (tab === 'engineer' || tab === 'cyber' ? tab : mandateDivision)).map((person) =>
                  <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}
              </select>
            </label>
            <label className="block text-sm">Instruksi
              <textarea className={field} required maxLength={8000} rows={5} value={mandate} onChange={(e) => setMandate(e.target.value)} placeholder="Jelaskan masalah, tujuan, batasan, dan hasil laporan yang diharapkan. Jangan sertakan data pribadi atau rahasia." />
            </label>
            <button className={button} disabled={busy}>Siapkan laporan AI</button>
          </form>
        </section>}

        {tab === 'history' && <section className={panel}>
          <h2 className="text-lg font-bold">Riwayat Sistem</h2>
          <p className="text-sm text-slate-400">Riwayat laporan dan persetujuan; ini bukan bukti pengiriman atau publikasi.</p>
          {drafts.length === 0 && <p className="text-sm text-slate-400">Belum ada riwayat.</p>}
          {drafts.map((draft) => <button key={draft.id} className="block w-full rounded-lg border border-slate-700 p-3 text-left text-sm" onClick={() => { setSelectedDraftId(draft.id); setTab('drafts'); }}>
            <strong>{draft.title}</strong><span className="block text-slate-400">{draft.status === 'APPROVED' ? 'Disetujui' : draft.status === 'INTERMEDIATE' ? 'Tahap perantara' : 'Menunggu'} · {new Date(draft.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</span>
          </button>)}
        </section>}

        {tab === 'tickets' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <form className={panel} onSubmit={submitTicket}>
              <h2 className="text-lg font-bold">Catat laporan dari WhatsApp Business</h2>
              <p className="text-sm text-amber-300">Input manual. Jangan masukkan nomor telepon, nama klien, kredensial, data anak, atau data kesehatan. Setelah disimpan, isi laporan otomatis masuk antrean dan dikirim ke penyedia AI yang dikonfigurasi (Gemini atau Copilot).</p>
              <label className="block text-sm">Produk
                <select className={field} value={division} onChange={(e) => setDivision(e.target.value as TicketDivision)}>
                  <option value="paud">Siput PAUD</option><option value="posyandu">Siput Posyandu</option>
                </select>
              </label>
              <label className="block text-sm">Jenis laporan
                <select className={field} value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                  <option value="BUG">Bug / error</option><option value="QUESTION">Pertanyaan</option><option value="COMPLAINT">Keluhan</option>
                </select>
              </label>
              <label className="block text-sm">Judul
                <input className={field} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="block text-sm">Kronologi tanpa data pribadi
                <textarea className={field} required maxLength={8000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Apa yang terjadi, langkah sebelum error, hasil yang diharapkan, dan pesan error yang sudah disamarkan?" />
              </label>
              <button className={button} disabled={busy}>Simpan laporan</button>
            </form>
            <section className={panel}>
              <h2 className="text-lg font-bold">Antrean klien ({tickets.length})</h2>
              <div className="max-h-64 space-y-2 overflow-auto">
                {tickets.length === 0 && <p className="text-sm text-slate-400">Belum ada laporan.</p>}
                {tickets.map((ticket) => (
                  <button key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${ticket.id === selectedTicketId ? 'border-teal-400' : 'border-slate-700'}`}>
                    <strong>{ticket.title}</strong><span className="block text-slate-400">{ticket.division.toUpperCase()} · {ticket.category} · {labels[ticket.status]}</span>
                  </button>
                ))}
              </div>
              {selectedTicket && <>
                <div className="whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-sm">{selectedTicket.description}</div>
                <label className="block text-sm">Status
                  <select className={field} value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                    {(Object.keys(labels) as TicketStatus[]).map((key) => <option key={key} value={key}>{labels[key]}</option>)}
                  </select>
                </label>
                <label className="block text-sm">Catatan tindak lanjut manual
                  <textarea className={field} rows={3} maxLength={8000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: menunggu langkah reproduksi; jawaban telah dikirim manual setelah persetujuan." />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                    const { ticket } = await workflowClient.updateTicket(selectedTicket.id, status, notes);
                    setTickets((old) => old.map((item) => item.id === ticket.id ? ticket : item));
                  }, 'Status dan catatan tersimpan.')}>Simpan tindak lanjut</button>
                  <button className={button} disabled={busy} onClick={() => void run(async () => {
                    if (status !== selectedTicket.status || notes !== selectedTicket.notes) throw new Error('Simpan tindak lanjut sebelum membuat laporan AI.');
                    await workflowClient.enqueueTicketReport(selectedTicket.id);
                  }, 'Laporan tambahan ditambahkan ke antrean.')}>Antrekan laporan tambahan</button>
                </div>
                <p className="text-xs text-slate-400">AI tidak mengakses repository, memperbaiki bug, atau mengirim pesan. Status tiket diubah oleh admin.</p>
              </>}
            </section>
          </div>
        )}

        {tab === 'content' && <section className={panel}>
          <h2 className="text-lg font-bold">Divisi konten kreator</h2>
          <p className="text-sm text-slate-300">Buat ide, naskah, caption, dan usulan monetisasi. Hasilnya bukan riset tren langsung dan tidak menjamin penghasilan.</p>
          <p className="text-sm text-teal-300">Topik → Trendy → Script-AI → Clipper → persetujuan Bos. Hasil antarstaf diteruskan otomatis; publikasi tetap manual.</p>
          <p className="text-xs text-amber-300">Topik dikirim ke Gemini atau Copilot sesuai konfigurasi. Jangan sertakan data pribadi atau rahasia.</p>
          <p className="text-sm text-slate-400">Draf harian dijadwalkan setelah pukul 06.00 WIB ketika server aktif. Jika server baru aktif setelahnya, sistem mencoba membuat draf hari itu. Penyedia AI dan database harus tersedia.</p>
          <form onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await workflowClient.enqueue('creator', 'trendy', `Buat ide konten untuk topik berikut: ${topic}. Sajikan usulan video pendek, bukan klaim tren yang sudah diverifikasi.`);
              setTopic('');
              setTab('map');
            }, 'Tugas konten ditambahkan ke antrean.');
          }} className="space-y-3">
            <label className="block text-sm">Topik konten
              <textarea className={field} required maxLength={500} rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: tips mengatasi error login operator PAUD" />
            </label>
            <button className={button} disabled={busy}>Buat draf konten</button>
          </form>
        </section>}

        {tab === 'publication' && <section className={panel}>
          <h2 className="text-lg font-bold">Siap Publikasi</h2>
          <p className="text-sm text-slate-300">Paket yang disetujui dapat dibuat menjadi video AI vertikal 10 detik. Video harus diperiksa dan dipublikasikan manusia; tidak ada unggahan otomatis.</p>
          <p className="text-xs text-amber-300">Gemini Omni 720p sekitar US$0,70 per video, belum termasuk biaya lain atau pajak. Harga dapat berubah; periksa billing Google. Paket dikirim ke Google dan tidak disamarkan otomatis.</p>
          {videos === null ? <p className="text-sm text-amber-300">Status video tidak tersedia.</p> : !videos.enabled && <p className="text-sm text-amber-300">Pembuatan video belum aktif. Atur VIDEO_ENABLED=true setelah memeriksa biaya dan akses, lalu mulai ulang server.</p>}
          <p className="text-xs text-slate-400">Daftar ini tidak menandakan konten sudah terbit. Laporan lama tanpa format paket baru tidak otomatis dimasukkan.</p>
          {!draftsAvailable ? <p className="text-sm text-amber-300">Daftar tidak tersedia. Periksa koneksi dan muat ulang.</p>
            : readyForPublication.length === 0 ? <p className="text-sm text-slate-400">Belum ada paket yang disetujui.</p>
              : <div className="space-y-2">{readyForPublication.map((draft) => <button key={draft.id} className={`${secondary} w-full text-left`} onClick={() => { setSelectedDraftId(draft.id); setTab('drafts'); }}>
                <strong>{draft.title}</strong><span className="block text-xs text-teal-300">Disetujui · {videos?.jobs.find((job) => job.draftId === draft.id)?.status ?? 'belum ada tugas video'}</span>
              </button>)}</div>}
        </section>}

        {tab === 'drafts' && <div className="grid gap-5 lg:grid-cols-3">
          <section className={`${panel} lg:col-span-1`}>
            <h2 className="text-lg font-bold">Laporan dan draf</h2>
            {drafts.length === 0 && <p className="text-sm text-slate-400">Belum ada draf.</p>}
            <div className="max-h-[36rem] space-y-2 overflow-auto">
              {drafts.map((draft) => <button key={draft.id} onClick={() => setSelectedDraftId(draft.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${draft.id === selectedDraftId ? 'border-teal-400' : 'border-slate-700'}`}>
                <strong>{draft.title}</strong><span className="block text-slate-400">{draft.status === 'PENDING' ? 'Menunggu persetujuan' : draft.status === 'INTERMEDIATE' ? 'Tahap perantara · diteruskan' : 'Disetujui · tindak lanjut manual'}</span>
              </button>)}
            </div>
          </section>
          <section className={`${panel} lg:col-span-2`}>
            {!selectedDraft ? <p className="text-sm text-slate-400">Pilih laporan untuk diperiksa.</p> : <>
              <h2 className="text-lg font-bold">{selectedDraft.title}</h2>
              {selectedDraft.status === 'INTERMEDIATE' && <p className="text-sm text-teal-300">Tahap ini sudah diteruskan otomatis. Persetujuan diperlukan pada hasil akhir Clipper.</p>}
              {selectedDraft.contentPackageVersion === 1 && <p className="text-sm text-teal-300">Paket konten: judul, konsep, hook, naskah, caption, target platform, tata letak visual, dan hal yang perlu diverifikasi.</p>}
              {selectedDraft.contentPackageVersion === 1 && <p className="text-xs text-amber-300">Jika video aktif, Setujui otomatis mengirim paket ke Google untuk membuat video 10 detik berbayar (sekitar US$0,70; harga dapat berubah). Paket dengan tugas video tidak dapat diedit; buat paket baru untuk perubahan.</p>}
              <p className="text-xs text-slate-400">{selectedDraft.ai ? `Draf AI: ${selectedDraft.ai.provider === 'copilot' ? 'Copilot' : 'Gemini'} · ${selectedDraft.ai.model}` : 'Penyedia/model untuk draf lama tidak tercatat.'} Pengeditan manual dapat mengubah isi.</p>
              <p className="text-sm text-amber-300">Verifikasi fakta dan keamanan sebelum persetujuan. Persetujuan tidak mengirim WhatsApp, memperbaiki kode, atau mempublikasikan konten.</p>
              <label className="block text-sm">Isi laporan
                <textarea className={field} rows={16} maxLength={30000} value={content} onChange={(e) => setContent(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={secondary} disabled={busy || selectedDraft.status === 'INTERMEDIATE' || !!selectedVideo} onClick={() => updateDraft('EDIT')}>Simpan edit</button>
                <button className={button} disabled={busy || selectedDraft.status !== 'PENDING'} onClick={() => updateDraft('APPROVE')}>Setujui</button>
                {continuation?.id === selectedDraft.id && continuation.eligible && <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  await workflowClient.continueContent(selectedDraft.id);
                  setContinuation({ id: selectedDraft.id, eligible: false, forwarded: true });
                }, 'Laporan Trendy diteruskan ke Script-AI; hasil selanjutnya masuk antrean.')}>Teruskan laporan Trendy lama</button>}
                {continuation?.id === selectedDraft.id && continuation.forwarded && <span className="self-center text-xs text-teal-300">Laporan ini sudah diteruskan ke Script-AI.</span>}
                <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  await navigator.clipboard.writeText(content);
                }, 'Isi laporan disalin. Kirim atau publikasikan secara manual setelah persetujuan.')}>Salin isi</button>
                <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  const result = await workflowClient.events(selectedDraft.id);
                  setEvents(result.events);
                })}>Lihat riwayat versi</button>
              </div>
              {selectedDraft.contentPackageVersion === 1 && selectedDraft.status === 'APPROVED' && <div className="rounded-lg border border-slate-700 p-3 space-y-2">
                <h3 className="font-bold">Video AI</h3>
                {videos === null ? <p className="text-sm text-amber-300">Status video tidak tersedia.</p> : selectedVideo ? <>
                  <p className="text-sm">Status: {selectedVideo.status === 'QUEUED' ? 'Dalam antrean' : selectedVideo.status === 'RUNNING' ? 'Sedang dibuat' : selectedVideo.status === 'READY' ? 'Siap ditinjau' : selectedVideo.status === 'FAILED' ? 'Gagal' : 'Hasil tidak diketahui'}</p>
                  {selectedVideo.error && <p className="text-sm text-amber-300">{selectedVideo.error}</p>}
                  {(selectedVideo.status === 'FAILED' || selectedVideo.status === 'UNKNOWN') && <p className="text-xs text-amber-300">Tidak ada pengulangan otomatis. Periksa tagihan dan hasil di Google; buat paket baru hanya jika ingin membayar pembuatan ulang.</p>}
                  {selectedVideo.status === 'READY' && <><video controls preload="metadata" className="max-h-96" src={`/api/workflow/videos/${encodeURIComponent(selectedVideo.id)}/file`} /><a className={`${secondary} inline-block`} href={`/api/workflow/videos/${encodeURIComponent(selectedVideo.id)}/file`} download="video-konten.mp4">Unduh video</a></>}
                </> : videos.enabled ? <button className={button} disabled={busy} onClick={() => void run(async () => {
                  await workflowClient.createVideo(selectedDraft.id);
                  await loadVideos();
                }, 'Video dimasukkan ke antrean. Periksa status dan billing Google.')}>Buat video berbayar</button> : <p className="text-sm text-amber-300">Video belum diaktifkan.</p>}
              </div>}
              <label className="block text-sm">Arahan revisi AI
                <textarea className={field} rows={2} maxLength={4000} value={revision} onChange={(e) => setRevision(e.target.value)} />
              </label>
              <p className="text-xs text-amber-300">Arahan dan isi laporan dikirim ke Gemini atau Copilot sesuai konfigurasi saat revisi.</p>
              <button className={secondary} disabled={busy || selectedDraft.status === 'INTERMEDIATE' || !!selectedVideo || !revision.trim()} onClick={() => updateDraft('REVISE')}>Revisi</button>
              {events.length > 0 && <div className="space-y-2"><h3 className="font-bold">Riwayat versi tersimpan</h3>
                {events.map((event) => <details key={event.id} className="rounded-lg border border-slate-700 p-3 text-sm">
                  <summary>{event.action} · {new Date(event.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</summary>
                  {event.data.ai && <p className="mt-2 text-slate-400">AI: {event.data.ai.provider} · {event.data.ai.model}</p>}
                  {event.notes && <p className="mt-2 text-amber-300">Arahan: {event.notes}</p>}
                  <pre className="mt-2 whitespace-pre-wrap font-sans">{event.data.content}</pre>
                </details>)}
              </div>}
            </>}
          </section>
        </div>}

        {tab === 'guide' && <section className={panel}>
          <h2 className="text-lg font-bold">Workflow kantor</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-300">
            <li>Admin menerima pesan WhatsApp Business dan mencatat laporan yang sudah disamarkan pada menu Layanan klien.</li>
            <li>Staf AI menyusun laporan, usulan investigasi, dan draf jawaban. Belum ada perbaikan atau pesan yang dikirim.</li>
            <li>Pimpinan memeriksa fakta, meminta revisi bila perlu, dan menyetujui laporan.</li>
            <li>Admin menindaklanjuti secara manual: berkoordinasi dengan pengembang, menguji perbaikan, dan menjawab klien lewat WhatsApp Business. Catat tindak lanjut pada tiket.</li>
            <li>Divisi kreator menyiapkan ide dan naskah. Setelah disetujui, manusia memeriksa hak pakai, memproduksi dan mempublikasikan, lalu mengevaluasi hasil dan peluang pendapatan.</li>
          </ol>
          <p className="text-sm text-slate-400">Petunjuk konfigurasi, tanggung jawab, dan batasan tersedia pada README proyek. Aplikasi belum terhubung ke GitHub, WhatsApp atau platform sosial.</p>
        </section>}
      </main>
      <nav aria-label="Navigasi cepat" className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-700 bg-slate-900/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4">
          {([
            ['dashboard', 'Beranda', LayoutDashboard],
            ['tickets', 'Klien', Headphones],
            ['drafts', 'Persetujuan', ClipboardCheck],
            ['content', 'Konten', Film],
          ] as const).map(([id, label, Icon]) => (
            <button type="button" key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${tab === id ? 'text-teal-300' : 'text-slate-400'}`}>
              <span className="relative"><Icon size={20} />{id === 'drafts' && pendingCount !== null && pendingCount > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-950">{pendingCount}</span>}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>
      </div>
    </div>
  );
}
