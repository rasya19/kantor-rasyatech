import React from 'react';
import { DraftReport, StaffMember } from '../types';
import { STAFF_LIST, PRESET_TASKS } from '../data/officeData';
import { 
  ShieldCheck, 
  Sparkles, 
  Bot, 
  School, 
  HeartPulse, 
  Clapperboard, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Send, 
  Radio, 
  Flame,
  FileText,
  UserCheck
} from 'lucide-react';

interface DashboardViewProps {
  currentDraft: DraftReport | null;
  pendingCount: number;
  approvedCount: number;
  onNavigateToApproval: () => void;
  onNavigateToBlueprint: () => void;
  onNavigateToStaff: () => void;
  onOpenCommandModal: () => void;
  onSelectStaffForTask: (staff: StaffMember) => void;
  onProactiveScan: () => void;
  onTriggerCreatorRoutine: () => void;
  isProcessing: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentDraft,
  pendingCount,
  approvedCount,
  onNavigateToApproval,
  onNavigateToBlueprint,
  onNavigateToStaff,
  onOpenCommandModal,
  onSelectStaffForTask,
  onProactiveScan,
  onTriggerCreatorRoutine,
  isProcessing,
}) => {
  return (
    <div className="space-y-6">
      {/* Executive Live Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0 shadow-lg">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  Kantor AI Mandiri PT Rasyatech Digital Zenith
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  LIVE 24/7
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Pimpinan: <span className="text-white font-bold">Bos Ismanto</span>. 3 Divisi Virtual beroperasi otonom menjemput bola dari pemantauan data Dapodik, kurva stunting balita, hingga konten drama viral 06.00 WIB.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={onOpenCommandModal}
              className="flex-1 lg:flex-initial px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Beri Mandat Bos</span>
            </button>
            <button
              onClick={onProactiveScan}
              disabled={isProcessing}
              className="flex-1 lg:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>⚡ Radar Proaktif</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Total Staf AI Siaga</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5 flex items-center gap-1.5">
              <span>9 Pegawai</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">3 Divisi Aktif Mandiri</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Jejaring Siput PAUD</div>
            <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
              47+ PAUD
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">1.240 Kontak Siap Blast</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Radar Stunting Posyandu</div>
            <div className="text-lg font-bold font-mono text-teal-300 mt-0.5">
              KMS & Z-Score
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Standar Baku Kemenkes WHO</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[11px] text-slate-400">Siklus Konten 06.00 WIB</div>
            <div className="text-lg font-bold font-mono text-pink-400 mt-0.5">
              Rasio 9:16
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">TikTok / Reels / Shorts</div>
          </div>
        </div>
      </div>

      {/* Meja Bos: Active Draft Pending Review Highlight */}
      {currentDraft && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/90 border-2 border-teal-500/40 p-5 shadow-2xl relative">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Draf Terkini di Meja Persetujuan Bos Ismanto</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentDraft.status === 'PENDING_APPROVAL' ? 'MENUNGGU PERSETUJUAN' : 'TELAH DISETUJUI'}
                </span>
              </h2>
            </div>

            <button
              onClick={onNavigateToApproval}
              className="text-xs font-bold text-teal-300 hover:text-teal-200 flex items-center gap-1 group cursor-pointer"
            >
              <span>Buka di Meja Persetujuan (Approval Center)</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <div>
                <span className="text-slate-500">Divisi:</span>{' '}
                <span className="text-white font-semibold">{currentDraft.division}</span>
              </div>
              <div>
                <span className="text-slate-500">Staf Penanggung Jawab:</span>{' '}
                <span className="text-amber-300 font-semibold">{currentDraft.assignedStaff}</span>
              </div>
              {currentDraft.pemicuTren && (
                <div>
                  <span className="text-slate-500">Pemicu / Jadwal:</span>{' '}
                  <span className="text-teal-300 font-medium">{currentDraft.pemicuTren}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 italic pt-1 border-t border-slate-800/80">
              "{currentDraft.ringkasanDraf || currentDraft.taskPrompt}"
            </p>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Draf siap dieksekusi: WhatsApp Broadcast / Social Media 9:16
              </span>
              <button
                onClick={onNavigateToApproval}
                className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tinjau & Putuskan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Main Division Focus Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Divisi 1: Siput PAUD */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-amber-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <School className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                SaaS Pendidikan
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Divisi Siput PAUD
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Otomasi kalender akademik, sinkronisasi Dapodik, verifikasi laporan BOP Dikdasmen, dan broadcast ke 47+ PAUD mitra (1.240+ kontak).
            </p>

            <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Staf AI Penanggung Jawab:
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Arka · AI Research (Dapodik & BOP)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Lisa · AI Copywriter (siput.id Edukasi)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Dewi · AI Publisher (WA Blast 47 PAUD)</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-amber-400 font-mono">
              siput.id · PSE Komdigi
            </span>
            <button
              onClick={() => {
                const dewi = STAFF_LIST.find((s) => s.id === 'dewi');
                if (dewi) onSelectStaffForTask(dewi);
              }}
              className="text-xs text-slate-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Beri Tugas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Divisi 2: Siput Posyandu */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-teal-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <HeartPulse className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-bold">
                SaaS Kesehatan Desa
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Divisi Siput Posyandu
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Pencatatan tumbuh kembang KIA, deteksi dini stunting online, kurva KMS Z-Score WHO, dan komunikasi ramah kader desa & dinas.
            </p>

            <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Staf AI Penanggung Jawab:
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                <span>Dr. AI · AI Research (Stunting & KMS)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>Budi · AI Guidance (Panduan Kader Awam)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Sari · AI Outreach (Sosialisasi Desa)</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-teal-400 font-mono">
              SIP Posyandu · Ramah Kader
            </span>
            <button
              onClick={() => {
                const drAi = STAFF_LIST.find((s) => s.id === 'dr_ai');
                if (drAi) onSelectStaffForTask(drAi);
              }}
              className="text-xs text-slate-300 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Beri Tugas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Divisi 3: Content Creator */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-pink-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
                <Clapperboard className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20 font-bold">
                06.00 WIB Cron Harian
              </span>
            </div>

            <h3 className="text-base font-bold text-white mb-1">
              Divisi Content Creator
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Mesin harian proaktif: Riset tren harian, naskah 15-30 detik dengan Hook 3 detik pertama (TikTok/Reels/Shorts 9:16), caption, tagar FYP & soft-selling.
            </p>

            <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">
                Staf AI Penanggung Jawab:
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>Trendy · AI Trend Hunter (Scan 06.00 WIB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                <span>Script-AI · AI Scriptwriter (Hook 3 Detik)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span>Clipper · AI Social Manager (Tagar & Jam FYP)</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-pink-400 font-mono">
              9:16 Viral · Trafik & AdSense
            </span>
            <button
              onClick={onTriggerCreatorRoutine}
              disabled={isProcessing}
              className="text-xs text-pink-300 hover:text-pink-200 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Jalankan 06.00 WIB</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 9 Staf AI Siaga Grid Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Status 9 Staf Virtual Siaga
              </h2>
              <p className="text-xs text-slate-400">
                Pilih staf untuk memberikan mandat khusus atau meninjau spesialisasi
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToStaff}
            className="text-xs text-teal-300 hover:text-teal-200 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Direktori Lengkap 9 Staf</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STAFF_LIST.map((staff) => (
            <div
              key={staff.id}
              onClick={() => onSelectStaffForTask(staff)}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-teal-500/50 transition-all flex items-start gap-3 group cursor-pointer"
            >
              <div
                className={`w-9 h-9 rounded-lg ${staff.avatarBg} text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-md group-hover:scale-105 transition-transform`}
              >
                {staff.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors truncate">
                    {staff.name}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Siaga
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate font-medium">
                  {staff.role}
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-1">
                  {staff.specialty}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
