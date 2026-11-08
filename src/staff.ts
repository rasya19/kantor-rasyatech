import type { OfficeDivision, TicketCategory, TicketDivision } from './workflowTypes';

export const STAFF = [
  { id: 'arka', name: 'Arka', division: 'paud', role: 'Analisis laporan PAUD' },
  { id: 'lisa', name: 'Lisa', division: 'paud', role: 'Panduan dan penjelasan PAUD' },
  { id: 'dewi', name: 'Dewi', division: 'paud', role: 'Draf komunikasi PAUD' },
  { id: 'dr_ai', name: 'Dr. AI', division: 'posyandu', role: 'Analisis laporan Posyandu' },
  { id: 'budi', name: 'Budi', division: 'posyandu', role: 'Panduan penggunaan Posyandu' },
  { id: 'sari', name: 'Sari', division: 'posyandu', role: 'Draf komunikasi Posyandu' },
  { id: 'trendy', name: 'Trendy', division: 'creator', role: 'Ide konten' },
  { id: 'script_ai', name: 'Script-AI', division: 'creator', role: 'Naskah konten' },
  { id: 'clipper', name: 'Clipper', division: 'creator', role: 'Caption dan distribusi' },
  { id: 'devops', name: 'Dev-Ops', division: 'engineer', role: 'Operasional teknis' },
  { id: 'code_ai', name: 'Code-AI', division: 'engineer', role: 'Rencana pengembangan' },
  { id: 'architect', name: 'Architect', division: 'engineer', role: 'Arsitektur sistem' },
  { id: 'sentinel', name: 'Sentinel', division: 'cyber', role: 'Rencana pemantauan' },
  { id: 'guard_ai', name: 'Guard-AI', division: 'cyber', role: 'Perlindungan data' },
  { id: 'audit', name: 'Audit', division: 'cyber', role: 'Rencana audit keamanan' },
] as const satisfies readonly { id: string; name: string; division: OfficeDivision; role: string }[];

export type StaffId = typeof STAFF[number]['id'];
export function getStaff(id: string) { return STAFF.find((staff) => staff.id === id); }
export function ticketStaff(division: TicketDivision, category: TicketCategory): StaffId {
  const mapping = {
    paud: { BUG: 'arka', QUESTION: 'lisa', COMPLAINT: 'dewi' },
    posyandu: { BUG: 'dr_ai', QUESTION: 'budi', COMPLAINT: 'sari' },
  } as const;
  return mapping[division][category];
}
