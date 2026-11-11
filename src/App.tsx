import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChartNoAxesCombined, ClipboardCheck, Film, Headphones, LayoutDashboard, Map, Menu, Mic, MicOff, Share2, X } from 'lucide-react';
import { workflowClient } from './api/workflowClient';
import type { DraftEvent, OfficeJob, OfficeDivision, Ticket, TicketCategory, TicketDivision, TicketStatus, VideoControlStatus, VideoJob, WorkDraft } from './workflowTypes';
import { isDigitalProductResearchDraftId } from './workflowTypes';
import { OfficeScene } from './components/OfficeScene';
import { InstallApp } from './components/InstallApp';
import { BusinessCenter } from './components/BusinessCenter';
import { GroundedReport } from './components/GroundedReport';
import { CapCutExportActions } from './components/CapCutExportActions';
import { DigitalProductDownload } from './components/DigitalProductDownload';
import { useVoiceDictation } from './hooks/useVoiceDictation';
import { STAFF } from './staff';
import { marketingBriefInstruction, type MarketingBrief } from './lib/marketingBrief';
import { digitalProductIdeaJobId, extractDigitalProductIdeas } from './lib/digitalProductIdeas';
import { extractVideoIdeas } from './lib/videoIdeas';
import { OfficeAssistant } from './components/OfficeAssistant';

const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-base text-white';
const button = 'min-h-11 rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50';
const secondary = 'min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100 disabled:opacity-50';
const panel = 'rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4';
const labels: Record<TicketStatus, string> = {
  OPEN: 'Baru', IN_PROGRESS: 'Sedang ditangani', WAITING: 'Menunggu', RESOLVED: 'Selesai',
};
const divisions = [
  { id: 'paud', title: 'Siput PAUD' },
  { id: 'posyandu', title: 'Siput Posyandu' },
  { id: 'creator', title: 'Content Creator' },
  { id: 'engineer', title: 'Web App Engineer' },
  { id: 'cyber', title: 'Cyber Security' },
  { id: 'finance', title: 'Financial & Reporting' },
  { id: 'marketing', title: 'Digital Marketing & Distribution' },
] as const;
type Tab = 'dashboard' | 'map' | 'drafts' | 'publication' | 'history' | 'tickets' | 'content' | 'guide' | 'mandate' | 'business' | 'assistant';

