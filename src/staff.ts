import type { OfficeDivision, TicketCategory, TicketDivision } from './workflowTypes.js';

export const STAFF = [
  { id: 'arka', name: 'Arka', division: 'paud', role: 'Layanan klien, bug & retensi Siput PAUD' },
  { id: 'lisa', name: 'Lisa', division: 'paud', role: 'Panduan dan penjelasan PAUD' },
  { id: 'dewi', name: 'Dewi', division: 'paud', role: 'Draf komunikasi PAUD' },
  { id: 'sales_paud', name: 'Mitra PAUD', division: 'paud', role: 'Strategi penjualan dan onboarding PAUD' },
  { id: 'dr_ai', name: 'Dr. AI', division: 'posyandu', role: 'Layanan klien, bug & retensi Siput Posyandu' },
  { id: 'budi', name: 'Budi', division: 'posyandu', role: 'Panduan penggunaan Posyandu' },
  { id: 'sari', name: 'Sari', division: 'posyandu', role: 'Draf komunikasi Posyandu' },
  { id: 'sales_posyandu', name: 'Mitra Posyandu', division: 'posyandu', role: 'Strategi penjualan dan onboarding Posyandu' },
  { id: 'trendy', name: 'Trendy', division: 'creator', role: 'Ide konten' },
  { id: 'script_ai', name: 'Script-AI', division: 'creator', role: 'Pembuatan paket produk digital PDF siap jual & naskah inti' },
  { id: 'clipper', name: 'Clipper', division: 'creator', role: 'Paket konten 1x AI (Ide, Hook, Naskah, Caption & CapCut)' },
  { id: 'strategist', name: 'Strategi Konten', division: 'creator', role: 'Riset peluang produk digital & validasi pasar' },
  { id: 'devops', name: 'Dev-Ops', division: 'engineer', role: 'Operasional teknis' },
  { id: 'code_ai', name: 'Code-AI', division: 'engineer', role: 'Rencana pengembangan' },
  { id: 'architect', name: 'Architect', division: 'engineer', role: 'Arsitektur sistem' },
  { id: 'market_research', name: 'Riset Produk', division: 'engineer', role: 'Riset pasar dan peluang produk digital' },
  { id: 'qa', name: 'QA Produk', division: 'engineer', role: 'Rencana pengujian dan validasi produk' },
  { id: 'sentinel', name: 'Sentinel', division: 'cyber', role: 'Rencana pemantauan' },
  { id: 'guard_ai', name: 'Guard-AI', division: 'cyber', role: 'Perlindungan data' },
  { id: 'audit', name: 'Audit', division: 'cyber', role: 'Rencana audit keamanan' },
  {
    id: 'finance_manager',
    name: 'Manajer Keuangan',
    division: 'finance',
    role: 'Manajer Keuangan & Pelaporan · Delegasi Tepercaya Pimpinan',
    responsibilities: [
      'Menyusun rekap harian, mingguan, dan bulanan dari transaksi yang tercatat.',
      'Memisahkan pemasukan aktual, estimasi, pengeluaran, serta pemakaian AI yang diketahui atau belum lengkap.',
      'Menandai data yang tidak tersedia; tidak mengubah buku transaksi atau mengklaim saldo rekening/e-wallet.',
    ],
  },
  {
    id: 'marketing_manager',
    name: 'Manajer Pemasaran',
    division: 'marketing',
    role: 'Listing produk, penawaran & checklist distribusi',
    responsibilities: [
      'Menyiapkan draf listing, caption, hashtag, dan checklist distribusi untuk produk yang ditentukan.',
      'Memakai hanya fitur, harga, tautan, dan klaim yang diberikan serta diverifikasi pimpinan.',
      'Menandai informasi yang belum tersedia; publikasi, aktivasi tautan, dan transaksi tetap tindakan manusia.',
    ],
    mandateGuidance: [
      'Tupoksi Anda adalah menyiapkan bahan pemasaran yang siap ditinjau: listing produk, caption per platform, hashtag relevan, dan checklist distribusi.',
      'Gunakan hanya fakta, fitur, harga, tautan, target pasar, dan bukti yang diberikan dalam mandat. Jangan mengarang testimoni, hasil, tren terverifikasi, angka penjualan, harga, atau status tautan.',
      'Jika informasi penting tidak tersedia, tandai sebagai [PERLU KONFIRMASI] dan tulis pertanyaan yang harus dijawab pimpinan.',
      'Hasil adalah draf untuk persetujuan. Anda tidak dapat mengaktifkan link, mengunggah, menjadwalkan, memublikasikan, membalas pelanggan, atau memproses pembayaran melalui aplikasi.',
      'Akhiri dengan checklist serah-terima manual dan status setiap kanal sebagai BELUM DIVERIFIKASI kecuali bukti status disediakan.',
    ].join('\n'),
  },
] as const satisfies readonly {
  id: string;
  name: string;
  division: OfficeDivision;
  role: string;
  responsibilities?: readonly string[];
  mandateGuidance?: string;
}[];

export type StaffId = typeof STAFF[number]['id'];

export const CORE_ROOMS = [
  {
    id: 'product_research',
    name: 'Produk & Riset',
    shortLabel: 'PRODUK & RISET',
    color: '#10b981',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    staffIds: ['strategist', 'script_ai'] as const,
  },
  {
    id: 'content_sales',
    name: 'Konten & Penjualan',
    shortLabel: 'KONTEN & PENJUALAN',
    color: '#f43f5e',
    tone: 'bg-rose-50 text-rose-800 border-rose-200',
    staffIds: ['clipper', 'marketing_manager'] as const,
  },
  {
    id: 'client_service',
    name: 'Layanan Klien',
    shortLabel: 'LAYANAN KLIEN',
    color: '#0ea5e9',
    tone: 'bg-sky-50 text-sky-800 border-sky-200',
    staffIds: ['arka', 'dr_ai'] as const,
  },
] as const;

export type CoreRoomId = typeof CORE_ROOMS[number]['id'];

const coreStaffIdSet = new Set<string>(CORE_ROOMS.flatMap((room) => [...room.staffIds]));
export const ACTIVE_STAFF = CORE_ROOMS.flatMap((room) =>
  room.staffIds.map((id) => STAFF.find((person) => person.id === id)!));

export function getStaff(id: string) { return STAFF.find((staff) => staff.id === id); }

export function getRoomStaff(roomId: CoreRoomId) {
  const room = CORE_ROOMS.find((item) => item.id === roomId) ?? CORE_ROOMS[0];
  return room.staffIds.map((id) => STAFF.find((person) => person.id === id)!);
}

export function coreRoomForStaff(staffId: string): CoreRoomId {
  const found = CORE_ROOMS.find((room) => (room.staffIds as readonly string[]).includes(staffId));
  if (found) return found.id;
  const staff = getStaff(staffId);
  if (staff?.division === 'paud' || staff?.division === 'posyandu') return 'client_service';
  if (staff?.division === 'marketing') return 'content_sales';
  return 'product_research';
}

export function isCoreStaff(staffId: string): boolean {
  return coreStaffIdSet.has(staffId);
}

export function ticketStaff(division: TicketDivision, _category: TicketCategory): StaffId {
  return division === 'paud' ? 'arka' : 'dr_ai';
}
