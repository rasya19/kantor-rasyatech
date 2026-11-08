import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

type Transaction = Prisma.TransactionClient;

export async function createContentFlow(tx: Transaction, title: string, instruction: string, id: string = randomUUID()): Promise<void> {
  await tx.contentFlow.create({ data: { id } });
  await tx.officeJob.create({ data: { id, division: 'creator', staffId: 'trendy', title, instruction, contentFlowId: id } });
}

export async function forwardContentStage(tx: Transaction, flowId: string, currentStaff: string, content: string): Promise<void> {
  const next = currentStaff === 'trendy'
    ? { staffId: 'script_ai', label: 'Naskah Script-AI', instruction: 'Susun naskah video pendek 9:16 berdasarkan ide berikut. Bedakan fakta dan hal yang perlu diverifikasi; jangan mengklaim sudah melakukan riset langsung.' }
    : currentStaff === 'script_ai'
      ? { staffId: 'clipper', label: 'Paket konten Clipper', instruction: 'Berdasarkan naskah berikut, siapkan paket akhir untuk pimpinan: naskah video, rencana visual, caption, tagar, dan informasi yang perlu diverifikasi. Jangan mengklaim video sudah diproduksi atau diterbitkan.' }
      : null;
  if (!next) return;
  await tx.officeJob.create({ data: {
    id: `${flowId}:${next.staffId}`,
    contentFlowId: flowId,
    division: 'creator',
    staffId: next.staffId,
    title: `${next.label} · alur konten`,
    instruction: `${next.instruction}\n\nHasil tahap sebelumnya:\n${content}`,
  } });
}
