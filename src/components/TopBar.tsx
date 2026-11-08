import React from 'react';
import { Building2, Sparkles, Send, CheckCircle2, Users, History, MapPin } from 'lucide-react';

interface TopBarProps {
  activeTab: 'blueprint' | 'approval' | 'staff' | 'history';
  setActiveTab: (tab: 'blueprint' | 'approval' | 'staff' | 'history') => void;
  pendingCount: number;
  approvedCount: number;
  onNewTaskClick: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  approvedCount,
  onNewTaskClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400 shadow-inner">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              PT Rasyatech Digital Zenith
            </span>
            <div className="flex items-center gap-2 text-xs text-teal-400">
              <span className="font-medium">Kantor AI Bos Ismanto</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-slate-400">3 Divisi Virtual</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => setActiveTab('blueprint')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'blueprint'
                ? 'bg-slate-800 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Denah Isometrik</span>
          </button>

          <button
            onClick={() => setActiveTab('approval')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 relative ${
              activeTab === 'approval'
                ? 'bg-slate-800 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Daftar Persetujuan</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'staff'
                ? 'bg-slate-800 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staf Virtual (9)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'bg-slate-800 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Eksekusi</span>
            {approvedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded text-[10px] font-mono">
                {approvedCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onNewTaskClick}
            className="px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg transition-all shadow-sm shadow-teal-500/20 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Beri Mandat Bos</span>
          </button>
        </div>
      </div>
    </header>
  );
};
