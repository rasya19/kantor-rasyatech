import React, { useState, useEffect } from 'react';
import { ActiveTab } from '../types';
import { 
  Menu, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Radio, 
  Film,
  Compass
} from 'lucide-react';

interface TopHeaderProps {
  activeTab: ActiveTab;
  onToggleMobileMenu: () => void;
  onProactiveScan: () => void;
  onTriggerCreatorRoutine: () => void;
  isProcessing: boolean;
  pendingCount: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onToggleMobileMenu,
  onProactiveScan,
  onTriggerCreatorRoutine,
  isProcessing,
  pendingCount,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format time in WIB (UTC+7) or local
      const formatted = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTimeStr(`${formatted} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard Utama (Status 9 Staf Siaga)';
      case 'blueprint':
        return 'Denah Isometrik Kantor Virtual';
      case 'approval':
        return 'Daftar Persetujuan (Approval Center)';
      case 'staff':
        return 'Staf Virtual (9 Divisi)';
      case 'history':
        return 'Riwayat Eksekusi Sistem';
      default:
        return 'Kantor AI Mandiri';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden shrink-0"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
            <span>Kantor AI</span>
            <span className="text-slate-600">/</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
            {getBreadcrumbTitle()}
          </h1>
          {activeTab === 'approval' && pendingCount > 0 && (
            <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
              {pendingCount} Menunggu
            </span>
          )}
        </div>
      </div>

      {/* Right: Real-time WIB Clock & Fast Trigger Buttons */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          <span>{timeStr || '00:00:00 WIB'}</span>
        </div>

        {/* Radar Otonom Trigger */}
        <button
          onClick={onProactiveScan}
          disabled={isProcessing}
          className="px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/40 text-teal-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          title="Jalankan pemindaian proaktif otonom oleh tim riset"
        >
          <Sparkles className={`w-3.5 h-3.5 text-teal-400 ${isProcessing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">⚡ Radar Otonom</span>
          <span className="sm:hidden">⚡ Radar</span>
        </button>

        {/* 06.00 Pagi Creator Routine Trigger */}
        <button
          onClick={onTriggerCreatorRoutine}
          disabled={isProcessing}
          className="px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/40 text-pink-300 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
          title="Jalankan siklus otomatis harian 06.00 WIB Divisi Content Creator"
        >
          <Film className="w-3.5 h-3.5 text-pink-400" />
          <span className="hidden sm:inline">🎬 06.00 Pagi</span>
          <span className="sm:hidden">🎬 06.00</span>
        </button>
      </div>
    </header>
  );
};
