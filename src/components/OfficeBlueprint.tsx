import React, { useState } from 'react';
import { STAFF_LIST } from '../data/officeData';
import { StaffMember, DivisionId } from '../types';
import { 
  ZoomIn, ZoomOut, RotateCcw, Sparkles, CheckCircle2, 
  Layers, MessageSquare, Video, ShieldCheck, HeartHandshake, Eye
} from 'lucide-react';

interface OfficeBlueprintProps {
  onSelectStaff: (staff: StaffMember) => void;
  onOpenApproval: () => void;
  onProactiveScan?: () => void;
  activeStaffId?: string;
  isProcessing?: boolean;
}

export const OfficeBlueprint: React.FC<OfficeBlueprintProps> = ({
  onSelectStaff,
  onOpenApproval,
  onProactiveScan,
  activeStaffId,
  isProcessing,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedPin, setSelectedPin] = useState<StaffMember | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<'all' | DivisionId | 'bos'>('all');

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.8), 2.0));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setDivisionFilter('all');
  };

  const filteredStaff = STAFF_LIST.filter((staff) => {
    if (divisionFilter === 'all') return true;
    return staff.divisionId === divisionFilter;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Blueprint Control Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-400" />
          <h2 className="text-sm font-bold text-white tracking-wide">
            Blueprint Isometrik: PT Rasyatech Digital Zenith
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            · Denah Kantor AI Virtual
          </span>
        </div>

        {/* Division Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 overflow-x-auto max-w-full">
          <button
            onClick={() => setDivisionFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              divisionFilter === 'all'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua Zona
          </button>
          <button
            onClick={() => setDivisionFilter('paud')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              divisionFilter === 'paud'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Siput PAUD
          </button>
          <button
            onClick={() => setDivisionFilter('posyandu')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              divisionFilter === 'posyandu'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Siput Posyandu
          </button>
          <button
            onClick={() => setDivisionFilter('creator')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              divisionFilter === 'creator'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Content Creator
          </button>
          <button
            onClick={() => {
              setDivisionFilter('bos');
              onOpenApproval();
            }}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              divisionFilter === 'bos'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Meja Bos Ismanto
          </button>

          {onProactiveScan && (
            <button
              onClick={onProactiveScan}
              disabled={isProcessing}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-1 shadow-sm whitespace-nowrap cursor-pointer disabled:opacity-50"
              title="Jalankan pemindaian proaktif jemput bola"
            >
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>⚡ Radar Proaktif</span>
            </button>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => handleZoom(-0.15)}
            title="Perkecil"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400 px-1 tabular-nums">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.15)}
            title="Perbesar"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset Ukuran"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Blueprint Canvas Viewport */}
      <div className="relative overflow-auto max-h-[640px] bg-slate-950 p-2 sm:p-4 flex items-center justify-center">
        <div
          className="relative transition-transform duration-200 ease-out inline-block origin-center select-none"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {/* Base Floorplan Blueprint Image */}
          <img
            src="/assets/aistudio/divisi_866b3848.webp"
            alt="Denah Kantor AI PT Rasyatech Digital Zenith"
            className="rounded-lg shadow-2xl block w-full max-w-[1100px] h-auto pointer-events-none"
            referrerPolicy="no-referrer"
          />

          {/* Interactive Center Desk Hotspot: Bos Ismanto */}
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            style={{ left: '50%', top: '62%' }}
            onClick={onOpenApproval}
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute -inset-2 rounded-full bg-teal-400/20 animate-ping opacity-60"></span>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border-2 border-teal-400 text-teal-300 shadow-xl backdrop-blur-sm flex items-center gap-1.5 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold whitespace-nowrap">BOS ISMANTO</span>
              </div>
            </div>
          </div>

          {/* Hotspots for each virtual staff */}
          {filteredStaff.map((staff) => {
            const isActive = activeStaffId === staff.id;
            const isSelected = selectedPin?.id === staff.id;

            return (
              <div
                key={staff.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
                style={{ left: `${staff.mapX}%`, top: `${staff.mapY}%` }}
                onClick={() => setSelectedPin(staff)}
              >
                <div className="relative flex flex-col items-center">
                  {/* Active working pulsation ring */}
                  {(isActive || isProcessing) && activeStaffId === staff.id && (
                    <span className="absolute -inset-2 rounded-full bg-teal-400/40 animate-ping"></span>
                  )}

                  {/* Pin Badge */}
                  <div
                    className={`px-2 py-1 rounded-md text-[11px] font-bold shadow-lg border backdrop-blur-md flex items-center gap-1 transition-all group-hover:scale-110 ${
                      isActive
                        ? 'bg-teal-500 text-slate-950 border-teal-300 ring-2 ring-teal-400'
                        : isSelected
                        ? 'bg-slate-900 text-teal-300 border-teal-400 ring-1 ring-teal-500'
                        : staff.divisionId === 'paud'
                        ? 'bg-slate-900/90 text-amber-300 border-amber-500/60'
                        : staff.divisionId === 'posyandu'
                        ? 'bg-slate-900/90 text-emerald-300 border-emerald-500/60'
                        : 'bg-slate-900/90 text-pink-300 border-pink-500/60'
                    }`}
                  >
                    <span>{staff.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Staff Inspector Drawer */}
      {selectedPin && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg ${selectedPin.avatarBg} text-white font-bold flex items-center justify-center shrink-0 shadow-md`}>
              {selectedPin.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{selectedPin.name}</h3>
                <span className="text-xs text-slate-400 font-mono">({selectedPin.role})</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedPin.divisionName}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                {selectedPin.specialty}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => setSelectedPin(null)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={() => {
                onSelectStaff(selectedPin);
                setSelectedPin(null);
              }}
              className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tugaskan {selectedPin.name}</span>
            </button>
          </div>
        </div>
      )}

      {/* Blueprint Legend Footer */}
      <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/60 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
            <span>Divisi Siput PAUD (Arka, Lisa, Dewi)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <span>Divisi Siput Posyandu (Dr. AI, Budi, Sari)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-pink-400"></div>
            <span>Content Creator (Trendy, Script-AI, Clipper)</span>
          </div>
        </div>
        <div className="text-slate-500 font-mono text-[11px]">
          Klik staf untuk menugaskan · Klik Meja Bos untuk daftar draf
        </div>
      </div>
    </div>
  );
};
