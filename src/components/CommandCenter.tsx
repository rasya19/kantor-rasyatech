import React, { useState } from 'react';
import { PRESET_TASKS, STAFF_LIST } from '../data/officeData';
import { StaffMember, DivisionId, PresetTask } from '../types';
import { Send, Sparkles, Wand2, Compass, Bot, Check, AlertCircle } from 'lucide-react';

interface CommandCenterProps {
  onDispatch: (taskPrompt: string, staffHint?: string, divisionHint?: string) => Promise<void>;
  onProactiveScan?: () => Promise<void>;
  onTriggerCreatorRoutine?: () => Promise<void>;
  isProcessing: boolean;
  selectedStaff?: StaffMember | null;
  onClearSelectedStaff: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  onDispatch,
  onProactiveScan,
  onTriggerCreatorRoutine,
  isProcessing,
  selectedStaff,
  onClearSelectedStaff,
}) => {
  const [taskPrompt, setTaskPrompt] = useState<string>('');
  const [targetDivision, setTargetDivision] = useState<string>('auto');
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Synchronize when a staff is selected from blueprint or directory
  React.useEffect(() => {
    if (selectedStaff) {
      setTargetStaffId(selectedStaff.id);
      setTargetDivision(selectedStaff.divisionId);
    }
  }, [selectedStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) {
      setErrorMsg('Silakan tuliskan instruksi tugas untuk staf virtual.');
      return;
    }
    setErrorMsg('');
    await onDispatch(
      taskPrompt,
      targetStaffId || (selectedStaff ? selectedStaff.id : undefined),
      targetDivision !== 'auto' ? targetDivision : undefined
    );
  };

  const handleSelectPreset = (preset: PresetTask) => {
    setTaskPrompt(preset.prompt);
    setTargetStaffId(preset.staffId);
    setTargetDivision(preset.divisionId);
    setErrorMsg('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-white">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/40">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Pusat Komando Eksekutif Bos Ismanto
            </h2>
            <p className="text-xs text-slate-400">
              Instruksi langsung ke 3 divisi virtual PT Rasyatech Digital Zenith
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onProactiveScan && (
            <button
              type="button"
              onClick={onProactiveScan}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/50 hover:border-teal-400 text-teal-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span>⚡ Radar Otonom</span>
            </button>
          )}

          {onTriggerCreatorRoutine && (
            <button
              type="button"
              onClick={onTriggerCreatorRoutine}
              disabled={isProcessing}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/50 hover:border-pink-400 text-pink-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span>🎬 06.00 Pagi: Konten Viral</span>
            </button>
          )}

          {selectedStaff && (
            <div className="flex items-center gap-2 bg-slate-800 border border-teal-500/40 px-3 py-1 rounded-lg text-xs">
              <span className="text-teal-400 font-medium">Staf Terpilih:</span>
              <span className="font-semibold text-white">{selectedStaff.name}</span>
              <span className="text-slate-400">({selectedStaff.role})</span>
              <button
                type="button"
                onClick={onClearSelectedStaff}
                className="text-slate-400 hover:text-white ml-1 text-xs"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preset Quick Launchers */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
          <Wand2 className="w-3.5 h-3.5 text-teal-400" />
          <span>Tugas Kilat Rekomendasi (Quick Presets):</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PRESET_TASKS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-teal-500/50 text-left transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  preset.divisionId === 'paud'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : preset.divisionId === 'posyandu'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                }`}>
                  {preset.badge}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {preset.divisionId.toUpperCase()}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-200 line-clamp-2 group-hover:text-teal-300 transition-colors">
                {preset.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Command Dispatch Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Routing Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target Divisi
            </label>
            <select
              value={targetDivision}
              onChange={(e) => {
                setTargetDivision(e.target.value);
                setTargetStaffId('');
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="auto">⚡ Otomatis (AI Memilih Divisi & Staf Paling Tepat)</option>
              <option value="paud">DIVISI SIPUT PAUD (SaaS Pendidikan)</option>
              <option value="posyandu">DIVISI SIPUT POSYANDU (SaaS Kesehatan)</option>
              <option value="creator">DIVISI CONTENT CREATOR (Drama Pendek / Clipper)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Spesifik Staf Virtual (Opsional)
            </label>
            <select
              value={targetStaffId}
              onChange={(e) => setTargetStaffId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
            >
              <option value="">⚡ Otomatis (Ditentukan AI berdasarkan instruksi)</option>
              {STAFF_LIST.filter(
                (s) => targetDivision === 'auto' || s.divisionId === targetDivision
              ).map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} — {staff.role} ({staff.divisionName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prompt Input Box */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Instruksi / Mandat Tugas Bos Ismanto:
          </label>
          <textarea
            value={taskPrompt}
            onChange={(e) => {
              setTaskPrompt(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="Contoh: Tolong siapkan draf pesan broadcast WA untuk para operator PAUD tentang penutupan sinkronisasi Dapodik dan BOP sore ini..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
          />
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-400 hidden sm:block">
            Sistem otomatis menugaskan staf, meriset, dan menyajikan laporan draf baku.
          </div>
          <button
            type="submit"
            disabled={isProcessing}
            className={`px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 cursor-pointer ${
              isProcessing ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isProcessing ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Staf Sedang Menyusun Draf...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Mandat ke Staf AI</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
