import React, { useState } from 'react';
import { DraftReport } from '../types';
import { 
  CheckCircle2, Send, MessageSquare, Video, FileText, 
  Copy, Check, X, ShieldCheck, ExternalLink, Sparkles
} from 'lucide-react';

interface DeployModalProps {
  draft: DraftReport;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeployed: (executionDetails: {
    channel: 'WhatsApp' | 'Social' | 'Web/App';
    status: 'Dispatched' | 'Published' | 'Scheduled';
    details: string;
  }) => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  draft,
  isOpen,
  onClose,
  onConfirmDeployed,
}) => {
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployedSuccess, setDeployedSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  // Determine channel
  const isWhatsApp = draft.assignedStaff.toLowerCase().includes('dewi') ||
                     draft.assignedStaff.toLowerCase().includes('sari') ||
                     draft.hasilDraf.toLowerCase().includes('broadcast') ||
                     draft.hasilDraf.toLowerCase().includes('whatsapp');

  const isSocial = draft.divisionId === 'creator' ||
                   draft.assignedStaff.toLowerCase().includes('trendy') ||
                   draft.assignedStaff.toLowerCase().includes('script') ||
                   draft.assignedStaff.toLowerCase().includes('clipper');

  const channel: 'WhatsApp' | 'Social' | 'Web/App' = isWhatsApp
    ? 'WhatsApp'
    : isSocial
    ? 'Social'
    : 'Web/App';

  const handleSimulateDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      setDeployedSuccess(true);
      onConfirmDeployed({
        channel,
        status: channel === 'WhatsApp' ? 'Dispatched' : channel === 'Social' ? 'Published' : 'Dispatched',
        details: channel === 'WhatsApp'
          ? 'Terkirim ke 1.240 kontak & grup mitra PT Rasyatech Digital Zenith'
          : channel === 'Social'
          ? 'Terdistribusi ke TikTok, Instagram Reels, & YouTube Shorts'
          : 'Diterbitkan ke dokumentasi & sistem portal siput.id',
      });
    }, 1200);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(draft.hasilDraf);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Draf Disetujui: Simulasi Deployment
              </h3>
              <p className="text-xs text-slate-400">
                Otorisasi Penuh dari Bos Ismanto (PT Rasyatech Digital Zenith)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Metadata pill strip */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500">Divisi:</span>{' '}
              <span className="font-semibold text-white">{draft.division}</span>
            </div>
            <span className="text-slate-600">·</span>
            <div>
              <span className="text-slate-500">Staf:</span>{' '}
              <span className="font-semibold text-amber-300">{draft.assignedStaff}</span>
            </div>
            <span className="text-slate-600">·</span>
            <div>
              <span className="text-slate-500">Target Channel:</span>{' '}
              <span className="font-semibold text-teal-300">{channel}</span>
            </div>
          </div>

          {/* Realistic Channel Mock Simulator */}
          {channel === 'WhatsApp' ? (
            /* WhatsApp Simulator View */
            <div className="rounded-xl border border-emerald-900/60 bg-[#0b141a] overflow-hidden shadow-lg">
              {/* WA Header */}
              <div className="bg-[#1f2c34] px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                    R
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      Rasyatech Official Broadcast Center
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      Siap Kirim: 1.240 Kontak Operator & Kader Terdaftar
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">WA Business API</span>
              </div>

              {/* Chat Bubble Area */}
              <div className="p-4 bg-[url('https://static.whatsapp.net/rsrc.php/v3/yO/r/0Yd3X3uE94Y.png')] bg-repeat bg-opacity-5">
                <div className="max-w-[85%] bg-[#005c4b] text-slate-100 p-3 rounded-lg rounded-tl-none shadow-md text-xs leading-relaxed">
                  <pre className="whitespace-pre-wrap font-sans">
                    {draft.hasilDraf}
                  </pre>
                  <div className="text-right text-[10px] text-emerald-200 mt-1 font-mono">
                    {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </div>
                </div>
              </div>
            </div>
          ) : channel === 'Social' ? (
            /* Social Media Mock Player */
            <div className="rounded-xl border border-purple-900/60 bg-slate-950 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                    ♫
                  </div>
                  <span className="font-bold text-white">Pratinjau Distribusi Sosmed (TikTok / Reels / Shorts)</span>
                </div>
                <span className="text-purple-400 font-mono text-[11px]">Format 9:16 Short Video</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 space-y-2">
                <div className="text-slate-400 text-[11px]">Konten Draf:</div>
                <pre className="whitespace-pre-wrap font-sans text-xs bg-slate-950/80 p-3 rounded border border-slate-800">
                  {draft.hasilDraf}
                </pre>
              </div>
            </div>
          ) : (
            /* Web / Documentation Simulator */
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-400" />
                  <span className="font-bold text-white">Publikasi Portal siput.id / Arsip Riset</span>
                </div>
                <span className="text-teal-400 font-mono text-[11px]">Internal Knowledgebase</span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs bg-slate-900 p-3 rounded border border-slate-800 text-slate-200">
                {draft.hasilDraf}
              </pre>
            </div>
          )}

          {deployedSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Mandat sukses dieksekusi! Laporan draf telah diarsipkan ke riwayat PT Rasyatech Digital Zenith.
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin' : 'Salin Konten'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Tutup
            </button>

            {!deployedSuccess ? (
              <button
                onClick={handleSimulateDeploy}
                disabled={isDeploying}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeploying ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Menyalurkan Mandat...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {channel === 'WhatsApp'
                        ? 'Kirim Broadcast WhatsApp Sekarang'
                        : channel === 'Social'
                        ? 'Publikasikan ke Kanal Medsos'
                        : 'Deploy ke Portal siput.id'}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Selesai & Tutup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
