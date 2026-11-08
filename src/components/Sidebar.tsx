import React from 'react';
import { ActiveTab } from '../types';
import { 
  LayoutDashboard, 
  Map, 
  CheckSquare, 
  Users, 
  History, 
  Rocket, 
  ShieldCheck, 
  Bot, 
  Sparkles, 
  Radio, 
  ChevronRight,
  School,
  HeartPulse,
  Clapperboard,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingCount: number;
  approvedCount: number;
  onOpenCommandModal: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  approvedCount,
  onOpenCommandModal,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard Utama',
      subtitle: 'Status 9 Staf Siaga',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'blueprint' as ActiveTab,
      label: 'Denah Isometrik',
      subtitle: 'Kantor Virtual 3 Divisi',
      icon: Map,
      badge: null,
    },
    {
      id: 'approval' as ActiveTab,
      label: 'Daftar Persetujuan',
      subtitle: 'Approval Center Meja Bos',
      icon: CheckSquare,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    },
    {
      id: 'staff' as ActiveTab,
      label: 'Staf Virtual',
      subtitle: '9 Pegawai AI Mandiri',
      icon: Users,
      badge: '9',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    },
    {
      id: 'history' as ActiveTab,
      label: 'Riwayat Eksekusi',
      subtitle: 'Log Publikasi & Disposisi',
      icon: History,
      badge: approvedCount > 0 ? approvedCount : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    },
  ];

  const handleSelectNav = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header / Logo Zone */}
        <div className="p-4 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/30 to-emerald-600/30 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0 shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-white tracking-tight leading-tight truncate">
                PT Rasyatech Digital Zenith
              </div>
              <div className="text-[11px] text-teal-400 font-medium flex items-center gap-1 mt-0.5">
                <span>Kantor AI Bos Ismanto</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </div>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live System Banner */}
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">Sistem 24/7 Otonom</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            9 Siaga
          </span>
        </div>

        {/* Main Navigation Menu */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2">
            Menu Navigasi Utama
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-white border border-teal-500/40 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800 text-slate-400 group-hover:text-teal-300 group-hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className={`font-semibold ${isActive ? 'text-teal-300' : 'text-slate-200'}`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </div>

                {item.badge !== null && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shrink-0 ${
                      item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick Division Status Bar */}
          <div className="pt-4 mt-3 border-t border-slate-800/80">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2">
              3 Divisi Virtual
            </div>
            <div className="space-y-1">
              <div className="px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <School className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-300 text-[11px]">Siput PAUD</span>
                </div>
                <span className="text-[10px] text-amber-400 font-mono font-semibold">
                  3 Staf · 47 PAUD
                </span>
              </div>

              <div className="px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-slate-300 text-[11px]">Siput Posyandu</span>
                </div>
                <span className="text-[10px] text-teal-400 font-mono font-semibold">
                  3 Staf · KMS WHO
                </span>
              </div>

              <div className="px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-3.5 h-3.5 text-pink-400" />
                  <span className="text-slate-300 text-[11px]">Content Creator</span>
                </div>
                <span className="text-[10px] text-pink-400 font-mono font-semibold">
                  06.00 WIB · 9:16
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sidebar Action & Profile Zone */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2.5">
          {/* Prominent Action Button: [🚀 Beri Mandat Bos] */}
          <button
            onClick={() => {
              onOpenCommandModal();
              onCloseMobile();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-extrabold text-xs tracking-wide shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Rocket className="w-4 h-4" />
            <span>[🚀 Beri Mandat Bos]</span>
          </button>

          {/* Boss Executive Card */}
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs shrink-0">
                BI
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-white truncate">
                  Bos Ismanto
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Pemilik & Pengambil Keputusan
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
              CEO
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
