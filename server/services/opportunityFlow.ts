import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { WorkDraft } from '../../src/workflowTypes.js';

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
  if (process.env.OPPORTUNITY_SCHEDULE_ENABLED !== 'true') {
    console.log('[Riset mingguan] Jadwal dinonaktifkan (set OPPORTUNITY_SCHEDULE_ENABLED="true" untuk mengaktifkan).');
    return;
  }
  const run = () => { void scheduleWeeklyResearch().catch((error) => console.error('[Riset mingguan] Penjadwalan gagal:', error)); };
  run();
  setInterval(run, 60000);
}

export const opportunityTasks = [
  { taskId: 'creator_validate_apps', staffId: 'strategist', division: 'creator', title: 'ScanBite, Konter +62 & Lorisan Warung: prioritas validasi 7 hari', instruction: 'Berdasarkan riset rujukan, susun 1 eksperimen validasi pasar manual paling murah selama 7 hari untuk masing-masing proyek pemilik (ScanBite, Konter +62, dan Manajemen Lorisan Warung). Pisahkan fakta sumber, asumsi, target responden, dan kriteria lanjut/berhenti. Jangan mengarang pelanggan, testimoni, fitur tersedia, kode, atau pendapatan.' },
  { taskId: 'creator_promo_apps', staffId: 'clipper', division: 'creator', title: 'ScanBite, Konter +62 & Lorisan Warung: paket konten demo & validasi', instruction: 'Siapkan masing-masing 1 paket draf konten video pendek 9:16 untuk menguji minat pasar pada ScanBite, Konter +62, dan Manajemen Lorisan Warung. Gunakan hanya deskripsi dasar pemilik dan sumber terlampir; tandai harga/tautan sebagai [PERLU KONFIRMASI]. Jangan mengarang testimoni/hasil atau memublikasikan otomatis.' },
  { taskId: 'paud_siput', staffId: 'arka', division: 'paud', title: 'siput.id: checklist operasional PAUD', instruction: 'Fokus pada operasional administratif siput.id/PAUD, bukan penawaran penjualan. Buat checklist 7 hari untuk memeriksa alur administrasi, kebutuhan onboarding/bantuan, konsistensi data, dan laporan yang perlu ditinjau operator; bedakan hal yang perlu dikonfirmasi pemilik. Jangan mengarang fitur/integrasi, memproses atau meminta data anak, kredensial, maupun data pribadi.' },
  { taskId: 'posyandu_sip', staffId: 'dr_ai', division: 'posyandu', title: 'SIP Posyandu: checklist operasional administrasi', instruction: 'Fokus pada operasional administratif SIP Posyandu, bukan penawaran penjualan. Buat checklist 7 hari untuk memeriksa alur administrasi, kebutuhan onboarding/bantuan, konsistensi data, dan laporan yang perlu ditinjau operator; bedakan hal yang perlu dikonfirmasi pemilik. Jangan mengarang fitur, memberi saran medis, atau memproses/meminta data kesehatan, identitas, kredensial, maupun data pribadi.' },
] as const;

const reportHandoffInstruction: Partial<Record<string, string>> = {
  creator: 'Untuk Ruang Pimpinan, sertakan draf penawaran pilot dan ringkasan validasi. Tandai harga dan hasil sebagai hipotesis; jangan mengarang lead, konversi, proyek terjual, testimoni, atau pendapatan.',
};

export async function forwardOpportunityResearch(tx: Prisma.TransactionClient, jobId: string, draft: WorkDraft): Promise<void> {
  const sourceReferences = draft.grounding?.sources.length
    ? draft.grounding.sources.map((source, index) => `[${index + 1}] ${source.title}: ${source.url}`).join('\n')
    : 'Tidak ada sumber riset terverifikasi yang dilampirkan.';
  for (const task of opportunityTasks) {
    const handoff = reportHandoffInstruction[task.division] ?? '';
    await tx.officeJob.create({ data: {
      id: `${jobId}:${task.taskId}`, division: task.division, staffId: task.staffId, title: task.title, status: 'PAUSED',
      instruction: `${task.instruction}${handoff ? `\n\n${handoff}` : ''}\n\nGunakan hanya sumber yang dicantumkan di bawah. Jangan mengklaim riset web terbaru atau fakta pasar yang tidak didukung sumber. Jika tanggal atau kebaruan sumber tidak jelas, tandai belum terverifikasi.\n\nSumber riset rujukan ${draft.id}:\n${sourceReferences}\n\nIsi riset rujukan:\n${draft.content.slice(0, 3500)}`,
    } });
  }
}

export function sourceForOpportunityJob(id: string): string | undefined {
  const [researchId, taskId, extra] = id.split(':');
  const legacyTaskIds = [
    'sales_paud',
    'sales_posyandu',
    'qa',
    'strategist',
    'guard_ai',
    'engineer_scanbite',
    'engineer_konter',
    'engineer_lorisan',
    'cyber_scanbite',
    'cyber_konter',
    'cyber_lorisan',
    'creator_scanbite',
    'creator_konter',
    'creator_lorisan',
  ];
  if (extra !== undefined || !researchId || !taskId || !isOpportunityResearchJob(researchId) ||
      (!opportunityTasks.some((task) => task.taskId === taskId) && !legacyTaskIds.includes(taskId))) return undefined;
  return `job-${researchId}`;
}
