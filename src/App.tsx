import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Eye,
  Film,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Map as MapIcon,
  Megaphone,
  Menu,
  Mic,
  MicOff,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { workflowClient } from './api/workflowClient';
import type { DraftEvent, OfficeJob, OfficeDivision, Ticket, TicketCategory, TicketDivision, TicketStatus, VideoControlStatus, WorkDraft } from './workflowTypes';
import { isDigitalProductResearchDraftId } from './workflowTypes';
import {
  JOBS_ACTIVE_POLL_MS,
  JOBS_IDLE_POLL_MS,
  VIDEOS_ACTIVE_POLL_MS,
  VIDEOS_IDLE_POLL_MS,
  hasActiveStatus,
  nextPollDelayMs,
} from './lib/polling';
import { OfficeScene } from './components/OfficeScene';
import { InstallApp } from './components/InstallApp';
import { BusinessCenter } from './components/BusinessCenter';
import { GroundedReport } from './components/GroundedReport';
import { CapCutExportActions } from './components/CapCutExportActions';
import { DigitalProductDownload } from './components/DigitalProductDownload';
import { useVoiceDictation } from './hooks/useVoiceDictation';
import { ACTIVE_STAFF, CORE_ROOMS, coreRoomForStaff, getRoomStaff, STAFF, type CoreRoomId } from './staff';
import { marketingBriefInstruction, type MarketingBrief } from './lib/marketingBrief';
import { digitalProductIdeaJobId, extractDigitalProductIdeas } from './lib/digitalProductIdeas';
import { extractVideoIdeas } from './lib/videoIdeas';
import { OfficeAssistant } from './components/OfficeAssistant';
import { LicenseGenerator } from './components/LicenseGenerator';

const field = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-base text-slate-900 shadow-sm';
const button = 'min-h-11 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-teal-900/10 transition hover:bg-teal-700 disabled:opacity-50';
const secondary = 'min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50';

const labels: Record<TicketStatus, string> = {
  OPEN: 'Baru', IN_PROGRESS: 'Sedang ditangani', WAITING: 'Menunggu', RESOLVED: 'Selesai',
};

type Hub = 'dashboard' | 'office' | 'drafts' | 'content' | 'business' | 'clients' | 'assistant';
type OfficeSubTab = 'map' | 'mandate' | 'guide';
type ContentSubTab = 'create' | 'publication';
type ClientsSubTab = 'tickets' | 'license';
type DraftFilter = 'PENDING' | 'APPROVED' | 'INTERMEDIATE' | 'ALL';

type HubConfig = {
  id: Hub;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  iconBg: string;
  iconText: string;
  headerBadge: string;
};

