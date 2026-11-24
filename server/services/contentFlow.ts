import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

type Transaction = Prisma.TransactionClient;

export async function createContentFlow(tx: Transaction, title: string, instruction: string, id: string = randomUUID(), sourceDraftId?: string): Promise<void> {
  await tx.contentFlow.create({ data: { id, ...(sourceDraftId ? { sourceDraftId } : {}) } });
  await tx.officeJob.create({ data: { id, division: 'creator', staffId: 'clipper', title, instruction, contentFlowId: id } });
}

export async function forwardContentStage(tx: Transaction, flowId: string, currentStaff: string, content: string, sourceContext?: string): Promise<void> {
  const next = currentStaff === 'trendy'
    ? { staffId: 'script_ai', label: 'Naskah Script-AI', instruction: 'Susun naskah video pendek yang utuh dan natural berdasarkan mandat, draf sumber, serta ide Trendy. Sesuaikan audiens, tujuan, platform, gaya, dan ajakan bertindak dengan brief; pertahankan fakta dari sumber dan tandai hal yang perlu diverifikasi. Jangan mengklaim telah melakukan riset langsung atau menambahkan fitur/hasil yang tidak didukung.' }
    : currentStaff === 'script_ai'
      ? { staffId: 'clipper', label: 'Paket konten Clipper', instruction: 'Siapkan paket akhir yang lengkap untuk pimpinan berdasarkan mandat, draf sumber, dan naskah Script-AI. Sesuaikan kedalaman isi dengan brief; jangan meringkas menjadi jawaban satu-dua kalimat atau mengisi dengan pengulangan. Pertahankan fakta sumber, tandai hal yang perlu diverifikasi, dan jangan mengklaim video sudah diproduksi atau diterbitkan.' }
      : null;
  if (!next) return;
  const source = await tx.officeJob.findFirst({
    where: { contentFlowId: flowId, staffId: 'trendy' },
    select: { instruction: true },
  });
  const preservedContext = sourceContext ?? source?.instruction ?? '';
  await tx.officeJob.create({ data: {
    id: `${flowId}:${next.staffId}`,
    contentFlowId: flowId,
    division: 'creator',
    staffId: next.staffId,
    title: `${next.label} · alur konten`,
    instruction: `${next.instruction}\n\nMandat dan draf sumber yang menjadi acuan:\n${preservedContext}\n\nHasil tahap sebelumnya:\n${content}`,
  } });
}
