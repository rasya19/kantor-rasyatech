import type { OfficeDivision, TicketCategory, TicketDivision } from './workflowTypes';

export const STAFF = [
  { id: 'arka', name: 'Arka', division: 'paud', role: 'Analisis laporan PAUD' },
  { id: 'lisa', name: 'Lisa', division: 'paud', role: 'Panduan dan penjelasan PAUD' },
  { id: 'dewi', name: 'Dewi', division: 'paud', role: 'Draf komunikasi PAUD' },
  { id: 'sales_paud', name: 'Mitra PAUD', division: 'paud', role: 'Strategi penjualan dan onboarding PAUD' },
  { id: 'dr_ai', name: 'Dr. AI', division: 'posyandu', role: 'Analisis laporan Posyandu' },
  { id: 'budi', name: 'Budi', division: 'posyandu', role: 'Panduan penggunaan Posyandu' },
  { id: 'sari', name: 'Sari', division: 'posyandu', role: 'Draf komunikasi Posyandu' },
  { id: 'sales_posyandu', name: 'Mitra Posyandu', division: 'posyandu', role: 'Strategi penjualan dan onboarding Posyandu' },
  { id: 'trendy', name: 'Trendy', division: 'creator', role: 'Ide konten' },
  { id: 'script_ai', name: 'Script-AI', division: 'creator', role: 'Naskah konten' },
  { id: 'clipper', name: 'Clipper', division: 'creator', role: 'Caption dan distribusi' },
  { id: 'strategist', name: 'Strategi Konten', division: 'creator', role: 'Riset produk non-aplikasi dan strategi konten' },
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
    role: 'Manajer Pemasaran & Distribusi Digital · Delegasi Tepercaya Pimpinan',
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
export function getStaff(id: string) { return STAFF.find((staff) => staff.id === id); }
export function ticketStaff(division: TicketDivision, category: TicketCategory): StaffId {
  const mapping = {
    paud: { BUG: 'arka', QUESTION: 'lisa', COMPLAINT: 'dewi' },
    posyandu: { BUG: 'dr_ai', QUESTION: 'budi', COMPLAINT: 'sari' },
  } as const;
  return mapping[division][category];
}
