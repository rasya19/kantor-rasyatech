import React, { useState } from 'react';
import { DraftReport } from '../types';
import { RotateCcw, X, Sparkles, MessageSquare, AlertCircle } from 'lucide-react';

interface RevisionModalProps {
  draft: DraftReport;
  isOpen: boolean;
  onClose: () => void;
  onSubmitRevision: (revisionNotes: string) => Promise<void>;
  isRevising: boolean;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({
  draft,
  isOpen,
  onClose,
  onSubmitRevision,
  isRevising,
}) => {
  const [revisionNotes, setRevisionNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const quickNotes = [
    'Buat lebih ringkas & to the point (maksimal 3 paragraf).',
    'Tingkatkan hook emosional di kalimat awal agar lebih viral.',
    'Gunakan bahasa yang sangat ramah orang awam & kader sepuh.',
    'Tambahkan batas waktu jam 16.00 WIB dan link konfirmasi resmi.',
    'Perkuat solusi teknis fitur siput.id untuk operator.',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionNotes.trim()) {
      setErrorMsg('Tuliskan catatan revisi untuk staf virtual.');
      return;
    }
    setErrorMsg('');
    await onSubmitRevision(revisionNotes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Instruksi Revisi Draf untuk {draft.assignedStaff}
              </h3>
              <p className="text-xs text-slate-400">
                Staf akan menyesuaikan draf secara cerdas sesuai arahan Bos Ismanto
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick note suggestion pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Pilihan Cepat Catatan Revisi:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickNotes.map((note, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setRevisionNotes(note);
                    setErrorMsg('');
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-slate-200 rounded-md transition-colors text-left"
                >
                  + {note}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Catatan Spesifik Bos Ismanto:
            </label>
            <textarea
              value={revisionNotes}
              onChange={(e) => {
                setRevisionNotes(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Contoh: Kalimat pembukanya kurang menggigit, tolong tambahkan sentuhan komedi tentang printer macet di sekolah..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-sans"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isRevising}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isRevising}
              className="px-5 py-2 text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isRevising ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Staf Sedang Merevisi...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Kirim Revisi ke Staf</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