function OfficeNavigation({ tab, pendingCount, navigate }: {
  tab: Tab;
  pendingCount: number | null;
  navigate: (tab: Tab) => void;
}) {
  const items: [Tab, string][] = [
    ['dashboard', '📊 Dashboard Utama'],
    ['business', '💼 Peluang & Keuangan'],
    ['map', '🗺️ Denah & Operasional'],
    ['drafts', `✅ Daftar Persetujuan (${pendingCount ?? '?'})`],
    ['publication', '📣 Siap Publikasi'],
    ['history', '📜 Riwayat Sistem'],
    ['tickets', '🎧 Layanan Klien'],
    ['assistant', '🎙️ Asisten Suara'],
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
  const [draftActionError, setDraftActionError] = useState<{ id: string; message: string } | null>(null);
  const [mandateDivision, setMandateDivision] = useState<WorkDraft['division']>('paud');
  const [mandate, setMandate] = useState('');
  const [marketingBrief, setMarketingBrief] = useState<MarketingBrief>({
    product: 'Siput PAUD',
    audience: '',
    verifiedFeatures: '',
    unavailableFeatures: '',
    priceAndLink: '',
    channels: '',
  });
  const voiceDictation = useVoiceDictation((transcript) => {
    setMandate((current) => current.trim() ? `${current.trimEnd()} ${transcript}` : transcript);
  });
  const [online, setOnline] = useState(navigator.onLine);
  const [jobs, setJobs] = useState<OfficeJob[] | null>(null);
  const [videos, setVideos] = useState<VideoControlStatus | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [continuation, setContinuation] = useState<{ id: string; eligible: boolean; forwarded: boolean } | null>(null);
  const [creatorFollowup, setCreatorFollowup] = useState<{ id: string; eligible: boolean; status: string | null } | null>(null);
  const [mandateContentFollowup, setMandateContentFollowup] = useState<{ id: string; eligible: boolean; forwarded: boolean; flowId: string | null } | null>(null);
  const [marketingContentFollowup, setMarketingContentFollowup] = useState<{
    id: string;
    eligible: boolean;
    forwarded: boolean;
    flowId: string | null;
    sourceBriefLinked: boolean;
    stages: { id: string; staffId: string; title: string; status: string; draftId: string | null; error: string | null }[];
  } | null>(null);
  const [verifiedProductFacts, setVerifiedProductFacts] = useState('');
  const [manualIdeaTitle, setManualIdeaTitle] = useState('');
  const [manualIdeaContent, setManualIdeaContent] = useState('');
  const [selectedVideoIdeaKey, setSelectedVideoIdeaKey] = useState('');
  const [mandateStaff, setMandateStaff] = useState('arka');
  const completedJobs = useRef('');
  const menuRef = useRef<HTMLDialogElement>(null);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId);
  const selectedProductIdeas = selectedDraft ? extractDigitalProductIdeas(selectedDraft.content) : [];
  const selectedProductIdeaJobs = jobs?.filter((job) => job.id.startsWith(`${selectedDraftId}:product:`)) ?? [];
  const pendingCount = draftsAvailable ? drafts.filter((draft) => draft.status === 'PENDING').length : null;
  const readyForPublication = drafts.filter((draft) => draft.contentPackageVersion === 1 && draft.status === 'APPROVED');
  const selectedVideoJobs = videos?.jobs.filter((job) => job.draftId === selectedDraftId) ?? [];
  const selectedVideoIdeas = selectedDraft ? extractVideoIdeas(selectedDraft.content, selectedDraft.title) : [];
  const selectedVideoIdea = selectedVideoIdeas.find((idea) => idea.key === selectedVideoIdeaKey) ??
    (selectedVideoIdeas.length === 1 ? selectedVideoIdeas[0] : undefined);
  const selectedVideo = selectedVideoJobs[0];
  const videoGenerationActive = selectedVideoJobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING');
  const videoGenerationUnknown = selectedVideoJobs.some((job) => job.status === 'UNKNOWN');

  useEffect(() => {
    if (tab !== 'mandate' && voiceDictation.isListening) voiceDictation.stop();
  }, [tab, voiceDictation.isListening, voiceDictation.stop]);

  const loadVideos = useCallback(async () => {
    try {
      setVideos(await workflowClient.videos());
      setError((current) => current.startsWith('Status video tidak tersedia:') ? '' : current);
    }
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
    setSelectedVideoIdeaKey('');
    setRevision('');
    setVerifiedProductFacts('');
    setManualIdeaTitle('');
    setManualIdeaContent('');
    setEvents([]);
    setDraftActionError(null);
  }, [selectedDraftId, selectedDraft?.updatedAt]);

  useEffect(() => {
    setContinuation(null);
    setCreatorFollowup(null);
    setMandateContentFollowup(null);
    setMarketingContentFollowup(null);
    if (!selectedDraft || selectedDraft.status !== 'APPROVED') return;
    let active = true;
    if (selectedDraft.division === 'creator') {
      workflowClient.contentContinuation(selectedDraft.id).then((result) => {
        if (active) setContinuation({ id: selectedDraft.id, ...result });
      }).catch((err) => { if (active) setError(`Status penerusan tidak tersedia: ${message(err)}`); });
    }
    if (selectedDraft.division === 'paud' || selectedDraft.division === 'posyandu') {
      workflowClient.creatorFollowup(selectedDraft.id).then((result) => {
        if (active) setCreatorFollowup({ id: selectedDraft.id, ...result });
      }).catch((err) => { if (active) setError(`Status tugas Creator tidak tersedia: ${message(err)}`); });
    }
    if (selectedDraft.division === 'engineer') {
      workflowClient.mandateContentFollowup(selectedDraft.id).then((result) => {
        if (active) setMandateContentFollowup({ id: selectedDraft.id, ...result });
      }).catch((err) => { if (active) setError(`Status penerusan ke Content Creator tidak tersedia: ${message(err)}`); });
    }
    return () => { active = false; };
  }, [selectedDraftId, selectedDraft?.updatedAt, selectedDraft?.status, selectedDraft?.division]);

  useEffect(() => {
    if (!selectedDraft || selectedDraft.status !== 'APPROVED' || selectedDraft.division !== 'marketing') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await workflowClient.marketingContentFollowup(selectedDraft.id);
        if (!active) return;
        setMarketingContentFollowup({ id: selectedDraft.id, ...result });
        if (result.stages.some((stage) => stage.status === 'QUEUED' || stage.status === 'RUNNING')) {
          timer = setTimeout(() => { void poll(); }, 3000);
        }
      } catch (err) {
        if (active) setError(`Status penerusan laporan marketing tidak tersedia: ${message(err)}`);
      }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, [selectedDraftId, selectedDraft?.status, selectedDraft?.division]);

  async function run(action: () => Promise<void>, success?: string, onError?: (error: string) => void) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await action();
      if (success) setNotice(success);
    } catch (err) {
      const errorMessage = message(err);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  function addDraft(draft: WorkDraft) {
    setDrafts((old) => [draft, ...old.filter((item) => item.id !== draft.id)]);
    setSelectedDraftId(draft.id);
    setTab('drafts');
  }

  function deleteDraft(draft: WorkDraft) {
    const confirmed = window.confirm(
      `Hapus permanen draf "${draft.title}" beserta riwayat versi dan tugas/alur terkait? Tindakan ini tidak dapat dibatalkan. Draf dari tiket atau yang memiliki artefak video tidak dapat dihapus lewat aksi ini.`,
    );
    if (!confirmed) return;
    void run(async () => {
      await workflowClient.deleteDraft(draft.id);
      if (selectedDraftId === draft.id) {
        setSelectedDraftId('');
        setEvents([]);
        setContent('');
      }
      await load();
    }, 'Draf dan data terkait yang aman telah dihapus.');
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
    initialSelectedStaffId: mandateStaff,
    onAssign: (next: OfficeDivision, staffId: string) => {
      setMandateDivision(next);
      setMandateStaff(staffId);
      setTab('mandate');
    },
    onRetry: (id: string) => run(async () => {
      const result = await workflowClient.retryJob(id);
      const snapshot = await workflowClient.jobs();
      setJobs(snapshot.jobs);
      if (result.alreadyActive) setNotice('Tugas sudah berada di antrean atau sedang diproses.');
    }, 'Tugas dikembalikan ke antrean atau sudah aktif.'),
    onDismissSprint: (id: string) => run(async () => {
      await workflowClient.dismissFailedSprint(id);
      const snapshot = await workflowClient.jobs();
      setJobs(snapshot.jobs);
    }, 'Tugas gagal dihapus dari daftar. Jadwal mingguan tidak akan mengantrekannya kembali.'),
    onStartSprintJob: (id: string) => run(async () => {
      await workflowClient.startSprintJob(id);
      const snapshot = await workflowClient.jobs();
      setJobs(snapshot.jobs);
    }, 'Satu tugas dipilih dan dimasukkan ke antrean. Pilih tugas lain setelah tugas ini selesai atau disisihkan.'),
    onStartDailyProductJob: (id: string) => run(async () => {
      await workflowClient.startDailyProductJob(id);
      const snapshot = await workflowClient.jobs();
      setJobs(snapshot.jobs);
    }, 'Tugas riset produk digital dimulai. Permintaan AI dapat menimbulkan biaya sesuai pemakaian dan limit OpenRouter.'),
    onDraft: (id: string) => void run(async () => {
      await load();
      setSelectedDraftId(id);
      setTab('drafts');
    }),
  };

  function updateDraft(action: 'EDIT' | 'APPROVE' | 'REVISE') {
    if (!selectedDraft) return;
    setDraftActionError(null);
    if (action !== 'EDIT' && content !== selectedDraft.content) {
      const errorMessage = 'Simpan perubahan isi terlebih dahulu sebelum menyetujui atau meminta revisi.';
      setError(errorMessage);
      setDraftActionError({ id: selectedDraft.id, message: errorMessage });
      return;
    }
    void run(async () => {
      const result = await workflowClient.updateDraft(selectedDraft.id, { action, content, notes: revision });
      addDraft(result.draft);
      if (action === 'APPROVE' && selectedDraft.contentPackageVersion === 1) await loadVideos();
      if (action === 'APPROVE' && selectedDraft.division === 'engineer') {
        const followup = await workflowClient.mandateContentFollowup(selectedDraft.id);
        setMandateContentFollowup({ id: selectedDraft.id, ...followup });
        if (followup.forwarded) setJobs((await workflowClient.jobs()).jobs);
      }
      if (action === 'APPROVE' && selectedDraft.division === 'marketing') {
        const followup = await workflowClient.marketingContentFollowup(selectedDraft.id);
        setMarketingContentFollowup({ id: selectedDraft.id, ...followup });
        if (followup.forwarded) setJobs((await workflowClient.jobs()).jobs);
      }
      if (action === 'APPROVE' &&
          (isDigitalProductResearchDraftId(selectedDraft.id) || selectedDraft.productPackageVersion === 1)) {
        const snapshot = await workflowClient.jobs();
        setJobs(snapshot.jobs);
      }
    }, action === 'APPROVE'
      ? isDigitalProductResearchDraftId(selectedDraft.id)
        ? 'Riset disetujui dan otomatis diteruskan ke Script-AI. Hasilnya akan menjadi draf untuk ditinjau, bukan dipublikasikan otomatis.'
        : selectedDraft.productPackageVersion === 1
          ? 'Produk PDF disetujui. Materi promosinya otomatis diteruskan melalui Trendy, Script-AI, dan Clipper untuk ditinjau; belum ada upload atau publikasi.'
        : selectedDraft.division === 'marketing' && marketingContentFollowup?.id === selectedDraft.id && marketingContentFollowup.forwarded
          ? 'Laporan Manajer Pemasaran disetujui dan diteruskan ke Trendy → Script-AI → Clipper. Hasilnya menjadi draf untuk ditinjau; belum ada video atau publikasi.'
        : selectedDraft.division === 'engineer' && mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.forwarded
            ? 'Mandat konten disetujui dan otomatis diteruskan ke Trendy, lalu Script-AI dan Clipper. Hasilnya masuk sebagai draf untuk ditinjau, tidak dipublikasikan otomatis.'
          : selectedDraft.contentPackageVersion === 1 && !selectedDraft.sourceDraftId
          ? 'Paket disetujui. Video tidak dibuat otomatis; pembuatan video memerlukan saklar admin aktif dan tindakan manual.'
          : 'Draf disetujui untuk tindak lanjut manual. Belum ada pesan dikirim atau konten dipublikasikan.'
      : action === 'REVISE'
        ? 'Revisi AI selesai dan draf kembali menunggu persetujuan. Setujui hasil revisi terlebih dahulu; setelah itu tindak lanjut berikutnya akan tersedia.'
        : 'Draf tersimpan dan menunggu persetujuan.', (errorMessage) => setDraftActionError({ id: selectedDraft.id, message: errorMessage }));
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

        {tab === 'business' && <BusinessCenter onDraft={addDraft} jobs={jobs} onRetry={sceneProps.onRetry} onDismissSprint={sceneProps.onDismissSprint} onStartSprintJob={sceneProps.onStartSprintJob} onStartDailyProductJob={sceneProps.onStartDailyProductJob} />}
        {tab === 'assistant' && <div className="space-y-3">
          <button type="button" className={secondary} onClick={() => setTab('dashboard')}>Kembali ke Dashboard</button>
          <OfficeAssistant />
        </div>}
        {tab === 'dashboard' && <section className={panel}>
          <h2 className="text-xl font-bold">Dashboard Utama</h2>
          <p className="text-sm text-slate-300">Lima divisi menyusun draf dari mandat atau siklus riset mingguan. Sistem tidak memantau produk atau melayani klien secara otomatis.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-950 p-4"><span className="text-slate-400">Laporan klien</span><p className="text-2xl font-bold">{draftsAvailable ? tickets.length : '—'}</p></div>
            <div className="rounded-lg bg-slate-950 p-4"><span className="text-slate-400">Menunggu persetujuan</span><p className="text-2xl font-bold">{pendingCount ?? '—'}</p></div>
            <div className="rounded-lg bg-slate-950 p-4"><span className="text-slate-400">Disetujui</span><p className="text-2xl font-bold">{draftsAvailable ? drafts.filter((draft) => draft.status === 'APPROVED').length : '—'}</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setTab('assistant')}>🎙️ Ngobrol dengan AI</button><button className={secondary} onClick={() => setTab('tickets')}>Catat laporan klien</button><button className={secondary} onClick={() => setTab('content')}>Buat konten</button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="flex flex-col justify-between rounded-xl border border-emerald-800/50 bg-slate-950 p-5 shadow-lg">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <ChartNoAxesCombined className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-emerald-300">Financial &amp; Reporting</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">Rekap pemasukan tercatat, biaya token AI, transaksi, dan laporan eksekutif harian. Saldo provider hanya ditampilkan jika tersedia dari sumber yang terverifikasi.</p>
              </div>
              <button type="button" className={`${secondary} mt-4 self-start`} onClick={() => setTab('business')}>Buka Peluang &amp; Keuangan</button>
            </article>
            <article className="flex flex-col justify-between rounded-xl border border-fuchsia-800/50 bg-slate-950 p-5 shadow-lg">
              <div>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300">
                  <Share2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-fuchsia-300">Digital Marketing &amp; Distribution</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">Penyiapan listing produk, caption, hashtag, dan checklist distribusi untuk ditinjau sebelum publikasi. Status tayang dan transaksi tidak dianggap aktif tanpa verifikasi.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={secondary} onClick={() => setTab('content')}>Siapkan konten</button>
                <button type="button" className={secondary} onClick={() => setTab('publication')}>Cek distribusi</button>
              </div>
            </article>
          </div>
          <section aria-labelledby="video-admin-title" className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="video-admin-title" className="font-bold">Panel kontrol admin · Video AI</h3>
                <p className="mt-1 text-xs text-slate-400">Batas anggaran yang disetujui: Rp{videos?.approvedBudgetIdr.toLocaleString('id-ID') ?? '100.000'} per video. Saklar hanya membuka opsi pembuatan; tidak langsung membuat atau mengunggah video.</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${videos?.enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
                {videos?.enabled ? 'Video Aktif' : 'Video Terkunci · Saklar OFF'}
              </span>
            </div>
            {!videos?.adminConfigured ? <p role="status" className="text-sm text-amber-300">Kontrol terkunci. Atur OFFICE_ADMIN_PASSWORD minimal 8 karakter pada environment server, lalu mulai ulang server.</p>
              : !videos.authenticated ? <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await workflowClient.adminLogin(adminPassword);
                  setAdminPassword('');
                  await loadVideos();
                }, 'Login admin berhasil.');
              }}>
                <label className="min-w-60 flex-1 text-sm">Password admin
                  <input className={`${field} mt-1`} type="password" autoComplete="current-password" required maxLength={256} value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
                </label>
                <button className={secondary} disabled={busy || !adminPassword}>Masuk admin</button>
              </form> : <div className="flex flex-wrap items-center gap-3">
                <button type="button" role="switch" aria-checked={videos.enabled} aria-label="Aktifkan video AI" disabled={busy} onClick={() => {
                  const enabled = !videos.enabled;
                  if (enabled && !window.confirm(`Aktifkan pembuatan video AI? Anggaran yang disetujui Rp${videos.approvedBudgetIdr.toLocaleString('id-ID')} per video. Ini tidak langsung membuat video; biaya aktual mengikuti tagihan OpenRouter.`)) return;
                  void run(async () => {
                    await workflowClient.setVideoEnabled(enabled);
                    await loadVideos();
                  }, enabled ? 'Video AI diaktifkan; setiap video tetap memerlukan tindakan manual.' : 'Video AI dinonaktifkan.');
                }} className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors disabled:opacity-50 ${videos.enabled ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600 bg-slate-700'}`}>
                  <span className={`inline-block h-6 w-6 rounded-full bg-white transition-transform ${videos.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-slate-200">{videos.enabled ? 'Aktif — pembuatan video tersedia setelah persetujuan' : 'OFF — tidak ada video baru diproses'}</span>
                <button type="button" className={secondary} disabled={busy} onClick={() => void run(async () => {
                  await workflowClient.adminLogout();
                  await loadVideos();
                }, 'Sesi admin ditutup.')}>Keluar admin</button>
              </div>}
            <p className="text-xs text-amber-300">Batas Rp100.000 adalah anggaran yang disetujui, bukan hard cap yang ditegakkan provider per video. Periksa tarif dan tagihan OpenRouter. Saklar OFF membatalkan antrean; permintaan yang sudah berjalan tidak dapat dihentikan. Video hasil tetap draf untuk ditinjau; unggah ke YouTube harus dilakukan manual setelah persetujuan.</p>
          </section>
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
          <p className="text-xs text-slate-400">Jadwal mingguan hanya berjalan saat server, database, dan penyedia AI tersedia; layanan 24/7 memerlukan hosting dan pemantauan terpisah.</p>
        </section>}

        {tab === 'map' && <section className={panel}>
          <div>
            <h2 className="text-lg font-bold">Denah &amp; Operasional</h2>
            <p className="text-sm text-slate-400">Pusat pantau antrean dan pemberian mandat untuk tujuh divisi. Pilih staf di denah atau daftar siaga untuk melihat tupoksi, tugas, membuka hasil, mencoba ulang tugas gagal, atau memberi tugas. Status mengikuti antrean aplikasi, bukan pemantauan aktivitas di luar sistem.</p>
          </div>
          <OfficeScene {...sceneProps} />
        </section>}

        {tab === 'mandate' && <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Mandat Staf dari Denah</h2>
            <button type="button" className={secondary} onClick={() => setTab('map')}>Kembali ke denah</button>
          </div>
          <p className="text-sm text-slate-300">Mandat menghasilkan laporan untuk pimpinan, bukan akses repository, perubahan kode, query ad hoc, atau deployment. Manajer Keuangan hanya membuat rekap terstruktur dari catatan aplikasi.</p>
          {mandateDivision === 'finance'
            ? <p className="text-xs text-amber-300">Manajer Keuangan membuat laporan harian, mingguan, dan bulanan dari catatan aplikasi secara lokal. Data transaksi tidak dikirim ke AI; saldo bank/e-wallet dan pemasukan yang belum dicatat tidak tersedia.</p>
            : <p className="text-xs text-amber-300">Instruksi diproses melalui OpenRouter ke model yang dikonfigurasi. Jangan sertakan kode sensitif, kredensial, data anak, data kesehatan, data transaksi, atau data pribadi.</p>}
          {mandateDivision === 'engineer' && <div className="text-sm text-slate-400">
            Repository rujukan: <a className="text-teal-300 underline" href="https://github.com/rasya19/siputv1" target="_blank" rel="noreferrer">Siput PAUD</a> · <a className="text-teal-300 underline" href="https://github.com/rasya19/Posyandu" target="_blank" rel="noreferrer">Siput Posyandu</a>. Aplikasi belum terhubung ke GitHub.
          </div>}
          {mandateDivision === 'cyber' && <div className="space-y-2 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
            <p><strong>Sentinel · Guard-AI · Audit:</strong> susun rekomendasi pemantauan, audit log, perlindungan data, dan mitigasi berdasarkan informasi yang diberikan.</p>
            <p>Belum terhubung ke log, database produk, pemindai kerentanan, atau sistem eksternal; tidak ada pemantauan atau audit otomatis. Jangan masukkan kredensial, data pribadi, atau log mentah sensitif.</p>
          </div>}
          {mandateDivision === 'marketing' && <div className="space-y-2 rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
            <p><strong>Manajer Pemasaran:</strong> menyiapkan draf listing, caption, hashtag, dan checklist distribusi memakai informasi produk yang sudah diverifikasi.</p>
            <p>Hasil perlu ditinjau pimpinan. Aplikasi belum mengaktifkan tautan, menjadwalkan atau memublikasikan konten, dan memproses pembayaran.</p>
          </div>}
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const target = mandateDivision;
              const chosen = STAFF.find((person) => person.id === mandateStaff && person.division === target) || STAFF.find((person) => person.division === target);
              if (!chosen) throw new Error('Staf untuk divisi tidak ditemukan.');
              const instruction = target === 'marketing' ? marketingBriefInstruction(marketingBrief) : mandate;
              await workflowClient.enqueue(target, chosen.id, instruction);
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
                value={STAFF.some((person) => person.id === mandateStaff && person.division === mandateDivision) ? mandateStaff : STAFF.find((person) => person.division === mandateDivision)?.id}
                onChange={(event) => setMandateStaff(event.target.value)}>
                {STAFF.filter((person) => person.division === mandateDivision).map((person) =>
                  <option key={person.id} value={person.id}>{person.name} — {person.role}</option>)}
              </select>
            </label>
            {mandateDivision === 'marketing' ? <div className="space-y-3 rounded-lg border border-slate-700 p-4">
              <h3 className="font-semibold">Brief produk — jawab yang kamu tahu</h3>
              <p className="text-xs text-slate-400">AI belum membaca repositori atau aplikasi Siput. Isi berdasarkan informasi yang sudah kamu verifikasi; bagian kosong akan ditandai [PERLU KONFIRMASI] dalam tugas.</p>
              <label className="block text-sm">Produk
                <select className={field} value={marketingBrief.product} onChange={(event) => setMarketingBrief((current) => ({ ...current, product: event.target.value as MarketingBrief['product'] }))}>
                  <option>Siput PAUD</option><option>Siput Posyandu</option>
                </select>
              </label>
              {([
                ['audience', 'Siapa pengguna atau pembeli yang dituju?'],
                ['verifiedFeatures', 'Fitur apa yang sudah dipastikan tersedia?'],
                ['unavailableFeatures', 'Fitur apa yang belum tersedia atau belum pasti?'],
                ['priceAndLink', 'Berapa harga dan apa tautan resmi? (boleh kosong)'],
                ['channels', 'Konten akan dipakai di kanal mana? (mis. Instagram, TikTok, WhatsApp)'],
              ] as const).map(([key, label]) => <label className="block text-sm" key={key}>{label}
                <textarea className={field} rows={key === 'verifiedFeatures' || key === 'unavailableFeatures' ? 3 : 2}
                  maxLength={1000}
                  value={marketingBrief[key]} onChange={(event) => setMarketingBrief((current) => ({ ...current, [key]: event.target.value }))}
                  placeholder={key === 'verifiedFeatures' ? 'Tulis hanya fitur yang sudah kamu cek.' : 'Isi jika tahu; kalau tidak, biarkan kosong.'} />
              </label>)}
              <details className="text-sm">
                <summary className="cursor-pointer text-teal-300">Lihat brief yang akan dikirim ke AI</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{marketingBriefInstruction(marketingBrief)}</pre>
              </details>
              <p className="text-xs text-slate-400">Tugas yang dibuat: 3 ide konten, caption, hashtag, dan checklist publikasi. Kamu tetap meninjau dan memublikasikan sendiri.</p>
            </div> : <label className="block text-sm">Instruksi
              <span className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-400">Ketik atau dikte dalam Bahasa Indonesia</span>
                <button type="button" className={secondary} disabled={!voiceDictation.isSupported || busy}
                  aria-pressed={voiceDictation.isListening}
                  onClick={() => voiceDictation.isListening ? voiceDictation.stop() : voiceDictation.start()}>
                  {voiceDictation.isListening ? <MicOff className="mr-2 inline" size={16} /> : <Mic className="mr-2 inline" size={16} />}
                  {voiceDictation.isListening ? 'Selesai merekam' : 'Dikte suara'}
                </button>
              </span>
              <textarea className={field} required maxLength={8000} rows={5} value={mandate} onChange={(e) => setMandate(e.target.value)} placeholder={
                mandateDivision === 'finance'
                  ? 'Contoh: Buat rekap harian, mingguan, dan bulanan dari transaksi yang tercatat.'
                  : 'Jelaskan masalah, tujuan, batasan, dan hasil laporan yang diharapkan. Jangan sertakan data pribadi atau rahasia.'
              } />
            </label>}
            {!voiceDictation.isSupported && <p className="text-xs text-amber-300">Browser ini tidak menyediakan fitur dikte suara. Gunakan browser yang mendukung Web Speech API.</p>}
            {voiceDictation.isListening && <p role="status" aria-live="polite" className="text-sm text-teal-300">
              Mikrofon aktif{voiceDictation.interimTranscript ? ` · ${voiceDictation.interimTranscript}` : ' · Silakan berbicara.'}
            </p>}
            {voiceDictation.error && <p role="alert" className="text-sm text-rose-300">{voiceDictation.error}</p>}
            <p className="text-xs text-slate-400">Periksa dan edit transkrip sebelum dikirim. Dukungan mikrofon mungkin memerlukan HTTPS. Pemrosesan audio mengikuti browser dan layanan pengenal suaranya; jangan diktekan data pribadi atau rahasia.</p>
            <button className={button} disabled={busy || voiceDictation.isListening}>{mandateDivision === 'finance' ? 'Buat laporan keuangan' : mandateDivision === 'marketing' ? 'Buat brief marketing untuk AI' : 'Siapkan draf untuk ditinjau'}</button>
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
              <p className="text-sm text-amber-300">Input manual. Jangan masukkan nomor telepon, nama klien, kredensial, data anak, atau data kesehatan. Setelah disimpan, isi laporan masuk antrean dan dikirim melalui OpenRouter.</p>
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
          <p className="text-xs text-amber-300">Topik dikirim melalui OpenRouter. Jangan sertakan data pribadi atau rahasia.</p>
          <p className="text-sm text-slate-400">Strategi konten mingguan disiapkan setelah riset peluang berhasil. Alur Trendy → Script-AI → Clipper tetap tersedia melalui mandat; jadwal harian lama tidak lagi berjalan otomatis.</p>
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
          <p className="text-sm text-slate-300">Status video: {videos?.enabled ? 'aktif' : 'terkunci'} · unggahan ke YouTube tidak otomatis dan tetap memerlukan tinjauan serta persetujuan manual.</p>
          {videos === null && <p className="text-sm text-amber-300">Status video tidak tersedia.</p>}
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
              {drafts.map((draft) => <div key={draft.id} className={`rounded-lg border p-3 text-sm ${draft.id === selectedDraftId ? 'border-teal-400' : 'border-slate-700'}`}>
                <button onClick={() => setSelectedDraftId(draft.id)} className="w-full text-left">
                  <strong>{draft.title}</strong><span className="block text-slate-400">{draft.status === 'PENDING' ? 'Menunggu persetujuan' : draft.status === 'INTERMEDIATE' ? 'Tahap perantara · diteruskan' : 'Disetujui · tindak lanjut manual'}</span>
                </button>
                <button className="mt-2 rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50" disabled={busy} onClick={() => deleteDraft(draft)}>Hapus draf</button>
              </div>)}
            </div>
          </section>
          <section className={`${panel} lg:col-span-2`}>
            {!selectedDraft ? <p className="text-sm text-slate-400">Pilih laporan untuk diperiksa.</p> : <>
              <h2 className="text-lg font-bold">{selectedDraft.title}</h2>
              {selectedDraft.status === 'INTERMEDIATE' && <p className="text-sm text-teal-300">Tahap ini sudah diteruskan otomatis. Persetujuan diperlukan pada hasil akhir Clipper.</p>}
              {selectedDraft.contentPackageVersion === 1 && <p className="text-sm text-teal-300">Paket konten: judul, konsep, hook, naskah, caption, target platform, tata letak visual, dan hal yang perlu diverifikasi.</p>}
              {selectedDraft.contentPackageVersion === 1 && <p className="text-xs text-amber-300">Paket konten yang disetujui bisa diajukan menjadi video secara terpisah. Video berbiaya dan memerlukan login admin serta konfirmasi; ajakan beli/link bio harus memakai tautan resmi yang sudah diberikan.</p>}
              {selectedDraft.productPackageVersion === 1 && <DigitalProductDownload title={selectedDraft.title} content={content} />}
              {selectedDraft.sourceDraftId && <div className="text-sm text-teal-300">Dibuat berdasarkan riset mingguan. <button className="underline" onClick={() => setSelectedDraftId(selectedDraft.sourceDraftId!)}>Buka riset dan sumber</button>. Draf turunan dapat berisi dugaan; verifikasi sebelum digunakan.</div>}
              <p className="text-xs text-slate-400">{selectedDraft.ai ? `Draf AI: ${selectedDraft.ai.provider === 'copilot' ? 'Copilot' : selectedDraft.ai.provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} · ${selectedDraft.ai.model}` : 'Penyedia/model untuk draf lama tidak tercatat.'} Pengeditan manual dapat mengubah isi.</p>
              <p className="text-sm text-amber-300">Verifikasi fakta dan keamanan sebelum persetujuan. Persetujuan tidak mengirim WhatsApp, memperbaiki kode, atau mempublikasikan konten.</p>
              {creatorFollowup?.id === selectedDraft.id && (creatorFollowup.eligible || creatorFollowup.status) && <p className="text-sm text-slate-300">Tindak lanjut Creator dimulai hanya setelah kamu memasukkan fakta produk yang sudah diverifikasi dan menekan tombol. Satu tugas AI dapat menimbulkan biaya; hasil tidak dikirim ke klien atau dipublikasikan.</p>}
              {mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.eligible && <p className="text-sm text-slate-300">Mandat ini meminta materi konten. Teruskan laporan yang disetujui ke Trendy → Script-AI → Clipper untuk menyiapkan draf; riset tren, video, dan publikasi tidak dilakukan otomatis.</p>}
              {mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.forwarded && <p className="text-sm text-teal-300">Mandat sudah diteruskan ke Content Creator. Hasilnya akan muncul sebagai draf untuk diperiksa sebelum ada tindakan publikasi.</p>}
              {selectedDraft.grounding ? <><p className="text-xs text-amber-300">Laporan riset dan sumbernya tidak dapat diubah; jalankan riset baru jika diperlukan.</p><GroundedReport draft={selectedDraft} /></> : <label className="block text-sm">Isi laporan
                <textarea className={field} rows={16} maxLength={30000} value={content} onChange={(e) => setContent(e.target.value)} />
              </label>}
              {isDigitalProductResearchDraftId(selectedDraft.id) && selectedDraft.status === 'APPROVED' && <section className="space-y-3 rounded-lg border border-teal-900 bg-slate-950 p-4">
                <h3 className="font-bold text-teal-200">Pilih ide yang ingin dibuatkan produknya</h3>
                <p className="text-sm text-slate-300">Persetujuan riset tidak otomatis membuat produk. Setiap ide yang kamu pilih mendapat satu tugas AI terpisah untuk membuat isi MVP dan draf listing. Setelah hasil produk selesai, periksa dan setujui sebelum alur marketing menyiapkan materi promosi. Tiap tugas AI dapat menimbulkan biaya.</p>
                {jobs === null && <p role="status" className="text-sm text-amber-300">Status tugas produk belum tersedia.</p>}
                {selectedProductIdeas.length ? <div className="space-y-3">{selectedProductIdeas.map((idea) => {
                  const job = jobs?.find((item) => item.id === digitalProductIdeaJobId(selectedDraft.id, idea.key));
                  const productDraft = job?.draftId ? drafts.find((draft) => draft.id === job.draftId) : undefined;
                  return <article key={idea.key} className="space-y-2 rounded-lg border border-slate-700 p-3">
                    <h4 className="font-semibold">Ide {idea.number}: {idea.title}</h4>
                    <p className="whitespace-pre-wrap text-xs text-slate-400">{idea.content.slice(0, 900)}{idea.content.length > 900 ? '…' : ''}</p>
                    {job && <p className="text-sm text-teal-300">Status produk: {job.status === 'QUEUED' ? 'dalam antrean' : job.status === 'RUNNING' ? 'sedang dibuat' : job.status === 'DONE' ? 'draf produk siap ditinjau' : job.status === 'FAILED' ? `gagal — ${job.error ?? 'alasan tidak tersedia'}` : job.status}</p>}
                    {productDraft && <button type="button" className={secondary} onClick={() => setSelectedDraftId(productDraft.id)}>Buka draf produk</button>}
                    {job?.status === 'FAILED'
                      ? <button type="button" className={secondary} disabled={busy} onClick={() => void run(async () => {
                        await workflowClient.retryJob(job.id);
                        setJobs((await workflowClient.jobs()).jobs);
                      }, 'Tugas pembuatan produk dimasukkan ulang ke antrean.')}>Coba lagi pembuatan produk</button>
                      : !job && <button type="button" className={button} disabled={busy || jobs === null} onClick={() => void run(async () => {
                        if (!window.confirm(`Buat satu draf produk digital dari ide "${idea.title}"? Ini akan mengirim satu permintaan AI dan mungkin menimbulkan biaya.`)) return;
                        await workflowClient.startDigitalProductIdea(selectedDraft.id, idea.title, idea.content);
                        setJobs((await workflowClient.jobs()).jobs);
                      }, 'Satu tugas produk untuk ide terpilih masuk antrean.')}>Buat produk dari ide ini</button>}
                  </article>;
                })}</div> : <div className="space-y-2">
                  <p className="text-sm text-amber-300">Laporan lama ini belum memakai format ide terstruktur. Salin satu ide lengkap dari isi laporan ke kolom berikut. Setiap ide dapat diajukan sebagai tugas produk tersendiri.</p>
                  <label className="block text-sm">Judul ide yang dipilih
                    <input className={field} maxLength={200} value={manualIdeaTitle} onChange={(event) => setManualIdeaTitle(event.target.value)} placeholder="Contoh: Workbook pencatatan harian UMKM" />
                  </label>
                  <label className="block text-sm">Salin bagian ide dari laporan yang disetujui
                    <textarea className={field} rows={5} maxLength={6000} value={manualIdeaContent} onChange={(event) => setManualIdeaContent(event.target.value)} />
                  </label>
                  <button type="button" className={button} disabled={busy || jobs === null || manualIdeaTitle.trim().length === 0 || manualIdeaContent.trim().length < 30} onClick={() => void run(async () => {
                    if (!window.confirm(`Buat satu draf produk digital dari ide "${manualIdeaTitle.trim()}"? Ini akan mengirim satu permintaan AI dan mungkin menimbulkan biaya.`)) return;
                    await workflowClient.startDigitalProductIdea(selectedDraft.id, manualIdeaTitle, manualIdeaContent);
                    setJobs((await workflowClient.jobs()).jobs);
                    setManualIdeaTitle('');
                    setManualIdeaContent('');
                  }, 'Tugas produk untuk ide pilihan masuk antrean.')}>Buat produk dari ide yang dipilih</button>
                </div>}
                {selectedProductIdeaJobs.length > 0 && <p className="text-xs text-slate-400">{selectedProductIdeaJobs.length} ide sudah dikirim sebagai tugas produk terpisah.</p>}
              </section>}
              {selectedDraft.contentPackageVersion === 1 && selectedDraft.division === 'creator' &&
                <CapCutExportActions title={selectedDraft.title} content={content} />}
              <div className="flex flex-wrap gap-2">
                <button className={secondary} disabled={busy || selectedDraft.status === 'INTERMEDIATE' || !!selectedVideo || !!selectedDraft.grounding} onClick={() => updateDraft('EDIT')}>Simpan edit</button>
                <button className={button} disabled={busy || selectedDraft.status !== 'PENDING'} onClick={() => updateDraft('APPROVE')}>Setujui</button>
                {continuation?.id === selectedDraft.id && continuation.eligible && <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  await workflowClient.continueContent(selectedDraft.id);
                  setContinuation({ id: selectedDraft.id, eligible: false, forwarded: true });
                }, 'Laporan Trendy diteruskan ke Script-AI; hasil selanjutnya masuk antrean.')}>Teruskan laporan Trendy lama</button>}
                {continuation?.id === selectedDraft.id && continuation.forwarded && <span className="self-center text-xs text-teal-300">Laporan ini sudah diteruskan ke Script-AI.</span>}
                {mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.eligible && <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  const result = await workflowClient.startMandateContentFollowup(selectedDraft.id);
                  setMandateContentFollowup({ id: selectedDraft.id, eligible: false, forwarded: true, flowId: result.id });
                  setJobs((await workflowClient.jobs()).jobs);
                }, 'Mandat diteruskan ke Trendy → Script-AI → Clipper. Hasilnya tetap draf untuk ditinjau; tidak ada publikasi otomatis.')}>Teruskan ke Content Creator</button>}
                {mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.forwarded && <span className="self-center text-xs text-teal-300">Sudah diteruskan ke Content Creator.</span>}
                {marketingContentFollowup?.id === selectedDraft.id && marketingContentFollowup.eligible && <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  await workflowClient.startMarketingContentFollowup(selectedDraft.id);
                  setMarketingContentFollowup({ id: selectedDraft.id, ...(await workflowClient.marketingContentFollowup(selectedDraft.id)) });
                  setJobs((await workflowClient.jobs()).jobs);
                }, 'Laporan Manajer Pemasaran diteruskan ke Trendy → Script-AI → Clipper. Hasilnya tetap draf untuk ditinjau.')}>Teruskan ke Content Creator</button>}
                {marketingContentFollowup?.id === selectedDraft.id && marketingContentFollowup.forwarded && <section className="w-full space-y-2 rounded-lg border border-teal-900 bg-slate-950 p-3 text-sm">
                  <p className="text-teal-300">Alur Content Creator {marketingContentFollowup.flowId ? `(${marketingContentFollowup.flowId.slice(0, 8)})` : ''}</p>
                  {!marketingContentFollowup.sourceBriefLinked && <p className="text-amber-300">Brief sumber tidak tertaut; Trendy memakai laporan yang disetujui saja dan tidak boleh menambah fakta.</p>}
                  {marketingContentFollowup.stages.length === 0 && <p className="text-amber-300">Alur tercatat, tetapi tugas tahap pertama belum ditemukan. Coba muat ulang atau hubungi admin.</p>}
                  {marketingContentFollowup.stages.map((stage) => <div key={stage.id} className="flex flex-wrap items-center gap-2">
                    <span>{stage.staffId === 'trendy' ? 'Trendy' : stage.staffId === 'script_ai' ? 'Script-AI' : stage.staffId === 'clipper' ? 'Clipper' : stage.title}: {stage.status === 'QUEUED' ? 'menunggu giliran' : stage.status === 'RUNNING' ? 'sedang diproses' : stage.status === 'DONE' ? 'selesai' : stage.status === 'FAILED' ? `gagal${stage.error ? ` — ${stage.error}` : ''}` : stage.status}</span>
                    {stage.status === 'FAILED' && <button className="min-h-9 rounded border border-amber-600 px-2 text-xs text-amber-200 disabled:opacity-50" disabled={busy} onClick={() => void run(async () => {
                      await workflowClient.retryJob(stage.id);
                      setMarketingContentFollowup({ id: selectedDraft.id, ...(await workflowClient.marketingContentFollowup(selectedDraft.id)) });
                      setJobs((await workflowClient.jobs()).jobs);
                    }, 'Tahap Content Creator dimasukkan ulang ke antrean.')}>Coba lagi</button>}
                    {stage.status === 'DONE' && stage.draftId && <button className="underline text-teal-200" onClick={() => setSelectedDraftId(stage.draftId!)}>Buka hasil tahap</button>}
                  </div>)}
                </section>}
                {creatorFollowup?.id === selectedDraft.id && creatorFollowup.eligible && <label className="block w-full text-sm">Fitur Siput PAUD/Posyandu yang sudah kamu verifikasi
                  <textarea className={field} rows={3} maxLength={4000} value={verifiedProductFacts} onChange={(event) => setVerifiedProductFacts(event.target.value)} placeholder="Tuliskan hanya fitur yang sudah kamu pastikan benar. Jangan masukkan data pribadi atau rahasia." />
                  <span className="mt-1 block text-xs text-amber-300">Tanpa fakta terverifikasi, AI bisa mengarang. Klaim fitur di luar daftar ini akan dilarang pada tugas Creator.</span>
                </label>}
                {creatorFollowup?.id === selectedDraft.id && creatorFollowup.eligible && <button className={secondary} disabled={busy || !verifiedProductFacts.trim()} onClick={() => void run(async () => {
                  const result = await workflowClient.startCreatorFollowup(selectedDraft.id, verifiedProductFacts);
                  setCreatorFollowup({ id: selectedDraft.id, eligible: false, status: result.status });
                  const snapshot = await workflowClient.jobs();
                  setJobs(snapshot.jobs);
                }, 'Satu tugas Creator dimasukkan ke antrean. Hasilnya tetap berupa draf untuk ditinjau; tidak ada pesan yang dikirim atau konten dipublikasikan.')}>Lanjutkan ke Content Creator (1 tugas AI)</button>}
                {creatorFollowup?.id === selectedDraft.id && creatorFollowup.status && <span className="self-center text-xs text-teal-300">Tugas Creator: {creatorFollowup.status === 'QUEUED' ? 'menunggu giliran' : creatorFollowup.status === 'RUNNING' ? 'sedang diproses' : creatorFollowup.status === 'DONE' ? 'selesai' : creatorFollowup.status === 'FAILED' ? 'gagal' : creatorFollowup.status}</span>}
                <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  await navigator.clipboard.writeText(content);
                }, 'Isi laporan disalin. Kirim atau publikasikan secara manual setelah persetujuan.')}>Salin isi</button>
                <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                  const result = await workflowClient.events(selectedDraft.id);
                  setEvents(result.events);
                })}>Lihat riwayat versi</button>
                <button className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-50" disabled={busy} onClick={() => deleteDraft(selectedDraft)}>Hapus draf</button>
              </div>
              {selectedDraft.contentPackageVersion === 1 && selectedDraft.status === 'APPROVED' && <div className="rounded-lg border border-slate-700 p-3 space-y-2">
                <h3 className="font-bold">Video AI</h3>
                <p className="text-xs text-slate-400">Pilih satu ide video untuk dibuat sekarang. Hanya naskah dan arahan visual dari ide terpilih yang dikirim ke AI; ide lain tidak ikut dalam permintaan ini. Setelah satu video selesai, kamu bisa memilih ide lain.</p>
                {selectedVideoIdeas.length > 1 && <label className="block text-sm">Ide video yang akan dibuat
                  <select className={field} value={selectedVideoIdeaKey} onChange={(event) => setSelectedVideoIdeaKey(event.target.value)}>
                    <option value="">Pilih ide video</option>
                    {selectedVideoIdeas.map((idea) => <option key={idea.key} value={idea.key}>
                      {idea.number ? `Video ${idea.number}: ` : ''}{idea.title}
                    </option>)}
                  </select>
                </label>}
                <p className="text-xs text-slate-400">{selectedVideoIdea ? `Pilihan saat ini: ${selectedVideoIdea.number ? `Video ${selectedVideoIdea.number} · ` : ''}${selectedVideoIdea.title}. Naskah mengikuti timestamp (hingga 30 detik pada HeyGen).` : 'Pilih salah satu ide sebelum membuat video.'} Dialog dan arahan visual dikirim berurutan; periksa hasil suara karena pelafalan model generatif tidak dijamin persis.</p>
                {videos === null ? <p className="text-sm text-amber-300">Status video tidak tersedia.</p> : <>
                  {selectedVideoJobs.map((videoJob) => <div key={videoJob.id} className="space-y-2 rounded-lg border border-slate-700 p-3">
                    <p className="text-sm">{videoJob.title} · {new Date(videoJob.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB · Status: {videoJob.status === 'QUEUED' ? 'Dalam antrean' : videoJob.status === 'RUNNING' ? 'Sedang dibuat' : videoJob.status === 'READY' ? 'Siap ditinjau' : videoJob.status === 'FAILED' ? 'Gagal' : videoJob.status === 'CANCELLED' ? 'Dibatalkan admin' : 'Hasil tidak diketahui'}</p>
                    {videoJob.error && <p className="text-sm text-amber-300">{videoJob.error}</p>}
                    {videoJob.status === 'FAILED' && videoJob.error?.toLowerCase().includes('naskah narasi') && <p className="text-xs text-teal-300">Gagal sebelum permintaan pembuatan video dikirim. Format pembaca naskah sudah diperbaiki; tekan tombol buat ulang untuk mencoba kembali.</p>}
                    {videoJob.status === 'UNKNOWN' && <>
                      <p role="status" className="text-xs text-amber-300">Percobaan ini tidak diketahui sedang berjalan atau sudah selesai. Cek Logs dan Usage OpenRouter dahulu. Melepas kunci tidak membatalkan permintaan yang mungkin masih berjalan atau mencegah tagihan.</p>
                      {videos.authenticated && <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                        if (!window.confirm('Pastikan kamu sudah memeriksa Logs dan Usage OpenRouter, dan yakin permintaan ini tidak sedang berjalan serta tagihannya sudah jelas. Lanjut melepas kunci agar bisa mencoba lagi? Tindakan ini tidak membatalkan proses di provider.')) return;
                        await workflowClient.acknowledgeUnknownVideo(videoJob.id);
                        await loadVideos();
                      }, 'Kunci percobaan dilepas. Kamu dapat mengantrekan video baru setelah memeriksa biaya dan status provider.')}>Saya sudah cek OpenRouter — izinkan coba lagi</button>}
                    </>}
                    {videoJob.status === 'READY' && <><video controls preload="metadata" className="max-h-96" src={`/api/workflow/videos/${encodeURIComponent(videoJob.id)}/file`} /><a className={`${secondary} inline-block`} href={`/api/workflow/videos/${encodeURIComponent(videoJob.id)}/file`} download={`video-konten-${videoJob.id}.mp4`}>Unduh hasil ini</a></>}
                  </div>)}
                  {videos.enabled && videos.authenticated && !videoGenerationUnknown ? <button className={button} disabled={busy || videoGenerationActive || !selectedVideoIdea} onClick={() => void run(async () => {
                    const idea = selectedVideoIdea;
                    if (!idea) throw new Error('Pilih satu ide video terlebih dahulu.');
                    if (!window.confirm(`${selectedVideoJobs.length ? 'Buat ulang' : 'Buat'} video AI untuk "${idea.title}"? Hanya ide ini yang akan diproses. Anggaran yang disetujui Rp${videos.approvedBudgetIdr.toLocaleString('id-ID')} bukan hard cap provider; biaya aktual mengikuti durasi dan tarif OpenRouter.`)) return;
                    await workflowClient.createVideo(selectedDraft.id, idea.key);
                    await loadVideos();
                  }, 'Permintaan video untuk ide terpilih masuk antrean. Hasil sebelumnya tetap tersedia; periksa status dan biaya di OpenRouter.')}>{videoGenerationActive ? 'Video sedang diproses' : `${selectedVideoJobs.length ? 'Buat ulang' : 'Buat'} video untuk ide terpilih`}</button> : !videoGenerationUnknown && <p className="text-sm text-amber-300">{videos.enabled ? 'Login admin melalui Dashboard untuk membuat video.' : 'Video Terkunci — aktifkan saklar admin di Dashboard.'}</p>}
                  {!videoGenerationActive && selectedVideoJobs.some((job) => job.status === 'FAILED' || job.status === 'CANCELLED') && <p className="text-xs text-slate-400">Kamu dapat mengantrekan percobaan baru. Hasil yang sudah jadi tidak dihapus.</p>}
                </>}
              </div>}
              <label className="block text-sm">Arahan revisi AI
                <textarea className={field} rows={2} maxLength={4000} value={revision} onChange={(e) => setRevision(e.target.value)} />
              </label>
              <p className="text-xs text-amber-300">Arahan dan isi laporan dikirim melalui OpenRouter saat revisi.</p>
              {draftActionError?.id === selectedDraft.id && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">Aksi draf gagal: {draftActionError.message}</p>}
              <button className={secondary} disabled={busy || selectedDraft.status === 'INTERMEDIATE' || !!selectedVideo || !!selectedDraft.grounding || !revision.trim()} onClick={() => updateDraft('REVISE')}>Revisi</button>
              {events.length > 0 && <div className="space-y-2"><h3 className="font-bold">Riwayat versi tersimpan</h3>
                {events.map((event) => <details key={event.id} className="rounded-lg border border-slate-700 p-3 text-sm">
                  <summary>{event.action} · {new Date(event.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</summary>
                  {event.data.ai && <p className="mt-2 text-slate-400">AI: {event.data.ai.provider} · {event.data.ai.model}</p>}
                  {event.notes && <p className="mt-2 text-amber-300">Arahan: {event.notes}</p>}
                  {event.data.grounding ? <GroundedReport draft={event.data} /> : <pre className="mt-2 whitespace-pre-wrap font-sans">{event.data.content}</pre>}
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
        <div className="grid grid-cols-5">
          {([
            ['dashboard', 'Beranda', LayoutDashboard],
            ['map', 'Denah', Map],
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
