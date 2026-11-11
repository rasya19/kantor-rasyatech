import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { WorkDraft } from '../../src/workflowTypes';

const prefix = 'weekly-research-';
const manualPrefix = 'manual-research-';
export function weeklyResearchId(now: Date): string | null {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  if (day === 1 && wib.getUTCHours() < 6) return null;
  const monday = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - ((day + 6) % 7)));
  return `${prefix}${monday.toISOString().slice(0, 10)}`;
}

export function isWeeklyResearch(id: string): boolean {
  return /^weekly-research-\d{4}-\d{2}-\d{2}$/.test(id);
}

export function isOpportunityResearchJob(id: string): boolean {
  return isWeeklyResearch(id) || /^manual-research-[0-9a-f-]{36}$/.test(id);
}

export function isOpportunitySprintJob(id: string): boolean {
  return isOpportunityResearchJob(id) || sourceForOpportunityJob(id) !== undefined;
}

function currentWibWeekBounds(now: Date): { start: Date; end: Date } {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const monday = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() - ((wib.getUTCDay() + 6) % 7)));
  const start = new Date(monday.getTime() - 7 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) };
}

export async function enqueueOpportunitySprint(): Promise<{ id: string; alreadyActive: boolean }> {
  const { start, end } = currentWibWeekBounds(new Date());
  const existing = await prisma.officeJob.findFirst({
    where: {
      division: 'engineer',
      staffId: 'market_research',
      status: { not: 'DISMISSED' },
      createdAt: { gte: start, lt: end },
      OR: [{ id: { startsWith: prefix } }, { id: { startsWith: manualPrefix } }],
    },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return { id: existing.id, alreadyActive: true };

  const id = `${manualPrefix}${randomUUID()}`;
  await prisma.officeJob.create({ data: {
    id,
    division: 'engineer',
    staffId: 'market_research',
    title: 'Sprint 7 hari: ScanBite, Konter +62, dan Lorisan Warung',
    instruction: 'Riset publik untuk menyusun prioritas validasi 7 hari bagi tiga proyek yang disebut pemilik: ScanBite (order kafe lewat QR), Konter +62 (aplikasi POS), dan Manajemen Lorisan Warung. Jangan menganggap fitur, status kesiapan, pelanggan, harga, atau permintaan pasar telah terverifikasi. Bedakan informasi yang diberikan pemilik, bukti publik, dan asumsi. Untuk tiap proyek, usulkan satu eksperimen atau pilot manual yang realistis, bukti yang perlu dikumpulkan, biaya/kapasitas yang harus dikonfirmasi, serta kriteria lanjut/berhenti. Jangan menjanjikan pemasukan atau menyarankan mengirim data pribadi ke AI.',
  } });
  return { id, alreadyActive: false };
}

export async function pauseQueuedOpportunityTasks(): Promise<number> {
  const result = await prisma.officeJob.updateMany({
    where: {
      status: 'QUEUED',
      OR: [
        { id: { startsWith: prefix, contains: ':' } },
        { id: { startsWith: manualPrefix, contains: ':' } },
      ],
    },
    data: { status: 'PAUSED' },
  });
  return result.count;
}

export async function scheduleWeeklyResearch(now = new Date()): Promise<void> {
  const id = weeklyResearchId(now);
  if (!id) return;
  await prisma.officeJob.createMany({ data: [{
      id, division: 'engineer', staffId: 'market_research',
      title: 'Riset mingguan: ScanBite, Konter +62, dan Lorisan Warung',
      instruction: 'Riset publik untuk menyusun prioritas validasi 7 hari bagi tiga proyek yang disebut pemilik: ScanBite (order kafe lewat QR), Konter +62 (aplikasi POS), dan Manajemen Lorisan Warung. Jangan menganggap fitur, status kesiapan, pelanggan, harga, atau permintaan pasar telah terverifikasi. Bedakan informasi yang diberikan pemilik, bukti publik, dan asumsi. Untuk tiap proyek, usulkan satu eksperimen atau pilot manual yang realistis, bukti yang perlu dikumpulkan, biaya/kapasitas yang harus dikonfirmasi, serta kriteria lanjut/berhenti. Jangan menjanjikan pemasukan atau menyarankan mengirim data pribadi ke AI.',
    }], skipDuplicates: true });
}

export function startOpportunityScheduler(): void {
  if (process.env.OPPORTUNITY_SCHEDULE_ENABLED === 'false') {
    console.log('[Riset mingguan] Jadwal dinonaktifkan.');
    return;
  }
  const run = () => { void scheduleWeeklyResearch().catch((error) => console.error('[Riset mingguan] Penjadwalan gagal:', error)); };
  run();
  setInterval(run, 60000);
}

export const opportunityTasks = [
  { taskId: 'engineer_scanbite', staffId: 'code_ai', division: 'engineer', title: 'ScanBite: backlog penyelesaian dan QA', instruction: 'Fokus pada ScanBite, aplikasi order kafe lewat QR menurut pemilik. Susun backlog penyelesaian yang diprioritaskan, skenario QA untuk alur QR/pemesanan yang perlu diperiksa, kriteria penerimaan, dependensi, dan rencana 7 hari. Repository dan kode tidak tersedia untukmu: jangan mengklaim sudah membaca, mengubah, menjalankan, atau menguji kode; tandai hal yang perlu diverifikasi setelah pemilik memberikan bahan non-rahasia.' },
  { taskId: 'engineer_konter', staffId: 'devops', division: 'engineer', title: 'Konter +62: backlog penyelesaian dan QA', instruction: 'Fokus pada Konter +62, aplikasi POS menurut pemilik. Susun backlog penyelesaian yang diprioritaskan, skenario QA transaksi yang perlu diperiksa, kriteria penerimaan, dependensi, dan rencana 7 hari. Repository dan kode tidak tersedia untukmu: jangan mengklaim sudah membaca, mengubah, menjalankan, atau menguji kode; tandai hal yang perlu diverifikasi setelah pemilik memberikan bahan non-rahasia.' },
  { taskId: 'engineer_lorisan', staffId: 'architect', division: 'engineer', title: 'Lorisan Warung: backlog penyelesaian dan QA', instruction: 'Fokus pada Manajemen Lorisan Warung, aplikasi manajemen warung menurut pemilik. Susun backlog penyelesaian yang diprioritaskan, skenario QA operasional yang perlu diperiksa, kriteria penerimaan, dependensi, dan rencana 7 hari. Repository dan kode tidak tersedia untukmu: jangan mengklaim sudah membaca, mengubah, menjalankan, atau menguji kode; tandai hal yang perlu diverifikasi setelah pemilik memberikan bahan non-rahasia.' },
  { taskId: 'cyber_scanbite', staffId: 'sentinel', division: 'cyber', title: 'ScanBite: checklist keamanan defensif', instruction: 'Fokus pada tinjauan keamanan defensif ScanBite (order kafe lewat QR menurut pemilik) untuk sprint 7 hari. Buat checklist review kode dan konfigurasi yang perlu dilakukan pemilik, mencakup validasi input, sesi/otorisasi, privasi, dan risiko penyalahgunaan QR. Repository tidak tersedia; jangan mengklaim audit atau mitigasi telah dilakukan, meminta rahasia/data pribadi, atau memberi langkah eksploitasi terhadap sistem nyata.' },
  { taskId: 'cyber_konter', staffId: 'guard_ai', division: 'cyber', title: 'Konter +62: checklist keamanan defensif', instruction: 'Fokus pada tinjauan keamanan defensif Konter +62 (aplikasi POS menurut pemilik) untuk sprint 7 hari. Buat checklist review yang perlu dilakukan pemilik untuk kontrol akses, perlindungan data transaksi, validasi input, pencatatan, dan dependensi. Repository tidak tersedia; jangan mengklaim audit atau mitigasi telah dilakukan, meminta rahasia/data pribadi, atau memberi langkah eksploitasi terhadap sistem nyata.' },
  { taskId: 'cyber_lorisan', staffId: 'audit', division: 'cyber', title: 'Lorisan Warung: checklist keamanan defensif', instruction: 'Fokus pada tinjauan keamanan defensif Manajemen Lorisan Warung (aplikasi manajemen warung menurut pemilik) untuk sprint 7 hari. Buat checklist review yang perlu dilakukan pemilik untuk autentikasi/otorisasi, privasi data, validasi input, cadangan, dan dependensi. Repository tidak tersedia; jangan mengklaim audit atau mitigasi telah dilakukan, meminta rahasia/data pribadi, atau memberi langkah eksploitasi terhadap sistem nyata.' },
  { taskId: 'creator_scanbite', staffId: 'strategist', division: 'creator', title: 'ScanBite: validasi pasar dan konten lokal', instruction: 'Rancang materi validasi pasar dan copywriting lokal untuk ScanBite (order kafe lewat QR menurut pemilik): hipotesis calon pengguna berdasarkan peran, pertanyaan wawancara, tiga konsep promosi dan ajakan minta demo, kanal distribusi manual, serta metrik respons untuk 7 hari. Jangan menganggap fitur atau produk siap, mengarang testimoni/harga/pelanggan, atau memublikasikan tanpa persetujuan.' },
  { taskId: 'creator_konter', staffId: 'strategist', division: 'creator', title: 'Konter +62: validasi pasar dan konten lokal', instruction: 'Rancang materi validasi pasar dan copywriting lokal untuk Konter +62 (aplikasi POS menurut pemilik): hipotesis calon pengguna berdasarkan peran, pertanyaan wawancara, tiga konsep promosi dan ajakan minta demo, kanal distribusi manual, serta metrik respons untuk 7 hari. Jangan menganggap fitur atau produk siap, mengarang testimoni/harga/pelanggan, atau memublikasikan tanpa persetujuan.' },
  { taskId: 'creator_lorisan', staffId: 'strategist', division: 'creator', title: 'Lorisan Warung: validasi pasar dan konten lokal', instruction: 'Rancang materi validasi pasar dan copywriting lokal untuk Manajemen Lorisan Warung (aplikasi manajemen warung menurut pemilik): hipotesis calon pengguna berdasarkan peran, pertanyaan wawancara, tiga konsep promosi dan ajakan minta demo, kanal distribusi manual, serta metrik respons untuk 7 hari. Jangan menganggap fitur atau produk siap, mengarang testimoni/harga/pelanggan, atau memublikasikan tanpa persetujuan.' },
  { taskId: 'paud_siput', staffId: 'sales_paud', division: 'paud', title: 'siput.id: checklist operasional PAUD', instruction: 'Fokus pada operasional administratif siput.id/PAUD, bukan penawaran penjualan. Buat checklist 7 hari untuk memeriksa alur administrasi, kebutuhan onboarding/bantuan, konsistensi data, dan laporan yang perlu ditinjau operator; bedakan hal yang perlu dikonfirmasi pemilik. Jangan mengarang fitur/integrasi, memproses atau meminta data anak, kredensial, maupun data pribadi.' },
  { taskId: 'posyandu_sip', staffId: 'sales_posyandu', division: 'posyandu', title: 'SIP Posyandu: checklist operasional administrasi', instruction: 'Fokus pada operasional administratif SIP Posyandu, bukan penawaran penjualan. Buat checklist 7 hari untuk memeriksa alur administrasi, kebutuhan onboarding/bantuan, konsistensi data, dan laporan yang perlu ditinjau operator; bedakan hal yang perlu dikonfirmasi pemilik. Jangan mengarang fitur, memberi saran medis, atau memproses/meminta data kesehatan, identitas, kredensial, maupun data pribadi.' },
] as const;

const reportHandoffInstruction: Partial<Record<string, string>> = {
  engineer: 'Untuk Ruang Pimpinan, akhiri dengan ringkasan hasil, prioritas, risiko, bukti yang belum ada, dan langkah pemilik berikutnya. Jangan mengklaim kode telah diubah/diuji atau menyebut estimasi sebagai revenue aktual.',
  creator: 'Untuk Ruang Pimpinan, sertakan draf penawaran B2B/pilot dan ringkasan validasi. Tandai harga dan hasil sebagai hipotesis; jangan mengarang lead, konversi, proyek terjual, testimoni, atau pendapatan.',
};

export async function forwardOpportunityResearch(tx: Prisma.TransactionClient, jobId: string, draft: WorkDraft): Promise<void> {
  const sourceReferences = draft.grounding?.sources.length
    ? draft.grounding.sources.map((source, index) => `[${index + 1}] ${source.title}: ${source.url}`).join('\n')
    : 'Tidak ada sumber riset terverifikasi yang dilampirkan.';
  for (const task of opportunityTasks) {
    const handoff = reportHandoffInstruction[task.division] ?? '';
    await tx.officeJob.create({ data: {
      id: `${jobId}:${task.taskId}`, division: task.division, staffId: task.staffId, title: task.title, status: 'PAUSED',
      instruction: `${task.instruction}${handoff ? `\n\n${handoff}` : ''}\n\nGunakan hanya sumber yang dicantumkan di bawah. Jangan mengklaim riset web terbaru atau fakta pasar yang tidak didukung sumber. Jika tanggal atau kebaruan sumber tidak jelas, tandai belum terverifikasi.\n\nSumber riset rujukan ${draft.id}:\n${sourceReferences}\n\nIsi riset rujukan:\n${draft.content.slice(0, 16000)}`,
    } });
  }
}

export function sourceForOpportunityJob(id: string): string | undefined {
  const [researchId, taskId, extra] = id.split(':');
  const legacyTaskIds = ['sales_paud', 'sales_posyandu', 'qa', 'strategist', 'guard_ai'];
  if (extra !== undefined || !researchId || !taskId || !isOpportunityResearchJob(researchId) ||
      (!opportunityTasks.some((task) => task.taskId === taskId) && !legacyTaskIds.includes(taskId))) return undefined;
  return `job-${researchId}`;
}
