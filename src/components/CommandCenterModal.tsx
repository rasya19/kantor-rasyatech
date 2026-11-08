import React, { useState, useEffect } from 'react';
import { PRESET_TASKS, STAFF_LIST } from '../data/officeData';
import { StaffMember, DivisionId, PresetTask } from '../types';
import { 
  Rocket, 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  Check, 
  School, 
  HeartPulse, 
  Clapperboard,
  AlertCircle 
} from 'lucide-react';

interface CommandCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDispatch: (taskPrompt: string, staffHint?: string, divisionHint?: string) => Promise<void>;
  isProcessing: boolean;
  preselectedStaff?: StaffMember | null;
  onClearPreselectedStaff?: () => void;
}

export const CommandCenterModal: React.FC<CommandCenterModalProps> = ({
  isOpen,
  onClose,
  onDispatch,
  isProcessing,
  preselectedStaff,
  onClearPreselectedStaff,
}) => {
  const [taskPrompt, setTaskPrompt] = useState<string>('');
  const [targetDivision, setTargetDivision] = useState<string>('auto');
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (preselectedStaff) {
      setTargetStaffId(preselectedStaff.id);
      setTargetDivision(preselectedStaff.divisionId);
    }
  }, [preselectedStaff]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) {
      setErrorMsg('Silakan tuliskan instruksi tugas untuk staf virtual.');
      return;
    }
    setErrorMsg('');
    await onDispatch(
      taskPrompt,
      targetStaffId || (preselectedStaff ? preselectedStaff.id : undefined),
      targetDivision !== 'auto' ? targetDivision : undefined
    );
    setTaskPrompt('');
    onClose();
  };

  const handleSelectPreset = (preset: PresetTask) => {
    setTaskPrompt(preset.prompt);
    setTargetStaffId(preset.staffId);
    setTargetDivision(preset.divisionId);
    setErrorMsg('');
  };

  const filteredStaffList = targetDivision === 'auto'
    ? STAFF_LIST
    : STAFF_LIST.filter((s) => s.divisionId === targetDivision);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Beri Mandat Bos Ismanto
              </h2>
              <p className="text-xs text-slate-400">
                Pusat instruksi langsung ke 3 divisi virtual PT Rasyatech Digital Zenith
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Quick Presets Strip */}
          <div>
            <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Instruksi Kilat Mandat Bos (Template Cepat):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_TASKS.slice(0, 4).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="text-left p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/40 transition-colors text-xs text-slate-300 group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                      {preset.badge}
                    </span>
                    <span className="text-[10px] text-slate-500">Pilih</span>
                  </div>
                  <div className="font-semibold text-slate-200 group-hover:text-teal-300 transition-colors line-clamp-1">
                    {preset.title}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Division & Staff Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Divisi:
                </label>
                <select
                  value={targetDivision}
                  onChange={(e) => {
                    setTargetDivision(e.target.value);
                    setTargetStaffId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="auto">⚡ Otomatis (AI Cerdas Mendeteksi)</option>
                  <option value="paud">DIVISI SIPUT PAUD (SaaS Pendidikan)</option>
                  <option value="posyandu">DIVISI SIPUT POSYANDU (SaaS Kesehatan)</option>
                  <option value="creator">DIVISI CONTENT CREATOR (Drama & Medsos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Staf Penanggung Jawab:
                </label>
                <select
                  value={targetStaffId}
                  onChange={(e) => setTargetStaffId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">⚡ Otomatis Ditentukan Sistem</option>
                  {filteredStaffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} — {staff.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Instruksi Lengkap Bos Ismanto:
              </label>
              <textarea
                value={taskPrompt}
                onChange={(e) => {
                  setTaskPrompt(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                rows={4}
                placeholder="Contoh: Tolong Dewi buatkan broadcast WA pengingat sinkronisasi data Dapodik untuk pencairan dana BOP Dikdasmen ke 47+ PAUD sore ini..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 leading-relaxed font-sans"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Footer Action */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Staf AI Sedang Bekerja...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>[Kirim Mandat ke Staf AI]</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
