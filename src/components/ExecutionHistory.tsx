import React, { useState } from 'react';
import { DraftReport } from '../types';
import { History, CheckCircle2, RotateCcw, Copy, Download, ExternalLink, Calendar, Filter } from 'lucide-react';

interface ExecutionHistoryProps {
  history: DraftReport[];
  onSelectDraft: (draft: DraftReport) => void;
}

export const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({
  history,
  onSelectDraft,
}) => {
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = history.filter((item) => {
    if (filterDivision === 'all') return true;
    return item.divisionId === filterDivision;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-white space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-teal-400" />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Arsip & Riwayat Eksekusi Kantor AI
            </h2>
            <p className="text-xs text-slate-400">
              Log seluruh mandat yang telah diproses, disetujui, atau direvisi oleh Bos Ismanto
            </p>
          </div>
        </div>

        {/* Division Filter */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setFilterDivision('all')}
            className={`px-2 py-0.5 rounded ${
              filterDivision === 'all' ? 'bg-teal-500/20 text-teal-300 font-bold' : 'text-slate-400'
            }`}
          >
            Semua ({history.length})
          </button>
          <button
            onClick={() => setFilterDivision('paud')}
            className={`px-2 py-0.5 rounded ${
              filterDivision === 'paud' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'
            }`}
          >
            PAUD
          </button>
          <button
            onClick={() => setFilterDivision('posyandu')}
            className={`px-2 py-0.5 rounded ${
              filterDivision === 'posyandu' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400'
            }`}
          >
            Posyandu
          </button>
          <button
            onClick={() => setFilterDivision('creator')}
            className={`px-2 py-0.5 rounded ${
              filterDivision === 'creator' ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-slate-400'
            }`}
          >
            Content
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          Belum ada riwayat draf untuk filter ini.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      item.divisionId === 'paud'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : item.divisionId === 'posyandu'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {item.division}
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {item.assignedStaff}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.status === 'APPROVED'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : item.status === 'REVISED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.status === 'APPROVED' ? '✓ DISETUJUI & DEPLOY' : item.status}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(item.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                <span className="text-slate-400 font-semibold">Tugas: </span>
                <span className="italic">{item.taskPrompt}</span>
              </div>

              {item.executionResult && (
                <div className="text-xs text-teal-300 bg-teal-950/40 border border-teal-800/40 p-2 rounded flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>{item.executionResult.details}</span>
                  </div>
                  <span className="text-[10px] font-mono text-teal-400">
                    Status: {item.executionResult.status}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => handleCopy(item.id, item.formattedReport)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedId === item.id ? 'Tersalin!' : 'Salin Laporan'}</span>
                </button>

                <button
                  onClick={() => onSelectDraft(item)}
                  className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 rounded transition-colors flex items-center gap-1"
                >
                  <span>Buka di Approval Center</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