const HUBS: HubConfig[] = [
  {
    id: 'dashboard',
    label: 'Beranda',
    eyebrow: 'RINGKASAN EKSEKUTIF',
    title: 'Beranda Studio',
    subtitle: 'Gambaran cepat persetujuan, antrean 3 divisi inti, dan kontrol admin.',
    Icon: LayoutDashboard,
    iconBg: 'bg-emerald-500/20 border-emerald-400/30',
    iconText: 'text-emerald-300',
    headerBadge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    id: 'office',
    label: 'Kantor 3D',
    eyebrow: 'KAMPUS & PENUGASAN',
    title: 'Kantor Virtual & Mandat',
    subtitle: 'Pantau staf di dunia 3D, kirim mandat terarah, dan lihat alur kerja.',
    Icon: MapIcon,
    iconBg: 'bg-sky-500/20 border-sky-400/30',
    iconText: 'text-sky-300',
    headerBadge: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  {
    id: 'drafts',
    label: 'Persetujuan',
    eyebrow: 'KENDALI MUTU & ARSIP',
    title: 'Persetujuan & Riwayat Draf',
    subtitle: 'Baca laporan dengan nyaman, edit atau revisi, ekspor PDF/CapCut, lalu setujui.',
    Icon: ClipboardCheck,
    iconBg: 'bg-amber-500/20 border-amber-400/30',
    iconText: 'text-amber-300',
    headerBadge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  {
    id: 'content',
    label: 'Studio Konten',
    eyebrow: 'PRODUKSI & DISTRIBUSI',
    title: 'Studio Konten Kreator',
    subtitle: 'Susun paket konten dalam 1x AI hemat atau 3x AI mendalam, dan cek siap publikasi.',
    Icon: Film,
    iconBg: 'bg-rose-500/20 border-rose-400/30',
    iconText: 'text-rose-300',
    headerBadge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    id: 'business',
    label: 'Bisnis & Kas',
    eyebrow: 'PELUANG & KEUANGAN',
    title: 'Bisnis, Riset & Kas',
    subtitle: 'Riset produk digital, sprint validasi 7 hari, transaksi manual, dan Ruang Pimpinan.',
    Icon: ChartNoAxesCombined,
    iconBg: 'bg-teal-500/20 border-teal-400/30',
    iconText: 'text-teal-300',
    headerBadge: 'border-teal-200 bg-teal-50 text-teal-700',
  },
  {
    id: 'clients',
    label: 'Klien & Lisensi',
    eyebrow: 'DUKUNGAN & AKTIVASI',
    title: 'Layanan Klien & Lisensi',
    subtitle: 'Catat tiket WhatsApp Siput PAUD/Posyandu dan buat kode lisensi aplikasi warung.',
    Icon: Headphones,
    iconBg: 'bg-blue-500/20 border-blue-400/30',
    iconText: 'text-blue-300',
    headerBadge: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    id: 'assistant',
    label: 'Asisten Suara',
    eyebrow: 'MANAJER BACA-SAJA',
    title: 'Asisten Suara Kantor',
    subtitle: 'Diskusi langsung dengan Manajer AI tentang status kantor dan limit API.',
    Icon: Mic,
    iconBg: 'bg-violet-500/20 border-violet-400/30',
    iconText: 'text-violet-300',
    headerBadge: 'border-violet-200 bg-violet-50 text-violet-700',
  },
];

const TOPIC_IDEAS = [
  'Tips atasi kendala login & sinkronisasi operator PAUD',
  'Cara kader posyandu catat timbangan KMS tanpa buku besar',
  '3 langkah rapikan kas harian warung tanpa aplikasi ribet',
];

const WORKFLOW_STEPS = [
  {
    step: 1,
    role: 'Admin',
    title: 'Terima & Samarkan Laporan',
    desc: 'Laporan dari WhatsApp Business dicatat di menu Klien & Lisensi tanpa nama, nomor HP, atau data pribadi.',
    hub: 'clients' as Hub,
    cta: 'Buka Layanan Klien',
    tone: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    step: 2,
    role: 'Staf AI',
    title: 'Susun Draf & Investigasi',
    desc: 'Staf AI di 3 divisi inti (Produk & Riset, Konten & Penjualan, Layanan Klien) menyiapkan draf siap tinjau.',
    hub: 'office' as Hub,
    cta: 'Pantau Kantor 3D',
    tone: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    step: 3,
    role: 'Bos Ismanto',
    title: 'Tinjau, Revisi & Setujui',
    desc: 'Pimpinan mengecek fakta dan keamanan pada Persetujuan. Belum ada pesan atau kode yang dieksekusi otomatis.',
    hub: 'drafts' as Hub,
    cta: 'Buka Persetujuan',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    step: 4,
    role: 'Operator',
    title: 'Tindak Lanjut Manual',
    desc: 'Setelah disetujui, operator berkoordinasi dengan pengembang, membalas WhatsApp, atau mengunggah produk ke Lynk.id.',
    hub: 'business' as Hub,
    cta: 'Catat di Bisnis & Kas',
    tone: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    step: 5,
    role: 'Kreator',
    title: 'Produksi & Publikasi Konten',
    desc: 'Naskah dari Studio Konten dirakit manual (CapCut gratis) atau Video AI berbayar setelah dicek hak pakainya.',
    hub: 'content' as Hub,
    cta: 'Buka Studio Konten',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
  },
];

function DraftDocumentView({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      {blocks.map((block, idx) => {
        const lines = block.split(/\r?\n/);
        return (
          <div key={idx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
              if (headingMatch) {
                return <h3 key={lIdx} className="pt-1 text-base font-extrabold text-slate-900">{headingMatch[1].replace(/\*\*/g, '')}</h3>;
              }
              const labelMatch = trimmed.match(/^(?:\*\*)?([A-Za-z0-9 /&()-]{2,40})(?:\*\*)?\s*:\s*(.*)$/);
              if (labelMatch) {
                return (
                  <p key={lIdx} className="text-sm leading-relaxed text-slate-700">
                    <span className="mr-1.5 inline-block rounded-md bg-teal-50 px-2 py-0.5 text-xs font-extrabold text-teal-800 ring-1 ring-teal-200/70">
                      {labelMatch[1]}
                    </span>
                    {labelMatch[2]}
                  </p>
                );
              }
              if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
                return (
                  <p key={lIdx} className="pl-3 text-sm leading-relaxed text-slate-700">
                    {trimmed}
                  </p>
                );
              }
              return <p key={lIdx} className="text-sm leading-relaxed text-slate-700">{trimmed}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function StudioSidebarNav({
  hub,
  pendingCount,
  openTicketsCount,
  readyPubCount,
  runningCount,
  layoutPrefix,
  navigate,
}: {
  hub: Hub;
  pendingCount: number | null;
  openTicketsCount: number;
  readyPubCount: number;
  runningCount: number;
  layoutPrefix: string;
  navigate: (next: Hub) => void;
}) {
  return (
    <nav className="mt-5 space-y-1.5" aria-label="Menu studio kantor">
      {HUBS.map(({ id, label, Icon, iconBg, iconText }) => {
        const active = hub === id;
        const badge =
          id === 'drafts' ? pendingCount
            : id === 'clients' && openTicketsCount > 0 ? openTicketsCount
              : id === 'content' && readyPubCount > 0 ? readyPubCount
                : null;
        return (
          <button
            key={id}
            type="button"
            onClick={() => navigate(id)}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-semibold transition ${
              active ? 'text-white' : 'text-slate-300 hover:bg-white/6 hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${layoutPrefix}-active-pill`}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-2xl border border-white/15 bg-white/12 shadow-lg shadow-black/20"
              />
            )}
            <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition group-hover:scale-105 ${iconBg} ${iconText}`}>
              <Icon size={16} aria-hidden="true" />
            </span>
            <span className="relative z-10 min-w-0 flex-1 truncate">{label}</span>
            {id === 'office' && runningCount > 0 && (
              <span className="relative z-10 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" title="Ada staf bekerja" />
            )}
            {badge !== null && badge !== undefined && (
              <span
                className={`relative z-10 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                  id === 'drafts' && badge > 0
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/15 text-emerald-100'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SubTabBar<T extends string>({
  items,
  active,
  layoutId,
  onChange,
}: {
  items: readonly { id: T; label: string; Icon: LucideIcon; badge?: number }[];
  active: T;
  layoutId: string;
  onChange: (next: T) => void;
}) {
  return (
    <div className="studio-subtabs" role="tablist">
      {items.map(({ id, label, Icon, badge }) => {
        const isSelected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(id)}
            className={`relative flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
              isSelected ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isSelected && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-white shadow-sm"
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon size={15} className={isSelected ? 'text-teal-600' : ''} />
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-extrabold text-teal-800">{badge}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
}

function wibGreeting(): string {
  const wibHour = new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
  if (wibHour >= 4 && wibHour < 11) return 'Selamat pagi';
  if (wibHour >= 11 && wibHour < 15) return 'Selamat siang';
  if (wibHour >= 15 && wibHour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function App() {
  const [hub, setHub] = useState<Hub>('dashboard');
  const [officeSubTab, setOfficeSubTab] = useState<OfficeSubTab>('map');
  const [contentSubTab, setContentSubTab] = useState<ContentSubTab>('create');
  const [clientsSubTab, setClientsSubTab] = useState<ClientsSubTab>('tickets');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [drafts, setDrafts] = useState<WorkDraft[]>([]);
  const [draftFilter, setDraftFilter] = useState<DraftFilter>('PENDING');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftViewMode, setDraftViewMode] = useState<'read' | 'edit'>('read');
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
  const [contentMode, setContentMode] = useState<'fast' | 'deep'>('fast');
  const [content, setContent] = useState('');
  const [revision, setRevision] = useState('');
  const [draftActionError, setDraftActionError] = useState<{ id: string; message: string } | null>(null);
  const [mandateRoom, setMandateRoom] = useState<CoreRoomId>('product_research');
  const [mandateDivision, setMandateDivision] = useState<WorkDraft['division']>('creator');
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
  const [mandateStaff, setMandateStaff] = useState('strategist');
  const completedJobs = useRef('');
  const wakeJobsPollRef = useRef<() => void>(() => {});
  const wakeVideosPollRef = useRef<() => void>(() => {});
  const menuRef = useRef<HTMLDialogElement>(null);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId);
  const selectedProductIdeas = selectedDraft ? extractDigitalProductIdeas(selectedDraft.content) : [];
  const selectedProductIdeaJobs = jobs?.filter((job) => job.id.startsWith(`${selectedDraftId}:product:`)) ?? [];
  const pendingDrafts = drafts.filter((draft) => draft.status === 'PENDING');
  const pendingCount = draftsAvailable ? pendingDrafts.length : null;
  const openTicketsCount = tickets.filter((ticket) => ticket.status !== 'RESOLVED').length;
  const readyForPublication = drafts.filter((draft) => draft.contentPackageVersion === 1 && draft.status === 'APPROVED');
  const filteredDrafts = drafts.filter((draft) => {
    const matchesStatus = draftFilter === 'ALL' || draft.status === draftFilter;
    const query = draftSearch.trim().toLowerCase();
    const matchesQuery = !query || draft.title.toLowerCase().includes(query) || draft.division.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });
  const runningStaffCount = jobs ? new Set(jobs.filter((job) => job.status === 'RUNNING').map((job) => job.staffId)).size : 0;
  const queuedJobsCount = jobs ? jobs.filter((job) => job.status === 'QUEUED').length : 0;
  const failedJobsCount = jobs ? jobs.filter((job) => job.status === 'FAILED').length : 0;

  const selectedVideoJobs = videos?.jobs.filter((job) => job.draftId === selectedDraftId) ?? [];
  const selectedVideoIdeas = selectedDraft ? extractVideoIdeas(selectedDraft.content, selectedDraft.title) : [];
  const selectedVideoIdea = selectedVideoIdeas.find((idea) => idea.key === selectedVideoIdeaKey) ??
    (selectedVideoIdeas.length === 1 ? selectedVideoIdeas[0] : undefined);
  const selectedVideo = selectedVideoJobs[0];
  const videoGenerationActive = selectedVideoJobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING');
  const videoGenerationUnknown = selectedVideoJobs.some((job) => job.status === 'UNKNOWN');

  useEffect(() => {
    if (!(hub === 'office' && officeSubTab === 'mandate') && voiceDictation.isListening) {
      voiceDictation.stop();
    }
  }, [hub, officeSubTab, voiceDictation.isListening, voiceDictation.stop]);

  const loadVideos = useCallback(async (): Promise<VideoControlStatus> => {
    try {
      const data = await workflowClient.videos();
      setVideos(data);
      setError((current) => current.startsWith('Status video tidak tersedia:') ? '' : current);
      return data;
    } catch (err) {
      setVideos(null);
      throw err;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let delay = VIDEOS_IDLE_POLL_MS;
      if (document.visibilityState !== 'hidden') {
        try {
          const data = await loadVideos();
          delay = nextPollDelayMs(hasActiveStatus(data.jobs), VIDEOS_ACTIVE_POLL_MS, VIDEOS_IDLE_POLL_MS);
        } catch (err) {
          if (active) setError(`Status video tidak tersedia: ${message(err)}`);
          delay = 15_000;
        }
      }
      if (active) timer = setTimeout(() => { void poll(); }, delay);
    };
    const wake = () => {
      if (!active) return;
      clearTimeout(timer);
      void poll();
    };
    wakeVideosPollRef.current = wake;
    const onVisibility = () => { if (document.visibilityState === 'visible') wake(); };
    document.addEventListener('visibilitychange', onVisibility);
    void poll();
    return () => {
      active = false;
      wakeVideosPollRef.current = () => {};
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
    } catch (err) {
      setDraftsAvailable(false);
      throw err;
    }
  }, []);

  useEffect(() => {
    load().catch((err) => setError(message(err)));
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      load().catch((err) => setError(message(err)));
    }, 60000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        load().catch((err) => setError(message(err)));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      let delay = JOBS_IDLE_POLL_MS;
      if (document.visibilityState !== 'hidden') {
        try {
          const snapshot = await workflowClient.jobs();
          if (active) {
            setJobs(snapshot.jobs);
            const completed = snapshot.jobs.filter((job) => job.status === 'DONE').map((job) => job.id).join(',');
            if (completed !== completedJobs.current) {
              completedJobs.current = completed;
              void load().catch((err) => setError(message(err)));
            }
            delay = nextPollDelayMs(hasActiveStatus(snapshot.jobs), JOBS_ACTIVE_POLL_MS, JOBS_IDLE_POLL_MS);
          }
        } catch (err) {
          if (active) {
            console.warn('[Antrean] Status tidak tersedia:', err);
            setJobs(null);
            delay = 15_000;
          }
        }
      }
      if (active) timer = setTimeout(() => { void poll(); }, delay);
    };
    const wake = () => {
      if (!active) return;
      clearTimeout(timer);
      void poll();
    };
    wakeJobsPollRef.current = wake;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void poll();
    return () => {
      active = false;
      wakeJobsPollRef.current = () => {};
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
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
    setDraftViewMode('read');
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
      wakeJobsPollRef.current();
      wakeVideosPollRef.current();
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
    setDraftFilter(draft.status === 'APPROVED' ? 'APPROVED' : draft.status === 'INTERMEDIATE' ? 'INTERMEDIATE' : 'PENDING');
    setHub('drafts');
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
      const targetStaff = ACTIVE_STAFF.find((person) => person.id === staffId) ?? ACTIVE_STAFF[0];
      setMandateRoom(coreRoomForStaff(targetStaff.id));
      setMandateDivision(targetStaff.division ?? next);
      setMandateStaff(targetStaff.id);
      setHub('office');
      setOfficeSubTab('mandate');
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
      setDraftFilter('ALL');
      setHub('drafts');
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
          ? 'Produk PDF disetujui. Materi promosinya otomatis diteruskan langsung ke Clipper (1× AI hemat) untuk ditinjau; belum ada upload atau publikasi.'
        : selectedDraft.division === 'marketing' && marketingContentFollowup?.id === selectedDraft.id && marketingContentFollowup.forwarded
          ? 'Laporan Manajer Pemasaran disetujui dan diteruskan langsung ke Clipper (1× AI hemat). Hasilnya menjadi draf untuk ditinjau; belum ada video atau publikasi.'
        : selectedDraft.division === 'engineer' && mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.forwarded
            ? 'Mandat konten disetujui dan otomatis diteruskan langsung ke Clipper (1× AI hemat). Hasilnya masuk sebagai draf untuk ditinjau, tidak dipublikasikan otomatis.'
          : selectedDraft.contentPackageVersion === 1 && !selectedDraft.sourceDraftId
          ? 'Paket disetujui. Video tidak dibuat otomatis; pembuatan video memerlukan saklar admin aktif dan tindakan manual.'
          : 'Draf disetujui untuk tindak lanjut manual. Belum ada pesan dikirim atau konten dipublikasikan.'
      : action === 'REVISE'
        ? 'Revisi AI selesai dan draf kembali menunggu persetujuan. Setujui hasil revisi terlebih dahulu; setelah itu tindak lanjut berikutnya akan tersedia.'
        : 'Draf tersimpan dan menunggu persetujuan.', (errorMessage) => setDraftActionError({ id: selectedDraft.id, message: errorMessage }));
  }

  const activeHub = HUBS.find((item) => item.id === hub) ?? HUBS[0];
  const ActiveHubIcon = activeHub.Icon;

  return (
    <MotionConfig reducedMotion="user">
      <div className="studio-shell min-h-screen lg:flex">
        {/* Floating Dark Executive Sidebar */}
        <aside className="studio-sidebar hidden flex-col justify-between overflow-y-auto p-4 lg:sticky lg:top-3 lg:m-3 lg:flex lg:h-[calc(100vh-1.5rem)] lg:w-[272px] lg:shrink-0 lg:rounded-3xl">
          <div>
            <div className="flex items-center gap-3 px-1 pt-1">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 to-teal-500/10 text-emerald-300 shadow-lg shadow-emerald-950/50">
                <Building2 size={21} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold leading-tight text-white">PT Rasyatech<br />Digital Zenith</h1>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-300">Studio AI · Bos Ismanto</p>
              </div>
            </div>

            <StudioSidebarNav
              hub={hub}
              pendingCount={pendingCount}
              openTicketsCount={openTicketsCount}
              readyPubCount={readyForPublication.length}
              runningCount={runningStaffCount}
              layoutPrefix="desktop"
              navigate={setHub}
            />
          </div>

          <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => { setHub('office'); setOfficeSubTab('map'); }}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/6 px-3.5 py-2.5 text-left transition hover:bg-white/10"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${runningStaffCount > 0 ? 'animate-pulse bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-400/80'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white">3 Divisi Inti · 6 Staf</p>
                <p className="text-[11px] text-slate-300">
                  {runningStaffCount > 0 ? `${runningStaffCount} staf sedang bekerja` : `${queuedJobsCount} antre · fokus revenue`}
                </p>
              </div>
              <ArrowUpRight size={14} className="text-slate-400" />
            </button>
            <InstallApp theme="dark" />
          </div>
        </aside>

        {/* Mobile Dark Slide-Over Menu */}
        <dialog
          ref={menuRef}
          aria-labelledby="mobile-menu-title"
          className="studio-sidebar fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(85vw,320px)] max-w-none overflow-y-auto border-r border-white/10 p-5 backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm lg:hidden"
          onClick={(event) => { if (event.target === event.currentTarget) menuRef.current?.close(); }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/20 text-emerald-300">
                <Building2 size={20} />
              </div>
              <div>
                <h2 id="mobile-menu-title" className="font-extrabold text-white">Kantor AI Rasyatech</h2>
                <p className="text-xs font-semibold text-emerald-300">7 Hub Utama</p>
              </div>
            </div>
            <button type="button" className="rounded-xl p-2 text-slate-300 hover:bg-white/10" aria-label="Tutup menu" onClick={() => menuRef.current?.close()}><X size={22} /></button>
          </div>
          <StudioSidebarNav
            hub={hub}
            pendingCount={pendingCount}
            openTicketsCount={openTicketsCount}
            readyPubCount={readyForPublication.length}
            runningCount={runningStaffCount}
            layoutPrefix="mobile-drawer"
            navigate={(next) => { setHub(next); menuRef.current?.close(); }}
          />
          <div className="mt-5 border-t border-white/10 pt-4">
            <InstallApp theme="dark" />
          </div>
        </dialog>

        <div className="min-w-0 flex-1">
          {/* Mobile Header */}
          <div className="studio-mobile-header sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-emerald-300 shadow-sm"><Building2 size={18} /></span>
              <div>
                <p className="text-sm font-extrabold text-slate-900">Kantor AI Rasyatech</p>
                <p className="text-xs font-semibold text-teal-700">{activeHub.label}</p>
              </div>
            </div>
            <button type="button" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-sm" aria-label="Buka menu" onClick={() => menuRef.current?.showModal()}>
              <Menu size={21} />
            </button>
          </div>

          <main className="mobile-content-space mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 lg:py-6 lg:pr-7">
            {/* Dynamic Studio Header */}
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div className="flex items-center gap-3.5">
                <span className={`hidden h-11 w-11 shrink-0 place-items-center rounded-2xl border sm:grid ${activeHub.headerBadge}`}>
                  <ActiveHubIcon size={20} />
                </span>
                <div>
                  <p className="app-eyebrow">{activeHub.eyebrow}</p>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{activeHub.title}</h2>
                  <p className="text-xs text-slate-500 sm:text-sm">{activeHub.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {pendingCount !== null && pendingCount > 0 && hub !== 'drafts' && (
                  <button
                    type="button"
                    onClick={() => { setDraftFilter('PENDING'); setHub('drafts'); }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                  >
                    <ClipboardCheck size={14} /> {pendingCount} menunggu tinjauan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setHub('office'); setOfficeSubTab('map'); }}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    runningStaffCount > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${runningStaffCount > 0 ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
                  {runningStaffCount > 0 ? `${runningStaffCount} staf bekerja` : `${queuedJobsCount} antre`}
                </button>
                <button className={`${secondary} inline-flex items-center gap-2`} disabled={busy} onClick={() => void run(load, 'Data diperbarui.')}>
                  <RefreshCw size={15} className={busy ? 'activity-spin' : ''} />
                  Muat ulang
                </button>
              </div>
            </header>

            {!online && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-medium text-amber-900">Anda sedang offline. Data tidak disimpan di perangkat; sambungkan kembali sebelum melanjutkan.</div>}
            {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-800">{error}</div>}
            {notice && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800">{notice}</div>}

            <AnimatePresence mode="wait">
              <motion.div
                key={hub}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* HUB 1: BERANDA STUDIO (BENTO DASHBOARD) */}
                {hub === 'dashboard' && (
                  <section className="space-y-5">
                    <div className="studio-hero-dark p-6 sm:p-8">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-200 backdrop-blur-sm">
                            <span className="app-live-dot" /> Studio Ramping · 3 Divisi Inti (6 Staf)
                          </span>
                          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{wibGreeting()}, Bos Ismanto</h2>
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                            Semua draf produk, riset, dan konten disiapkan staf AI di balik layar. Kamu memegang penuh persetujuan dan eksekusi akhirnya.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                          <button
                            type="button"
                            onClick={() => setHub('assistant')}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-extrabold text-slate-900 shadow-lg transition hover:bg-emerald-50"
                          >
                            <Mic size={16} className="text-violet-700" /> Ngobrol dengan AI
                          </button>
                          <button
                            type="button"
                            onClick={() => { setHub('office'); setOfficeSubTab('map'); }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
                          >
                            <MapIcon size={16} className="text-sky-300" /> Denah 3D
                          </button>
                          <button
                            type="button"
                            onClick={() => { setHub('content'); setContentSubTab('create'); }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
                          >
                            <Film size={16} className="text-rose-300" /> Buat Konten
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 4 Bento KPI Tiles */}
                    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                      {([
                        {
                          label: 'Menunggu Persetujuan',
                          value: pendingCount ?? '—',
                          note: 'Perlu ditinjau pimpinan',
                          Icon: ClipboardCheck,
                          tone: 'border-amber-200 bg-gradient-to-br from-amber-50/90 to-white',
                          iconTone: 'bg-amber-100 text-amber-700',
                          onClick: () => { setDraftFilter('PENDING'); setHub('drafts'); },
                        },
                        {
                          label: 'Draf Disetujui',
                          value: draftsAvailable ? drafts.filter((d) => d.status === 'APPROVED').length : '—',
                          note: `${readyForPublication.length} siap publikasi`,
                          Icon: CheckCircle2,
                          tone: 'bg-white',
                          iconTone: 'bg-emerald-100 text-emerald-700',
                          onClick: () => { setHub('content'); setContentSubTab('publication'); },
                        },
                        {
                          label: 'Antrean Staf Aktif',
                          value: jobs ? runningStaffCount + queuedJobsCount : '—',
                          note: jobs ? `${runningStaffCount} bekerja · ${failedJobsCount} gagal` : 'Antrean tidak tersedia',
                          Icon: Users,
                          tone: 'bg-white',
                          iconTone: 'bg-sky-100 text-sky-700',
                          onClick: () => { setHub('office'); setOfficeSubTab('map'); },
                        },
                        {
                          label: 'Laporan Klien',
                          value: draftsAvailable ? tickets.length : '—',
                          note: `${openTicketsCount} masih terbuka`,
                          Icon: Headphones,
                          tone: 'bg-white',
                          iconTone: 'bg-blue-100 text-blue-700',
                          onClick: () => { setHub('clients'); setClientsSubTab('tickets'); },
                        },
                      ] as const).map(({ label, value, note, Icon, tone, iconTone, onClick }) => (
                        <motion.button
                          key={label}
                          type="button"
                          whileHover={{ y: -3 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={onClick}
                          className={`studio-bento-card p-5 text-left transition hover:border-teal-300 ${tone}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconTone}`}>
                              <Icon size={18} />
                            </span>
                            <ArrowUpRight size={16} className="text-slate-400" />
                          </div>
                          <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
                          <p className="mt-1 text-xs font-bold text-slate-700">{label}</p>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{note}</span>
                        </motion.button>
                      ))}
                    </div>

                    {/* 2-Col Bento: Pending Inbox + Quick Division Hubs */}
                    <div className="grid gap-5 lg:grid-cols-5">
                      <div className="studio-bento-card flex flex-col justify-between space-y-4 p-5 sm:p-6 lg:col-span-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="app-eyebrow">INBOX PIMPINAN</p>
                            <h3 className="text-base font-extrabold text-slate-900">Perlu Persetujuan Terbaru</h3>
                          </div>
                          <button type="button" className={secondary} onClick={() => { setDraftFilter('PENDING'); setHub('drafts'); }}>
                            Lihat semua
                          </button>
                        </div>
                        {pendingDrafts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                            Semua laporan sudah ditinjau. Kamu bisa memberi mandat baru di Kantor 3D atau membuat konten di Studio Konten.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {pendingDrafts.slice(0, 3).map((draft) => (
                              <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-amber-300">
                                <div className="min-w-0 flex-1">
                                  <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">{draft.division}</span>
                                  <p className="mt-1 truncate text-sm font-bold text-slate-900">{draft.title}</p>
                                  <p className="text-xs text-slate-500">{new Date(draft.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>
                                </div>
                                <button
                                  type="button"
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-xs font-bold text-white transition hover:bg-teal-700"
                                  onClick={() => { setSelectedDraftId(draft.id); setDraftFilter('PENDING'); setHub('drafts'); }}
                                >
                                  Tinjau <ArrowRight size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="studio-bento-card space-y-3 p-5 sm:p-6 lg:col-span-2">
                        <div>
                          <p className="app-eyebrow">AKSES CEPAT</p>
                          <h3 className="text-base font-extrabold text-slate-900">Hub Operasional</h3>
                        </div>
                        <div className="space-y-2.5">
                          <button type="button" onClick={() => setHub('business')} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700"><ChartNoAxesCombined size={18} /></span>
                            <div className="min-w-0 flex-1">
                              <strong className="block text-sm text-slate-900">Bisnis, Riset &amp; Kas</strong>
                              <span className="text-xs text-slate-500">Sprint 7 hari &amp; Ruang Pimpinan</span>
                            </div>
                            <ArrowRight size={16} className="text-slate-400" />
                          </button>

                          <button type="button" onClick={() => { setHub('content'); setContentSubTab('create'); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-rose-300 hover:bg-rose-50/40">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700"><Film size={18} /></span>
                            <div className="min-w-0 flex-1">
                              <strong className="block text-sm text-slate-900">Studio Konten (1x AI Hemat)</strong>
                              <span className="text-xs text-slate-500">Naskah 9:16 + panduan CapCut</span>
                            </div>
                            <ArrowRight size={16} className="text-slate-400" />
                          </button>

                          <button type="button" onClick={() => { setHub('clients'); setClientsSubTab('license'); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-left transition hover:border-blue-300 hover:bg-blue-50/40">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700"><KeyRound size={18} /></span>
                            <div className="min-w-0 flex-1">
                              <strong className="block text-sm text-slate-900">Klien &amp; Generator Lisensi</strong>
                              <span className="text-xs text-slate-500">Tiket PAUD/Posyandu &amp; kode warung</span>
                            </div>
                            <ArrowRight size={16} className="text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Video AI Admin Control */}
                    <section aria-labelledby="video-admin-title" className="studio-bento-card space-y-4 p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                            <ShieldCheck size={19} />
                          </div>
                          <div>
                            <h3 id="video-admin-title" className="font-extrabold text-slate-900">Panel kontrol admin · Video AI</h3>
                            <p className="mt-0.5 text-xs text-slate-500">Batas anggaran yang disetujui: Rp{videos?.approvedBudgetIdr.toLocaleString('id-ID') ?? '100.000'} per video. Saklar hanya membuka opsi pembuatan.</p>
                          </div>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${videos?.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                          {videos?.enabled ? 'Video Aktif' : 'Video Terkunci · Saklar OFF'}
                        </span>
                      </div>

                      {!videos?.adminConfigured ? (
                        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                          Kontrol terkunci. Atur OFFICE_ADMIN_PASSWORD minimal 8 karakter pada environment server, lalu mulai ulang server.
                        </p>
                      ) : !videos.authenticated ? (
                        <form
                          className="flex flex-wrap items-end gap-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(async () => {
                              await workflowClient.adminLogin(adminPassword);
                              setAdminPassword('');
                              await loadVideos();
                            }, 'Login admin berhasil.');
                          }}
                        >
                          <label className="min-w-60 flex-1 text-sm font-semibold text-slate-700">Password admin
                            <input className={field} type="password" autoComplete="current-password" required maxLength={256} value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
                          </label>
                          <button className={secondary} disabled={busy || !adminPassword}>Masuk admin</button>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={videos.enabled}
                            aria-label="Aktifkan video AI"
                            disabled={busy}
                            onClick={() => {
                              const enabled = !videos.enabled;
                              if (enabled && !window.confirm(`Aktifkan pembuatan video AI? Anggaran yang disetujui Rp${videos.approvedBudgetIdr.toLocaleString('id-ID')} per video. Ini tidak langsung membuat video; biaya aktual mengikuti tagihan OpenRouter.`)) return;
                              void run(async () => {
                                await workflowClient.setVideoEnabled(enabled);
                                await loadVideos();
                              }, enabled ? 'Video AI diaktifkan; setiap video tetap memerlukan tindakan manual.' : 'Video AI dinonaktifkan.');
                            }}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors disabled:opacity-50 ${videos.enabled ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-200'}`}
                          >
                            <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${videos.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                          </button>
                          <span className="text-sm font-medium text-slate-700">{videos.enabled ? 'Aktif — pembuatan video tersedia setelah persetujuan' : 'OFF — tidak ada video baru diproses'}</span>
                          <button
                            type="button"
                            className={secondary}
                            disabled={busy}
                            onClick={() => void run(async () => {
                              await workflowClient.adminLogout();
                              await loadVideos();
                            }, 'Sesi admin ditutup.')}
                          >
                            Keluar admin
                          </button>
                        </div>
                      )}

                      <details className="office-info-box">
                        <summary>Kebijakan biaya &amp; keterbatasan Video AI</summary>
                        <p className="mt-2 leading-relaxed text-slate-600">
                          Batas Rp100.000 adalah anggaran yang disetujui, bukan hard cap yang ditegakkan provider per video. Periksa tarif dan tagihan OpenRouter. Saklar OFF membatalkan antrean; permintaan yang sudah berjalan tidak dapat dihentikan.
                        </p>
                      </details>
                    </section>
                  </section>
                )}

                {/* HUB 2: KANTOR 3D (DENAH + MANDAT + ALUR KERJA) */}
                {hub === 'office' && (
                  <section className="space-y-5">
                    <SubTabBar
                      layoutId="office-subtab"
                      active={officeSubTab}
                      onChange={setOfficeSubTab}
                      items={[
                        { id: 'map', label: 'Denah 3D', Icon: MapIcon },
                        { id: 'mandate', label: 'Beri Mandat', Icon: Sparkles },
                        { id: 'guide', label: 'Alur Kerja', Icon: BookOpen },
                      ]}
                    />

                    <AnimatePresence mode="wait">
                      {officeSubTab === 'map' && (
                        <motion.div key="office-map" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="studio-bento-card p-5 sm:p-6">
                          <OfficeScene {...sceneProps} />
                        </motion.div>
                      )}

                      {officeSubTab === 'mandate' && (
                        <motion.div key="office-mandate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="studio-bento-card space-y-5 p-5 sm:p-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-900">Mandat Staf Terarah</h3>
                              <p className="text-sm text-slate-500">Pilih divisi dan staf, lalu kirim instruksi atau dikte suara.</p>
                            </div>
                            <button type="button" className={secondary} onClick={() => setOfficeSubTab('map')}>Kembali ke Denah 3D</button>
                          </div>

                          {/* Interactive Core Room Pills */}
                          <div className="space-y-2">
                            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">1. Pilih Divisi Inti</span>
                            <div className="flex flex-wrap gap-2">
                              {CORE_ROOMS.map((room) => {
                                const selected = mandateRoom === room.id;
                                return (
                                  <button
                                    key={room.id}
                                    type="button"
                                    onClick={() => {
                                      const first = getRoomStaff(room.id)[0];
                                      setMandateRoom(room.id);
                                      setMandateStaff(first.id);
                                      setMandateDivision(first.division);
                                    }}
                                    className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                                      selected ? `${room.tone} shadow-sm ring-2 ring-teal-500/20` : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {room.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Interactive Staff Chips */}
                          <div className="space-y-2">
                            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">2. Pilih Staf Penanggung Jawab</span>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {getRoomStaff(mandateRoom).map((person) => {
                                const activeStaff = mandateStaff === person.id;
                                return (
                                  <button
                                    key={person.id}
                                    type="button"
                                    onClick={() => {
                                      setMandateStaff(person.id);
                                      setMandateDivision(person.division);
                                    }}
                                    className={`rounded-2xl border p-3.5 text-left transition ${
                                      activeStaff ? 'border-teal-500 bg-teal-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-teal-200'
                                    }`}
                                  >
                                    <strong className="block text-sm text-slate-900">{person.name}</strong>
                                    <span className="text-xs text-slate-500">{person.role}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {mandateStaff === 'marketing_manager' && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-900">
                              <strong>Manajer Pemasaran:</strong> menyiapkan draf listing, caption, hashtag, dan checklist distribusi untuk ditinjau.
                            </div>
                          )}

                          <form
                            className="space-y-4"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void run(async () => {
                                const chosen = STAFF.find((person) => person.id === mandateStaff) ?? getRoomStaff(mandateRoom)[0];
                                const target = chosen.division;
                                const instruction = chosen.id === 'marketing_manager' ? marketingBriefInstruction(marketingBrief) : mandate;
                                await workflowClient.enqueue(target, chosen.id, instruction);
                                setMandate('');
                                setOfficeSubTab('map');
                              }, 'Tugas ditambahkan ke antrean. Laporan akan muncul setelah selesai.');
                            }}
                          >
                            {mandateStaff === 'marketing_manager' ? (
                              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                <h4 className="font-bold text-slate-900">Brief produk — jawab yang kamu tahu</h4>
                                <label className="block text-sm font-semibold text-slate-700">Produk
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
                                ] as const).map(([key, label]) => (
                                  <label className="block text-sm font-semibold text-slate-700" key={key}>{label}
                                    <textarea
                                      className={field}
                                      rows={key === 'verifiedFeatures' || key === 'unavailableFeatures' ? 3 : 2}
                                      maxLength={1000}
                                      value={marketingBrief[key]}
                                      onChange={(event) => setMarketingBrief((current) => ({ ...current, [key]: event.target.value }))}
                                      placeholder={key === 'verifiedFeatures' ? 'Tulis hanya fitur yang sudah kamu cek.' : 'Isi jika tahu; kalau tidak, biarkan kosong.'}
                                    />
                                  </label>
                                ))}
                                <details className="office-info-box">
                                  <summary className="text-teal-700">Lihat brief yang akan dikirim ke AI</summary>
                                  <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">{marketingBriefInstruction(marketingBrief)}</pre>
                                </details>
                              </div>
                            ) : (
                              <label className="block text-sm font-semibold text-slate-700">3. Instruksi Tugas
                                <span className="mb-1.5 mt-1 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-normal text-slate-500">Ketik atau dikte dalam Bahasa Indonesia</span>
                                  <button
                                    type="button"
                                    className={secondary}
                                    disabled={!voiceDictation.isSupported || busy}
                                    aria-pressed={voiceDictation.isListening}
                                    onClick={() => voiceDictation.isListening ? voiceDictation.stop() : voiceDictation.start()}
                                  >
                                    {voiceDictation.isListening ? <MicOff className="mr-2 inline text-rose-600" size={16} /> : <Mic className="mr-2 inline text-teal-600" size={16} />}
                                    {voiceDictation.isListening ? 'Selesai merekam' : 'Dikte suara'}
                                  </button>
                                </span>
                                <textarea
                                  className={field}
                                  required
                                  maxLength={8000}
                                  rows={5}
                                  value={mandate}
                                  onChange={(e) => setMandate(e.target.value)}
                                  placeholder="Jelaskan masalah, tujuan, batasan, dan hasil laporan yang diharapkan. Jangan sertakan data pribadi atau rahasia."
                                />
                              </label>
                            )}
                            {voiceDictation.isListening && (
                              <p role="status" aria-live="polite" className="text-sm font-medium text-teal-700">
                                Mikrofon aktif{voiceDictation.interimTranscript ? ` · ${voiceDictation.interimTranscript}` : ' · Silakan berbicara.'}
                              </p>
                            )}
                            {voiceDictation.error && <p role="alert" className="text-sm font-medium text-rose-700">{voiceDictation.error}</p>}
                            <details className="office-info-box">
                              <summary>Privasi &amp; batasan pengiriman mandat</summary>
                              <p className="mt-2 leading-relaxed text-slate-600">
                                Instruksi diproses melalui OpenRouter ke model divisi terkait. Jangan sertakan password, data anak, data kesehatan, atau data pribadi.
                              </p>
                            </details>
                            <button className={button} disabled={busy || voiceDictation.isListening}>
                              {mandateStaff === 'marketing_manager' ? 'Buat brief marketing untuk AI' : 'Siapkan draf untuk ditinjau'}
                            </button>
                          </form>
                        </motion.div>
                      )}

                      {officeSubTab === 'guide' && (
                        <motion.div key="office-guide" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-4">
                          <div className="studio-bento-card p-5 sm:p-6">
                            <h3 className="text-lg font-extrabold text-slate-900">Standar Operasional Kantor AI</h3>
                            <p className="mt-1 text-sm text-slate-500">Lima langkah terstruktur dari laporan masuk hingga eksekusi manusia.</p>
                            <div className="mt-5 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                              {WORKFLOW_STEPS.map((item) => (
                                <div key={item.step} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${item.tone}`}>
                                        Langkah {item.step} · {item.role}
                                      </span>
                                    </div>
                                    <h4 className="mt-3 text-base font-extrabold text-slate-900">{item.title}</h4>
                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.desc}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHub(item.hub);
                                      if (item.hub === 'office') setOfficeSubTab('map');
                                    }}
                                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-700 hover:text-teal-900"
                                  >
                                    {item.cta} <ArrowRight size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )}

                {/* HUB 3: PERSETUJUAN & RIWAYAT DRAF */}
                {hub === 'drafts' && (
                  <div className="grid gap-5 lg:grid-cols-3">
                    <section className="studio-bento-card space-y-4 p-5 lg:col-span-1">
                      <div className="space-y-3">
                        <h2 className="text-lg font-extrabold text-slate-900">Daftar Draf &amp; Arsip</h2>
                        <div className="relative">
                          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={draftSearch}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            placeholder="Cari judul atau divisi…"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status draf">
                          {([
                            ['PENDING', `Menunggu (${pendingDrafts.length})`],
                            ['APPROVED', 'Disetujui'],
                            ['INTERMEDIATE', 'Perantara'],
                            ['ALL', `Semua (${drafts.length})`],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setDraftFilter(key)}
                              className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                                draftFilter === key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-300'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {filteredDrafts.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Tidak ada draf pada filter ini.</p>}
                      <div className="max-h-[40rem] space-y-2.5 overflow-auto pr-1">
                        {filteredDrafts.map((draft) => (
                          <div key={draft.id} className={`rounded-2xl border p-3.5 text-sm transition ${draft.id === selectedDraftId ? 'border-teal-500 bg-teal-50/70 shadow-sm' : 'border-slate-200 bg-slate-50/70 hover:border-teal-200'}`}>
                            <button onClick={() => setSelectedDraftId(draft.id)} className="w-full text-left">
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-600 ring-1 ring-slate-200">{draft.division}</span>
                                <span className="text-[11px] text-slate-400">{new Date(draft.updatedAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
                              </div>
                              <strong className="mt-1.5 block text-slate-900">{draft.title}</strong>
                              <span className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                draft.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : draft.status === 'INTERMEDIATE' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {draft.status === 'PENDING' ? 'Menunggu persetujuan' : draft.status === 'INTERMEDIATE' ? 'Tahap perantara' : 'Disetujui'}
                              </span>
                            </button>
                            <button className="mt-2.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={busy} onClick={() => deleteDraft(draft)}>Hapus draf</button>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="studio-bento-card space-y-4 p-5 sm:p-6 lg:col-span-2">
                      {!selectedDraft ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-500">
                          Pilih salah satu laporan di sebelah kiri untuk membaca dalam tampilan dokumen, mengedit, meminta revisi, atau menyetujui.
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                            <div>
                              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold uppercase text-slate-700">{selectedDraft.division}</span>
                              <h2 className="mt-2 text-xl font-extrabold text-slate-900">{selectedDraft.title}</h2>
                              <p className="mt-1 text-xs text-slate-500">
                                {selectedDraft.ai ? `AI: ${selectedDraft.ai.provider === 'copilot' ? 'Copilot' : selectedDraft.ai.provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} · ${selectedDraft.ai.model}` : 'Model draf lama tidak tercatat.'}
                              </p>
                            </div>
                            {!selectedDraft.grounding && (
                              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                                <button
                                  type="button"
                                  onClick={() => setDraftViewMode('read')}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${draftViewMode === 'read' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                                >
                                  <Eye size={14} /> Mode Baca
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraftViewMode('edit')}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${draftViewMode === 'edit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                                >
                                  <Edit3 size={14} /> Mode Edit
                                </button>
                              </div>
                            )}
                          </div>

                          {selectedDraft.status === 'INTERMEDIATE' && <p className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-800">Tahap ini sudah diteruskan otomatis. Persetujuan diperlukan pada hasil akhir Clipper.</p>}
                          {selectedDraft.productPackageVersion === 1 && <DigitalProductDownload title={selectedDraft.title} content={content} />}
                          {selectedDraft.sourceDraftId && (
                            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-sm text-teal-800">
                              Dibuat berdasarkan riset mingguan. <button className="font-bold underline" onClick={() => setSelectedDraftId(selectedDraft.sourceDraftId!)}>Buka riset dan sumber</button>.
                            </div>
                          )}

                          {selectedDraft.grounding ? (
                            <GroundedReport draft={selectedDraft} />
                          ) : draftViewMode === 'read' ? (
                            <DraftDocumentView text={content} />
                          ) : (
                            <label className="block text-sm font-semibold text-slate-700">Edit isi laporan
                              <textarea className={field} rows={16} maxLength={30000} value={content} onChange={(e) => setContent(e.target.value)} />
                            </label>
                          )}

                          {isDigitalProductResearchDraftId(selectedDraft.id) && selectedDraft.status === 'APPROVED' && (
                            <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-4">
                              <h3 className="font-extrabold text-teal-900">Pilih ide yang ingin dibuatkan produknya</h3>
                              <p className="text-sm text-slate-600">Setiap ide yang dipilih mendapat satu tugas AI terpisah untuk membuat isi MVP dan draf listing.</p>
                              {selectedProductIdeas.length ? (
                                <div className="space-y-3">
                                  {selectedProductIdeas.map((idea) => {
                                    const job = jobs?.find((item) => item.id === digitalProductIdeaJobId(selectedDraft.id, idea.key));
                                    const productDraft = job?.draftId ? drafts.find((draft) => draft.id === job.draftId) : undefined;
                                    return (
                                      <article key={idea.key} className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
                                        <h4 className="font-bold text-slate-900">Ide {idea.number}: {idea.title}</h4>
                                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{idea.content.slice(0, 900)}{idea.content.length > 900 ? '…' : ''}</p>
                                        {job && <p className="text-sm font-semibold text-teal-700">Status: {job.status === 'QUEUED' ? 'dalam antrean' : job.status === 'RUNNING' ? 'sedang dibuat' : job.status === 'DONE' ? 'siap ditinjau' : job.status === 'FAILED' ? `gagal — ${job.error ?? ''}` : job.status}</p>}
                                        <div className="flex flex-wrap gap-2">
                                          {productDraft && <button type="button" className={secondary} onClick={() => setSelectedDraftId(productDraft.id)}>Buka draf produk</button>}
                                          {job?.status === 'FAILED' ? (
                                            <button type="button" className={secondary} disabled={busy} onClick={() => void run(async () => { await workflowClient.retryJob(job.id); setJobs((await workflowClient.jobs()).jobs); }, 'Tugas pembuatan produk dimasukkan ulang ke antrean.')}>Coba lagi</button>
                                          ) : !job && (
                                            <button type="button" className={button} disabled={busy || jobs === null} onClick={() => void run(async () => {
                                              if (!window.confirm(`Buat satu draf produk digital dari ide "${idea.title}"? Ini akan mengirim satu permintaan AI dan mungkin menimbulkan biaya.`)) return;
                                              await workflowClient.startDigitalProductIdea(selectedDraft.id, idea.title, idea.content);
                                              setJobs((await workflowClient.jobs()).jobs);
                                            }, 'Satu tugas produk untuk ide terpilih masuk antrean.')}>Buat produk dari ide ini</button>
                                          )}
                                        </div>
                                      </article>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                  <label className="block text-sm font-semibold text-slate-700">Judul ide yang dipilih
                                    <input className={field} maxLength={200} value={manualIdeaTitle} onChange={(event) => setManualIdeaTitle(event.target.value)} placeholder="Contoh: Workbook pencatatan harian UMKM" />
                                  </label>
                                  <label className="block text-sm font-semibold text-slate-700">Salin bagian ide dari laporan yang disetujui
                                    <textarea className={field} rows={4} maxLength={6000} value={manualIdeaContent} onChange={(event) => setManualIdeaContent(event.target.value)} />
                                  </label>
                                  <button type="button" className={button} disabled={busy || jobs === null || manualIdeaTitle.trim().length === 0 || manualIdeaContent.trim().length < 30} onClick={() => void run(async () => {
                                    if (!window.confirm(`Buat satu draf produk digital dari ide "${manualIdeaTitle.trim()}"?`)) return;
                                    await workflowClient.startDigitalProductIdea(selectedDraft.id, manualIdeaTitle, manualIdeaContent);
                                    setJobs((await workflowClient.jobs()).jobs);
                                    setManualIdeaTitle('');
                                    setManualIdeaContent('');
                                  }, 'Tugas produk untuk ide pilihan masuk antrean.')}>Buat produk dari ide yang dipilih</button>
                                </div>
                              )}
                              {selectedProductIdeaJobs.length > 0 && <p className="text-xs text-slate-500">{selectedProductIdeaJobs.length} ide sudah dikirim sebagai tugas produk terpisah.</p>}
                            </section>
                          )}

                          {selectedDraft.contentPackageVersion === 1 && selectedDraft.division === 'creator' && (
                            <CapCutExportActions title={selectedDraft.title} content={content} />
                          )}

                          <div className="flex flex-wrap gap-2">
                            {draftViewMode === 'edit' && (
                              <button className={secondary} disabled={busy || selectedDraft.status === 'INTERMEDIATE' || !!selectedVideo || !!selectedDraft.grounding} onClick={() => updateDraft('EDIT')}>Simpan edit</button>
                            )}
                            <button className={button} disabled={busy || selectedDraft.status !== 'PENDING'} onClick={() => updateDraft('APPROVE')}>Setujui</button>

                            {continuation?.id === selectedDraft.id && continuation.eligible && (
                              <button className={secondary} disabled={busy} onClick={() => void run(async () => { await workflowClient.continueContent(selectedDraft.id); setContinuation({ id: selectedDraft.id, eligible: false, forwarded: true }); }, 'Laporan Trendy diteruskan ke Script-AI.')}>Teruskan laporan Trendy lama</button>
                            )}
                            {mandateContentFollowup?.id === selectedDraft.id && mandateContentFollowup.eligible && (
                              <button className={secondary} disabled={busy} onClick={() => void run(async () => { const res = await workflowClient.startMandateContentFollowup(selectedDraft.id); setMandateContentFollowup({ id: selectedDraft.id, eligible: false, forwarded: true, flowId: res.id }); setJobs((await workflowClient.jobs()).jobs); }, 'Mandat diteruskan ke Trendy → Script-AI → Clipper.')}>Teruskan ke Content Creator</button>
                            )}
                            {marketingContentFollowup?.id === selectedDraft.id && marketingContentFollowup.eligible && (
                              <button className={secondary} disabled={busy} onClick={() => void run(async () => { await workflowClient.startMarketingContentFollowup(selectedDraft.id); setMarketingContentFollowup({ id: selectedDraft.id, ...(await workflowClient.marketingContentFollowup(selectedDraft.id)) }); setJobs((await workflowClient.jobs()).jobs); }, 'Laporan Manajer Pemasaran diteruskan ke Trendy → Script-AI → Clipper.')}>Teruskan ke Content Creator</button>
                            )}
                            {marketingContentFollowup?.id === selectedDraft.id && marketingContentFollowup.forwarded && (
                              <section className="w-full space-y-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 text-sm">
                                <p className="font-bold text-teal-900">Alur Content Creator {marketingContentFollowup.flowId ? `(${marketingContentFollowup.flowId.slice(0, 8)})` : ''}</p>
                                {marketingContentFollowup.stages.map((stage) => (
                                  <div key={stage.id} className="flex flex-wrap items-center gap-2 text-slate-700">
                                    <span>{stage.staffId === 'trendy' ? 'Trendy' : stage.staffId === 'script_ai' ? 'Script-AI' : stage.staffId === 'clipper' ? 'Clipper' : stage.title}: {stage.status}</span>
                                    {stage.status === 'FAILED' && <button className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800" disabled={busy} onClick={() => void run(async () => { await workflowClient.retryJob(stage.id); setMarketingContentFollowup({ id: selectedDraft.id, ...(await workflowClient.marketingContentFollowup(selectedDraft.id)) }); }, 'Tahap dimasukkan ulang ke antrean.')}>Coba lagi</button>}
                                    {stage.status === 'DONE' && stage.draftId && <button className="font-semibold text-teal-700 underline" onClick={() => setSelectedDraftId(stage.draftId!)}>Buka hasil tahap</button>}
                                  </div>
                                ))}
                              </section>
                            )}

                            {creatorFollowup?.id === selectedDraft.id && creatorFollowup.eligible && (
                              <label className="block w-full text-sm font-semibold text-slate-700">Fitur Siput PAUD/Posyandu yang sudah kamu verifikasi
                                <textarea className={field} rows={3} maxLength={4000} value={verifiedProductFacts} onChange={(event) => setVerifiedProductFacts(event.target.value)} placeholder="Tuliskan hanya fitur yang sudah kamu pastikan benar." />
                              </label>
                            )}
                            {creatorFollowup?.id === selectedDraft.id && creatorFollowup.eligible && (
                              <button className={secondary} disabled={busy || !verifiedProductFacts.trim()} onClick={() => void run(async () => { const res = await workflowClient.startCreatorFollowup(selectedDraft.id, verifiedProductFacts); setCreatorFollowup({ id: selectedDraft.id, eligible: false, status: res.status }); setJobs((await workflowClient.jobs()).jobs); }, 'Tugas Creator masuk antrean.')}>Lanjutkan ke Content Creator</button>
                            )}

                            <button className={secondary} disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(content); }, 'Isi laporan disalin.')}>Salin isi</button>
                            <button className={secondary} disabled={busy} onClick={() => void run(async () => { const result = await workflowClient.events(selectedDraft.id); setEvents(result.events); })}>Riwayat versi</button>
                            <button className="min-h-11 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={busy} onClick={() => deleteDraft(selectedDraft)}>Hapus</button>
                          </div>

                          {selectedDraft.contentPackageVersion === 1 && selectedDraft.status === 'APPROVED' && (
                            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                              <h3 className="font-extrabold text-slate-900">Video AI</h3>
                              <p className="text-xs text-slate-600">Pilih satu ide video untuk dibuat sekarang (hanya naskah dan visual ide terpilih yang dikirim).</p>
                              {selectedVideoIdeas.length > 1 && (
                                <label className="block text-sm font-semibold text-slate-700">Ide video yang akan dibuat
                                  <select className={field} value={selectedVideoIdeaKey} onChange={(event) => setSelectedVideoIdeaKey(event.target.value)}>
                                    <option value="">Pilih ide video</option>
                                    {selectedVideoIdeas.map((idea) => <option key={idea.key} value={idea.key}>{idea.number ? `Video ${idea.number}: ` : ''}{idea.title}</option>)}
                                  </select>
                                </label>
                              )}
                              {videos === null ? <p className="text-sm font-medium text-amber-800">Status video tidak tersedia.</p> : (
                                <>
                                  {selectedVideoJobs.map((videoJob) => (
                                    <div key={videoJob.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3.5">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {videoJob.title} · {new Date(videoJob.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB · {videoJob.status}
                                      </p>
                                      {videoJob.error && <p className="text-sm font-medium text-amber-800">{videoJob.error}</p>}
                                      {videoJob.status === 'UNKNOWN' && videos.authenticated && (
                                        <button className={secondary} disabled={busy} onClick={() => void run(async () => {
                                          if (!window.confirm('Pastikan sudah memeriksa Logs & Usage OpenRouter dahulu. Lanjut melepas kunci?')) return;
                                          await workflowClient.acknowledgeUnknownVideo(videoJob.id);
                                          await loadVideos();
                                        }, 'Kunci percobaan dilepas.')}>Saya sudah cek OpenRouter — izinkan coba lagi</button>
                                      )}
                                      {videoJob.status === 'READY' && (
                                        <>
                                          <video controls preload="metadata" className="max-h-96 rounded-xl" src={`/api/workflow/videos/${encodeURIComponent(videoJob.id)}/file`} />
                                          <a className={`${secondary} inline-flex items-center`} href={`/api/workflow/videos/${encodeURIComponent(videoJob.id)}/file`} download={`video-konten-${videoJob.id}.mp4`}>Unduh hasil ini</a>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                  {videos.enabled && videos.authenticated && !videoGenerationUnknown ? (
                                    <button
                                      className={button}
                                      disabled={busy || videoGenerationActive || !selectedVideoIdea}
                                      onClick={() => void run(async () => {
                                        const idea = selectedVideoIdea;
                                        if (!idea) throw new Error('Pilih satu ide video terlebih dahulu.');
                                        if (!window.confirm(`${selectedVideoJobs.length ? 'Buat ulang' : 'Buat'} video AI untuk "${idea.title}"? Anggaran disetujui Rp${videos.approvedBudgetIdr.toLocaleString('id-ID')}.`)) return;
                                        await workflowClient.createVideo(selectedDraft.id, idea.key);
                                        await loadVideos();
                                      }, 'Permintaan video masuk antrean.')}
                                    >
                                      {videoGenerationActive ? 'Video sedang diproses' : `${selectedVideoJobs.length ? 'Buat ulang' : 'Buat'} video untuk ide terpilih`}
                                    </button>
                                  ) : !videoGenerationUnknown && (
                                    <p className="text-sm font-medium text-amber-800">{videos.enabled ? 'Login admin melalui Beranda untuk membuat video.' : 'Video Terkunci — aktifkan saklar admin di Beranda.'}</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          <div className="space-y-2 border-t border-slate-100 pt-4">
                            <label className="block text-sm font-semibold text-slate-700">Arahan revisi AI
                              <textarea className={field} rows={2} maxLength={4000} value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Tulis instruksi perbaikan untuk AI…" />
                            </label>
                            {draftActionError?.id === selectedDraft.id && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">Aksi draf gagal: {draftActionError.message}</p>}
                            <button className={secondary} disabled={busy || selectedDraft.status === 'INTERMEDIATE' || !!selectedVideo || !!selectedDraft.grounding || !revision.trim()} onClick={() => updateDraft('REVISE')}>Minta Revisi AI</button>
                          </div>

                          <details className="office-info-box">
                            <summary>Catatan keamanan persetujuan</summary>
                            <p className="mt-2 text-slate-600">Verifikasi fakta dan keamanan sebelum persetujuan. Persetujuan tidak mengirim WhatsApp, memperbaiki kode, atau mempublikasikan konten secara otomatis.</p>
                          </details>

                          {events.length > 0 && (
                            <div className="space-y-2 border-t border-slate-100 pt-4">
                              <h3 className="font-extrabold text-slate-900">Riwayat versi tersimpan</h3>
                              {events.map((event) => (
                                <details key={event.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm">
                                  <summary className="cursor-pointer font-bold text-slate-800">{event.action} · {new Date(event.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</summary>
                                  {event.data.ai && <p className="mt-2 text-xs text-slate-500">AI: {event.data.ai.provider} · {event.data.ai.model}</p>}
                                  {event.notes && <p className="mt-2 text-xs font-medium text-amber-800">Arahan: {event.notes}</p>}
                                  {event.data.grounding ? <GroundedReport draft={event.data} /> : <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 font-sans text-slate-700">{event.data.content}</pre>}
                                </details>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  </div>
                )}

                {/* HUB 4: STUDIO KONTEN (BUAT KONTEN + SIAP PUBLIKASI) */}
                {hub === 'content' && (
                  <section className="space-y-5">
                    <SubTabBar
                      layoutId="content-subtab"
                      active={contentSubTab}
                      onChange={setContentSubTab}
                      items={[
                        { id: 'create', label: 'Buat Konten', Icon: Film },
                        { id: 'publication', label: 'Siap Publikasi', Icon: Megaphone, badge: readyForPublication.length },
                      ]}
                    />

                    <AnimatePresence mode="wait">
                      {contentSubTab === 'create' ? (
                        <motion.div key="content-create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="studio-bento-card space-y-5 p-5 sm:p-6">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">Buat Paket Konten Video Pendek</h3>
                            <p className="mt-1 text-sm text-slate-500">Pilih mode eksekusi hemat atau mendalam, lalu masukkan topikmu.</p>
                          </div>

                          <div className="grid gap-3.5 sm:grid-cols-2" role="radiogroup" aria-label="Mode pembuatan konten">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={contentMode === 'fast'}
                              onClick={() => setContentMode('fast')}
                              className={`rounded-2xl border p-4 text-left transition ${contentMode === 'fast' ? 'border-rose-400 bg-rose-50/60 shadow-sm ring-2 ring-rose-500/15' : 'border-slate-200 bg-slate-50/60 hover:border-rose-200'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <strong className="text-sm font-extrabold text-slate-900">Mode Hemat · 1x AI</strong>
                                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">Disarankan</span>
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Clipper langsung menyusun paket lengkap 8 bagian dalam 1 panggilan AI (~66% lebih hemat token).</p>
                            </button>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={contentMode === 'deep'}
                              onClick={() => setContentMode('deep')}
                              className={`rounded-2xl border p-4 text-left transition ${contentMode === 'deep' ? 'border-rose-400 bg-rose-50/60 shadow-sm ring-2 ring-rose-500/15' : 'border-slate-200 bg-slate-50/60 hover:border-rose-200'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <strong className="text-sm font-extrabold text-slate-900">Mode Mendalam · 3x AI</strong>
                                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">Berantai</span>
                              </div>
                              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Alur Trendy → Script-AI → Clipper berurutan untuk eksplorasi ide bertahap.</p>
                            </button>
                          </div>

                          <div className="space-y-2">
                            <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Inspirasi Topik Cepat</span>
                            <div className="flex flex-wrap gap-2">
                              {TOPIC_IDEAS.map((idea) => (
                                <button
                                  key={idea}
                                  type="button"
                                  onClick={() => setTopic(idea)}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50"
                                >
                                  + {idea}
                                </button>
                              ))}
                            </div>
                          </div>

                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void run(async () => {
                                if (contentMode === 'fast') {
                                  await workflowClient.enqueue(
                                    'creator',
                                    'clipper',
                                    `Buat paket konten video pendek lengkap (ide, hook 3 detik, naskah narasi, caption, tagar, dan tata letak visual) untuk topik berikut dalam satu laporan matang: ${topic}. Sajikan usulan konten, bukan klaim tren yang sudah diverifikasi.`,
                                  );
                                } else {
                                  await workflowClient.enqueue('creator', 'trendy', `Buat ide konten untuk topik berikut: ${topic}. Sajikan usulan video pendek, bukan klaim tren yang sudah diverifikasi.`);
                                }
                                setTopic('');
                                setHub('office');
                                setOfficeSubTab('map');
                              }, contentMode === 'fast' ? 'Tugas konten Mode Hemat (1x AI) ditambahkan ke antrean.' : 'Tugas konten berantai (3x AI) ditambahkan ke antrean.');
                            }}
                            className="space-y-3"
                          >
                            <label className="block text-sm font-semibold text-slate-700">Topik konten
                              <textarea className={field} required maxLength={500} rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: tips mengatasi error login operator PAUD" />
                            </label>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="text-xs text-slate-500">Jangan sertakan data pribadi atau rahasia dalam topik.</span>
                              <button className={`${button} inline-flex items-center gap-2`} disabled={busy}>
                                <Send size={15} /> {contentMode === 'fast' ? 'Buat draf konten (1x AI)' : 'Buat draf konten (3x AI)'}
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      ) : (
                        <motion.div key="content-pub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="studio-bento-card space-y-4 p-5 sm:p-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-900">Paket Konten Siap Publikasi</h3>
                              <p className="mt-1 text-sm text-slate-500">Status Video AI: <strong>{videos?.enabled ? 'Aktif' : 'Terkunci'}</strong> · unggahan ke platform sosial tetap dilakukan manual.</p>
                            </div>
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                              {readyForPublication.length} paket disetujui
                            </span>
                          </div>
                          {!draftsAvailable ? <p className="text-sm font-medium text-amber-700">Daftar tidak tersedia. Muat ulang untuk memeriksa.</p>
                            : readyForPublication.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                                Belum ada paket konten yang disetujui. Buat di tab “Buat Konten” lalu setujui di menu Persetujuan.
                              </div>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {readyForPublication.map((draft) => {
                                  const vStatus = videos?.jobs.find((job) => job.draftId === draft.id)?.status;
                                  return (
                                    <button
                                      key={draft.id}
                                      onClick={() => { setSelectedDraftId(draft.id); setDraftFilter('APPROVED'); setHub('drafts'); }}
                                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50/30"
                                    >
                                      <div>
                                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                                          Disetujui · {vStatus ?? 'CapCut / manual'}
                                        </span>
                                        <strong className="mt-2 block text-sm font-extrabold text-slate-900">{draft.title}</strong>
                                      </div>
                                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                                        Buka skrip &amp; ekspor JSON <ArrowRight size={13} />
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )}

                {/* HUB 5: BISNIS & KAS */}
                {hub === 'business' && (
                  <BusinessCenter
                    onDraft={addDraft}
                    jobs={jobs}
                    onRetry={sceneProps.onRetry}
                    onDismissSprint={sceneProps.onDismissSprint}
                    onStartSprintJob={sceneProps.onStartSprintJob}
                    onStartDailyProductJob={sceneProps.onStartDailyProductJob}
                  />
                )}

                {/* HUB 6: KLIEN & LISENSI */}
                {hub === 'clients' && (
                  <section className="space-y-5">
                    <SubTabBar
                      layoutId="clients-subtab"
                      active={clientsSubTab}
                      onChange={setClientsSubTab}
                      items={[
                        { id: 'tickets', label: 'Layanan Klien', Icon: Headphones, badge: openTicketsCount },
                        { id: 'license', label: 'Generator Lisensi', Icon: KeyRound },
                      ]}
                    />

                    <AnimatePresence mode="wait">
                      {clientsSubTab === 'tickets' ? (
                        <motion.div key="clients-tickets" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="grid gap-5 lg:grid-cols-2">
                          <form className="studio-bento-card space-y-4 p-5 sm:p-6" onSubmit={submitTicket}>
                            <div>
                              <h3 className="text-lg font-extrabold text-slate-900">Catat Laporan WhatsApp Business</h3>
                              <p className="mt-1 text-xs text-slate-500">Samarkan data pribadi sebelum menyimpan. Laporan masuk antrean staf PAUD/Posyandu.</p>
                            </div>

                            <div className="space-y-2">
                              <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Produk</span>
                              <div className="grid grid-cols-2 gap-2">
                                {([['paud', 'Siput PAUD'], ['posyandu', 'Siput Posyandu']] as const).map(([val, lbl]) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setDivision(val)}
                                    className={`rounded-xl border py-2.5 text-sm font-bold transition ${division === val ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                  >
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">Jenis Laporan</span>
                              <div className="grid grid-cols-3 gap-2">
                                {([['BUG', 'Bug / Error'], ['QUESTION', 'Pertanyaan'], ['COMPLAINT', 'Keluhan']] as const).map(([val, lbl]) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setCategory(val)}
                                    className={`rounded-xl border py-2 text-xs font-bold transition ${category === val ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                                  >
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <label className="block text-sm font-semibold text-slate-700">Judul
                              <input className={field} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Gagal ekspor rekap bulanan" />
                            </label>
                            <label className="block text-sm font-semibold text-slate-700">Kronologi tanpa data pribadi
                              <textarea className={field} required maxLength={8000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Langkah sebelum error, hasil yang diharapkan, dan pesan error yang sudah disamarkan…" />
                            </label>
                            <button className={button} disabled={busy}>Simpan &amp; Antrekan Laporan</button>
                          </form>

                          <section className="studio-bento-card space-y-4 p-5 sm:p-6">
                            <h3 className="text-lg font-extrabold text-slate-900">Antrean Klien ({tickets.length})</h3>
                            <div className="max-h-64 space-y-2 overflow-auto pr-1">
                              {tickets.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Belum ada laporan klien.</p>}
                              {tickets.map((ticket) => (
                                <button
                                  key={ticket.id}
                                  onClick={() => setSelectedTicketId(ticket.id)}
                                  className={`w-full rounded-2xl border p-3.5 text-left text-sm transition ${ticket.id === selectedTicketId ? 'border-blue-500 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-slate-50/70 hover:border-blue-200'}`}
                                >
                                  <strong className="text-slate-900">{ticket.title}</strong>
                                  <span className="mt-1 block text-xs font-semibold text-slate-500">{ticket.division.toUpperCase()} · {ticket.category} · {labels[ticket.status]}</span>
                                </button>
                              ))}
                            </div>
                            {selectedTicket && (
                              <div className="space-y-3 border-t border-slate-100 pt-4">
                                <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800">{selectedTicket.description}</div>
                                <label className="block text-sm font-semibold text-slate-700">Status
                                  <select className={field} value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)}>
                                    {(Object.keys(labels) as TicketStatus[]).map((key) => <option key={key} value={key}>{labels[key]}</option>)}
                                  </select>
                                </label>
                                <label className="block text-sm font-semibold text-slate-700">Catatan tindak lanjut manual
                                  <textarea className={field} rows={3} maxLength={8000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: jawaban telah dikirim manual setelah persetujuan." />
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className={secondary}
                                    disabled={busy}
                                    onClick={() => void run(async () => {
                                      const { ticket } = await workflowClient.updateTicket(selectedTicket.id, status, notes);
                                      setTickets((old) => old.map((item) => item.id === ticket.id ? ticket : item));
                                    }, 'Status dan catatan tersimpan.')}
                                  >
                                    Simpan tindak lanjut
                                  </button>
                                  <button
                                    className={button}
                                    disabled={busy}
                                    onClick={() => void run(async () => {
                                      if (status !== selectedTicket.status || notes !== selectedTicket.notes) throw new Error('Simpan tindak lanjut sebelum membuat laporan AI.');
                                      await workflowClient.enqueueTicketReport(selectedTicket.id);
                                    }, 'Laporan tambahan ditambahkan ke antrean.')}
                                  >
                                    Antrekan laporan tambahan
                                  </button>
                                </div>
                              </div>
                            )}
                          </section>
                        </motion.div>
                      ) : (
                        <motion.div key="clients-license" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                          <LicenseGenerator />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )}

                {/* HUB 7: ASISTEN SUARA */}
                {hub === 'assistant' && <OfficeAssistant />}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Mobile Frosted Bottom Dock */}
          <nav aria-label="Navigasi cepat" className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-md lg:hidden">
            <div className="grid grid-cols-5">
              {([
                ['dashboard', 'Beranda', LayoutDashboard],
                ['office', 'Kantor 3D', MapIcon],
                ['drafts', 'Persetujuan', ClipboardCheck],
                ['content', 'Konten', Film],
                ['assistant', 'Asisten', Mic],
              ] as const).map(([id, label, Icon]) => {
                const active = hub === id;
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setHub(id)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold transition ${active ? 'text-teal-700' : 'text-slate-500'}`}
                  >
                    <span className="relative rounded-xl px-3 py-1">
                      {active && (
                        <motion.span
                          layoutId="mobile-nav-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-teal-50"
                        />
                      )}
                      <Icon size={19} className="relative z-10" />
                      {id === 'drafts' && pendingCount !== null && pendingCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 z-20 rounded-full bg-amber-400 px-1.5 text-[9px] font-extrabold text-slate-900">{pendingCount}</span>
                      )}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </MotionConfig>
  );
}
