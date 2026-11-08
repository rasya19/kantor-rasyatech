import React from 'react';
import { STAFF_LIST } from '../data/officeData';
import { StaffMember } from '../types';
import { Users, Sparkles, X, MessageSquare, ShieldAlert, HeartPulse, Video, GraduationCap } from 'lucide-react';

interface StaffDirectoryModalProps {
  onSelectStaff: (staff: StaffMember) => void;
  onClose?: () => void;
}

export const StaffDirectoryModal: React.FC<StaffDirectoryModalProps> = ({
  onSelectStaff,
  onClose,
}) => {
  const paudStaff = STAFF_LIST.filter((s) => s.divisionId === 'paud');
  const posyanduStaff = STAFF_LIST.filter((s) => s.divisionId === 'posyandu');
  const creatorStaff = STAFF_LIST.filter((s) => s.divisionId === 'creator');

  const renderStaffSection = (
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    borderColor: string,
    badgeColor: string,
    staffMembers: StaffMember[]
  ) => (
    <div className={`rounded-xl border ${borderColor} bg-slate-900/60 p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
          3 Staf Virtual Aktif
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {staffMembers.map((staff) => (
          <div
            key={staff.id}
            className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 flex flex-col justify-between hover:border-teal-400/50 transition-all group"
          >
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-lg ${staff.avatarBg} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm`}>
                  {staff.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors">
                    {staff.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {staff.role}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 mb-3 line-clamp-3 leading-relaxed">
                {staff.specialty}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                Channel: {staff.defaultChannel}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectStaff(staff);
                  if (onClose) onClose();
                }}
                className="px-2.5 py-1 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Tugaskan</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white tracking-wide">
            Daftar 9 Staf Virtual PT Rasyatech Digital Zenith
          </h2>
          <p className="text-xs text-slate-400">
            Struktur organisasi mandiri yang beroperasi otomatis di bawah komando Bos Ismanto
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Divisi 1: Siput PAUD */}
        {renderStaffSection(
          '1. DIVISI SIPUT PAUD',
          'SaaS Pendidikan untuk Operator & Kepala Sekolah PAUD (siput.id)',
          <GraduationCap className="w-5 h-5 text-amber-400" />,
          'border-amber-500/30',
          'bg-amber-500/10 text-amber-300 border-amber-500/30',
          paudStaff
        )}

        {/* Divisi 2: Siput Posyandu */}
        {renderStaffSection(
          '2. DIVISI SIPUT POSYANDU',
          'SaaS Kesehatan Desa, Deteksi Balita & Pencegahan Stunting',
          <HeartPulse className="w-5 h-5 text-emerald-400" />,
          'border-emerald-500/30',
          'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          posyanduStaff
        )}

        {/* Divisi 3: Content Creator */}
        {renderStaffSection(
          '3. DIVISI CONTENT CREATOR',
          'Clipper, Riset Tren Medsos, & Drama Pendek Viral 15-30 Detik',
          <Video className="w-5 h-5 text-pink-400" />,
          'border-pink-500/30',
          'bg-pink-500/10 text-pink-300 border-pink-500/30',
          creatorStaff
        )}
      </div>
    </div>
  );
};
