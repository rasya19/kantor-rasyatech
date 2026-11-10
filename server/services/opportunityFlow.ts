import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { WorkDraft } from '../../src/workflowTypes';

const prefix = 'weekly-research-';
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

export async function scheduleWeeklyResearch(now = new Date()): Promise<void> {
  const id = weeklyResearchId(now);
  if (!id) return;
  await prisma.officeJob.createMany({ data: [{
      id, division: 'engineer', staffId: 'market_research',
      title: 'Riset mingguan peluang aplikasi Indonesia',
      instruction: 'Riset pasar dan peluang aplikasi baru untuk ditinjau pimpinan.',
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

const tasks = [
  { staffId: 'sales_paud', division: 'paud', title: 'PAUD: penjualan dan onboarding', instruction: 'Susun rencana validasi pasar, calon segmen, penawaran dan onboarding Siput PAUD. Jangan mengarang fitur, harga atau pelanggan; tandai hal yang harus diverifikasi.' },
  { staffId: 'sales_posyandu', division: 'posyandu', title: 'Posyandu: penjualan dan onboarding', instruction: 'Susun rencana validasi pasar, calon segmen, penawaran dan onboarding Siput Posyandu. Jangan mengarang fitur, harga, pelanggan atau klaim kesehatan; tandai hal yang harus diverifikasi.' },
  { staffId: 'qa', division: 'engineer', title: 'Produk: rancangan dan rencana QA', instruction: 'Pilih satu ide aplikasi dari riset, susun hipotesis, MVP, arsitektur awal, risiko, rencana validasi pelanggan dan daftar uji. Bedakan dugaan dari bukti; jangan mengklaim kode atau pengujian sudah dilakukan.' },
  { staffId: 'strategist', division: 'creator', title: 'Konten: strategi pemasaran produk', instruction: 'Susun satu paket konten pemasaran untuk ide aplikasi dalam riset. Nyatakan bahwa ide belum tentu tersedia dan jangan mengarang tren, fitur, testimoni atau hasil penjualan.' },
  { staffId: 'guard_ai', division: 'cyber', title: 'Keamanan: rencana perlindungan produk', instruction: 'Susun risiko privasi dan keamanan serta rencana peninjauan untuk ide aplikasi dari riset. Jangan mengklaim sistem telah diaudit atau diamankan.' },
] as const;

export async function forwardOpportunityResearch(tx: Prisma.TransactionClient, jobId: string, draft: WorkDraft): Promise<void> {
  for (const task of tasks) {
    await tx.officeJob.create({ data: {
      id: `${jobId}:${task.staffId}`, division: task.division, staffId: task.staffId, title: task.title,
      instruction: `${task.instruction}\n\nRiset rujukan ${draft.id} (hasil AI harus diverifikasi; sumber ada di laporan riset):\n${draft.content.slice(0, 16000)}`,
    } });
  }
}

export function sourceForOpportunityJob(id: string): string | undefined {
  const match = /^(weekly-research-\d{4}-\d{2}-\d{2}):(?:sales_paud|sales_posyandu|qa|strategist|guard_ai)$/.exec(id);
  return match ? `job-${match[1]}` : undefined;
}
