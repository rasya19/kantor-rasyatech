import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getStaff } from '../../src/staff';
import { isOfficeDivision } from '../../src/workflowTypes';
import type { OfficeJob, WorkDraft } from '../../src/workflowTypes';
import { generateReportWithDetails } from './workflowService';
import { forwardContentStage } from './contentFlow';
import { contentPackageInstruction, contentPackageProblems } from './contentPackage';
import { generateProductResearch } from './businessResearch';
import { forwardOpportunityResearch, isWeeklyResearch, sourceForOpportunityJob } from './opportunityFlow';

const publicFields = {
  id: true, division: true, staffId: true, title: true, status: true,
  ticketId: true, draftId: true, error: true, createdAt: true, updatedAt: true,
} satisfies Prisma.OfficeJobSelect;

export async function listJobs(): Promise<OfficeJob[]> {
  const [active, recent] = await Promise.all([
    prisma.officeJob.findMany({ where: { status: { in: ['QUEUED', 'RUNNING'] } }, select: publicFields, orderBy: { createdAt: 'desc' } }),
    prisma.officeJob.findMany({ where: { status: { in: ['DONE', 'FAILED'] } }, select: publicFields, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const jobs = [...active, ...recent];
  return jobs.map((job) => {
    if (!isOfficeDivision(job.division) || !getStaff(job.staffId) ||
        !['QUEUED', 'RUNNING', 'DONE', 'FAILED'].includes(job.status)) {
      throw new Error(`Invalid office job ${job.id}`);
    }
    return { ...job, division: job.division, status: job.status as OfficeJob['status'],
      createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() };
  });
}

let workerBusy = false;
export async function processNextJob(): Promise<void> {
  if (workerBusy) return;
  workerBusy = true;
  try {
    await prisma.officeJob.updateMany({
      where: { status: 'RUNNING', leaseUntil: { lt: new Date() } },
      data: { status: 'FAILED', error: 'Pemrosesan terputus. Periksa hasil lalu coba lagi.', claimToken: null, leaseUntil: null },
    });
    const job = await prisma.officeJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } });
    if (!job) return;
    const token = randomUUID();
    const claimed = await prisma.officeJob.updateMany({
      where: { id: job.id, status: 'QUEUED' },
      data: { status: 'RUNNING', claimToken: token, leaseUntil: new Date(Date.now() + 180000), error: null },
    });
    if (claimed.count !== 1) return;
    try {
      const staff = getStaff(job.staffId);
      if (!staff || !isOfficeDivision(job.division) || staff.division !== job.division) throw new Error('Penugasan staf tidak valid.');
      if (isWeeklyResearch(job.id)) {
        if (job.staffId !== 'market_research' || job.division !== 'engineer') throw new Error('Penugasan riset mingguan tidak valid.');
        const draft = await generateProductResearch('opportunities', `job-${job.id}`);
        const snapshot: Prisma.InputJsonObject = { ...draft };
        await prisma.$transaction(async (transaction) => {
          const updated = await transaction.officeJob.updateMany({
            where: { id: job.id, status: 'RUNNING', claimToken: token, leaseUntil: { gt: new Date() } },
            data: { status: 'DONE', draftId: draft.id, claimToken: null, leaseUntil: null },
          });
          if (updated.count !== 1) throw new Error('Hak pemrosesan tugas telah berakhir.');
          await transaction.officeDraft.create({ data: { id: draft.id, data: snapshot, events: { create: { action: 'CREATED', data: snapshot } } } });
          await forwardOpportunityResearch(transaction, job.id, draft);
        });
        return;
      }
      const isContentPackage = job.division === 'creator' && (!job.contentFlowId || job.staffId === 'clipper');
      const { content, ai } = await generateReportWithDetails(`Anda ${staff.name}, staf ${staff.role}. Buat laporan untuk pimpinan.\n${job.instruction}${isContentPackage ? `\n\n${contentPackageInstruction}` : ''}`, job.division, AbortSignal.timeout(90000));
      if (isContentPackage) {
        const problems = contentPackageProblems(content);
        if (problems.length) throw new Error(`Paket konten AI belum lengkap: ${problems.join(', ')}. Coba lagi.`);
      }
      const now = new Date().toISOString();
      const draft: WorkDraft = {
        id: `job-${job.id}`, division: job.division, ticketId: job.ticketId,
        title: job.title, content, ai, ...(sourceForOpportunityJob(job.id) ? { sourceDraftId: sourceForOpportunityJob(job.id) } : {}), ...(isContentPackage ? { contentPackageVersion: 1 as const } : {}), status: job.contentFlowId && job.staffId !== 'clipper' ? 'INTERMEDIATE' : 'PENDING', createdAt: now, updatedAt: now,
      };
      const snapshot: Prisma.InputJsonObject = { ...draft };
      await prisma.$transaction(async (transaction) => {
        const updated = await transaction.officeJob.updateMany({
          where: { id: job.id, status: 'RUNNING', claimToken: token, leaseUntil: { gt: new Date() } },
          data: { status: 'DONE', draftId: draft.id, claimToken: null, leaseUntil: null },
        });
        if (updated.count !== 1) throw new Error('Hak pemrosesan tugas telah berakhir.');
        await transaction.officeDraft.create({
          data: { id: draft.id, ticketId: draft.ticketId, data: snapshot,
            events: { create: { action: 'CREATED', data: snapshot } } },
        });
        if (job.contentFlowId) await forwardContentStage(transaction, job.contentFlowId, job.staffId, content);
      });
    } catch (error) {
      console.error('[Antrean kantor] Tugas gagal:', error);
      const message = error instanceof Error ? error.message : 'Kesalahan pemrosesan tugas.';
      await prisma.officeJob.updateMany({
        where: { id: job.id, status: 'RUNNING', claimToken: token },
        data: { status: 'FAILED', error: message.slice(0, 500), claimToken: null, leaseUntil: null },
      });
    }
  } finally {
    workerBusy = false;
  }
}

export function startJobWorker(): void {
  const run = () => { void processNextJob().catch((error) => console.error('[Antrean kantor] Worker gagal:', error)); };
  run();
  setInterval(run, 3000);
}
