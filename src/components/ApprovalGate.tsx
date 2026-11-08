import React, { useState, useEffect } from 'react';
import { DraftReport } from '../types';
import { 
  CheckCircle2, 
  Edit3, 
  Copy, 
  Download, 
  Share2, 
  Sparkles, 
  Check, 
  Clock, 
  ShieldCheck, 
  RotateCcw,
  School,
  HeartPulse,
  Clapperboard,
  Send,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ApprovalGateProps {
  currentDraft: DraftReport | null;
  draftList?: DraftReport[];
  onSelectDraft?: (draft: DraftReport) => void;
  onApprove: (draft: DraftReport) => void;
  onRequestRevision: (draft: DraftReport) => void;
  onUpdateDraftContent: (newContent: string) => void;
}

export const ApprovalGate: React.FC<ApprovalGateProps> = ({
  currentDraft,
  draftList = [],
  onSelectDraft,
  onApprove,
  onRequestRevision,
  onUpdateDraftContent,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isEditingInline, setIsEditingInline] = useState<boolean>(false);
  const [editableText, setEditableText] = useState<string>('');

  useEffect(() => {
    if (currentDraft) {
      setEditableText(currentDraft.hasilDraf);
      setIsEditingInline(false);
    }
  }, [currentDraft]);

  if (!currentDraft) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-500 mx-auto flex items-center justify-center mb-4">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white mb-2">
          Belum Ada Draf Menunggu Persetujuan
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Silakan klik tombol <span className="text-teal-400 font-semibold">[🚀 Beri Mandat Bos]</span> di sidebar atau picu <span className="text-teal-400 font-semibold">⚡ Radar Otonom</span>. Staf virtual PT Rasyatech Digital Zenith siap meriset dan menyusun draf matang.
        </p>
      </div>
    );
  }

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(currentDraft.formattedReport);
      setCopiedType('report');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyDraftOnly = async () => {
    try {
      await navigator.clipboard.writeText(currentDraft.hasilDraf);
      setCopiedType('draft');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportFile = (format: 'txt' | 'md' | 'json') => {
    let content = '';
    let mimeType = 'text/plain';
    const filename = `Draf_${currentDraft.divisionId}_${Date.now()}.${format}`;

    if (format === 'txt' || format === 'md') {
      content = currentDraft.formattedReport;
    } else {
      content = JSON.stringify(currentDraft, null, 2);
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApproveWithConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }
    onApprove(currentDraft);
  };

  const handleSaveInlineEdit = () => {
    onUpdateDraftContent(editableText);
    setIsEditingInline(false);
  };

  const pendingDrafts = draftList.filter((d) => d.status === 'PENDING_APPROVAL');

  return (
    <div className="space-y-4">
      {/* Pending Drafts Queue Bar if multiple exist */}
      {pendingDrafts.length > 1 && onSelectDraft && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2 overflow-x-auto shadow-md">
          <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap pl-1 shrink-0 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>Antrean Draf ({pendingDrafts.length}):</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {pendingDrafts.map((d, idx) => {
              const isSelected = d.id === currentDraft.id;
              return (
                <button
                  key={d.id}
                  onClick={() => onSelectDraft(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-950/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <span className="text-[10px] opacity-75">#{idx + 1}</span>
                  <span>{d.assignedStaff.split(' ')[0]}</span>
                  <span className="text-[10px] opacity-75">({d.divisionId.toUpperCase()})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Approval Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-white">
        {/* Top Header: Status & Tools */}
        <div className="bg-slate-850 border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/40">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Daftar Persetujuan (Approval Center)
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  currentDraft.status === 'PENDING_APPROVAL'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {currentDraft.status === 'PENDING_APPROVAL' ? 'MENUNGGU PERSETUJUAN' : 'TELAH DISETUJUI'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Pimpinan: <span className="text-slate-200 font-semibold">Bos Ismanto</span> · PT Rasyatech Digital Zenith
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Copy Buttons */}
            <button
              onClick={handleCopyDraftOnly}
              className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-slate-200 border border-slate-700 cursor-pointer"
              title="Salin isi draf saja"
            >
              {copiedType === 'draft' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Salin Draf</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyReport}
              className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-slate-200 border border-slate-700 cursor-pointer"
              title="Salin laporan lengkap dengan format baku"
            >
              {copiedType === 'report' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-bold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Salin Format Baku</span>
                </>
              )}
            </button>

            {/* Export Dropdown */}
            <div className="relative flex items-center">
              <button
                onClick={() => handleExportFile('txt')}
                className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-slate-200 border border-slate-700 cursor-pointer"
                title="Ekspor ke berkas teks"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Ekspor .txt</span>
              </button>
            </div>
          </div>
        </div>

        {/* Division Knowledge Base Trust Banner */}
        <div className="px-5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {currentDraft.divisionId === 'paud' && (
              <>
                <School className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-semibold">Knowledge Base siput.id:</span>
                <span className="text-slate-400 hidden sm:inline">1-Klik Sinkronisasi Dapodik & BOP Dikdasmen · Presensi Otomatis · Terdaftar PSE Komdigi RI</span>
              </>
            )}
            {currentDraft.divisionId === 'posyandu' && (
              <>
                <HeartPulse className="w-4 h-4 text-teal-400" />
                <span className="text-teal-300 font-semibold">Knowledge Base SIP Posyandu:</span>
                <span className="text-slate-400 hidden sm:inline">Standar Baku Kemenkes & WHO Z-Score · Deteksi Dini Stunting · Ramah Kader Desa</span>
              </>
            )}
            {currentDraft.divisionId === 'creator' && (
              <>
                <Clapperboard className="w-4 h-4 text-pink-400" />
                <span className="text-pink-300 font-semibold">Distribusi Medsos 9:16:</span>
                <span className="text-slate-400 hidden sm:inline">TikTok / Reels / Shorts · Hook 0-3s · Soft-selling Produk PT Rasyatech · Jam Tayang Optimal</span>
              </>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Dibuat: {new Date(currentDraft.createdAt).toLocaleTimeString('id-ID')} WIB
          </div>
        </div>

        {/* Mandate Prompt Reference */}
        <div className="bg-slate-950/40 px-5 py-3 border-b border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
          <span className="font-semibold text-teal-400 shrink-0">Instruksi Bos:</span>
          <span className="italic text-slate-200">{currentDraft.taskPrompt}</span>
        </div>

        {/* Standard Formatted Report Block (Mandated by Prompt) */}
        <div className="p-5 sm:p-6 bg-slate-950">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 font-mono text-xs text-slate-200 leading-relaxed shadow-inner">
            <div className="text-teal-400 font-bold mb-2">---</div>
            <div className="text-teal-300 font-bold tracking-wider text-sm mb-3 flex items-center gap-2">
              <span>
                {currentDraft.divisionId === 'creator'
                  ? '📥 [LAPORAN PROAKTIF KONTEN HARIAN - HARI INI]'
                  : '📥 [LAPORAN PROAKTIF KANTOR AI]'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 mb-3">
              {currentDraft.divisionId === 'creator' ? (
                <>
                  <div>
                    <span className="text-slate-400">Divisi: </span>
                    <span className="text-white font-semibold">Content Creator</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Staf: </span>
                    <span className="text-amber-300 font-semibold">Trendy & Script-AI</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Ide Konten Harian: </span>
                    <span className="text-teal-300 font-semibold">
                      {currentDraft.taskPrompt.replace(/^Siklus Harian Otomatis 06\.00 Pagi:\s*/i, '')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Target Platform: </span>
                    <span className="text-pink-300 font-semibold">TikTok / Reels / Shorts (9:16)</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-slate-400">Divisi: </span>
                    <span className="text-white font-semibold">{currentDraft.division}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Pegawai AI Penanggung Jawab: </span>
                    <span className="text-amber-300 font-semibold">{currentDraft.assignedStaff}</span>
                  </div>
                  {currentDraft.pemicuTren && (
                    <div>
                      <span className="text-slate-400">Pemicu / Tren Terdeteksi: </span>
                      <span className="text-teal-300 font-semibold">{currentDraft.pemicuTren}</span>
                    </div>
                  )}
                  {currentDraft.ringkasanDraf && (
                    <div>
                      <span className="text-slate-400">Ringkasan Draf: </span>
                      <span className="text-slate-200">{currentDraft.ringkasanDraf}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="my-3 border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wide">
                  {currentDraft.divisionId === 'creator'
                    ? 'Naskah & Caption Lengkap:'
                    : 'Isi Draf / Naskah Lengkap:'}
                </span>
                <button
                  onClick={() => setIsEditingInline(!isEditingInline)}
                  className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-sans cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditingInline ? 'Batal Edit' : 'Edit Draf Cepat'}</span>
                </button>
              </div>

              {isEditingInline ? (
                <div className="space-y-2 mt-2 font-sans">
                  <textarea
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    rows={10}
                    className="w-full bg-slate-950 border border-teal-500 rounded-xl p-3 text-xs sm:text-sm text-slate-100 focus:outline-none font-mono leading-relaxed"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditingInline(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveInlineEdit}
                      className="px-3.5 py-1.5 text-xs bg-teal-500 text-slate-950 font-bold rounded-lg hover:bg-teal-400 cursor-pointer shadow"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-100 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 overflow-x-auto leading-relaxed shadow-sm">
                  {currentDraft.hasilDraf}
                </pre>
              )}
            </div>

            <div className="text-teal-400 font-bold mt-3">
              {currentDraft.divisionId === 'creator'
                ? '[AKSI BOS: APPROVE & PUBLISH] / [REVISI]'
                : '[AKSI BOS: APPROVE & DEPLOY] / [REVISI]'}
            </div>
            <div className="text-teal-400 font-bold mt-1">---</div>
          </div>
        </div>

        {/* Bos Executive Action Buttons */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Persetujuan Bos Ismanto akan membuka simulator eksekusi (WhatsApp Broadcast ke 1.240 kontak atau Pratinjau Video 9:16 Medsos).
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* REVISI BUTTON */}
            <button
              onClick={() => onRequestRevision(currentDraft)}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl border border-amber-500/50 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>[REVISI] Beri Catatan</span>
            </button>

            {/* APPROVE & PUBLISH / DEPLOY BUTTON */}
            <button
              onClick={handleApproveWithConfetti}
              className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
                currentDraft.divisionId === 'creator'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white shadow-pink-500/20'
                  : 'bg-teal-400 hover:bg-teal-300 text-slate-950 shadow-teal-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {currentDraft.divisionId === 'creator'
                  ? '[APPROVE & PUBLISH]'
                  : '[APPROVE & DEPLOY]'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
