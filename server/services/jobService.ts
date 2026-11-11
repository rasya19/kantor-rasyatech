import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getStaff } from '../../src/staff';
import { isOfficeDivision } from '../../src/workflowTypes';
import type { OfficeJob, WorkDraft } from '../../src/workflowTypes';
import { generateReportWithDetails } from './workflowService';
import { forwardContentStage } from './contentFlow';
import { contentPackageInstruction, contentPackageProblems } from './contentPackage';
import { generateDigitalProductResearch, generateProductResearch, isDigitalProductResearchJob } from './businessResearch';
import { forwardOpportunityResearch, isOpportunityResearchJob, sourceForOpportunityJob } from './opportunityFlow';
import { digitalProductPackageProblems, sourceDraftForCreatorFollowup } from './creatorFollowup';
import { isDigitalProductResearchDraftId } from '../../src/workflowTypes';
import { generateFinancialManagerReport } from './financialManager';

const publicFields = {
  id: true, division: true, staffId: true, title: true, status: true,
  ticketId: true, draftId: true, error: true, createdAt: true, updatedAt: true,
} satisfies Prisma.OfficeJobSelect;

export async function listJobs(): Promise<OfficeJob[]> {
  const [active, recent] = await Promise.all([
    prisma.officeJob.findMany({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } }, select: publicFields, orderBy: { createdAt: 'desc' } }),
    prisma.officeJob.findMany({ where: { status: { in: ['DONE', 'FAILED'] } }, select: publicFields, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const jobs = [...active, ...recent];
  return jobs.map((job) => {
    if (!isOfficeDivision(job.division) || !getStaff(job.staffId) ||
        !['QUEUED', 'RUNNING', 'DONE', 'FAILED', 'PAUSED'].includes(job.status)) {
      throw new Error(`Invalid office job ${job.id}`);
    }
    return { ...job, division: job.division, status: job.status as OfficeJob['status'],
      createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() };
  });
}

let workerBusy = false;
const jobLeaseDurationMs = 210_000;

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
      data: { status: 'RUNNING', claimToken: token, leaseUntil: new Date(Date.now() + jobLeaseDurationMs), error: null },
    });
    if (claimed.count !== 1) return;
    try {
      const staff = getStaff(job.staffId);
      if (!staff || !isOfficeDivision(job.division) || staff.division !== job.division) throw new Error('Penugasan staf tidak valid.');
      if (job.staffId === 'finance_manager') {
        const content = await generateFinancialManagerReport();
        const now = new Date().toISOString();
        const draft: WorkDraft = {
          id: `job-${job.id}`, division: job.division, ticketId: job.ticketId,
          title: job.title, content, status: 'PENDING', createdAt: now, updatedAt: now,
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
        });
        return;
      }
      if (isOpportunityResearchJob(job.id) || isDigitalProductResearchJob(job.id)) {
        const isDigitalProductResearch = isDigitalProductResearchJob(job.id);
        if (isDigitalProductResearch
          ? job.staffId !== 'strategist' || job.division !== 'creator'
          : job.staffId !== 'market_research' || job.division !== 'engineer') {
          throw new Error('Penugasan riset peluang tidak valid.');
        }
        const draft = isDigitalProductResearch
          ? await generateDigitalProductResearch(`job-${job.id}`, job.instruction)
          : await generateProductResearch('opportunities', `job-${job.id}`);
        const snapshot: Prisma.InputJsonObject = { ...draft };
        await prisma.$transaction(async (transaction) => {
          const updated = await transaction.officeJob.updateMany({
            where: { id: job.id, status: 'RUNNING', claimToken: token, leaseUntil: { gt: new Date() } },
            data: { status: 'DONE', draftId: draft.id, claimToken: null, leaseUntil: null },
          });
          if (updated.count !== 1) throw new Error('Hak pemrosesan tugas telah berakhir.');
          await transaction.officeDraft.create({ data: { id: draft.id, data: snapshot, events: { create: { action: 'CREATED', data: snapshot } } } });
          if (isOpportunityResearchJob(job.id)) await forwardOpportunityResearch(transaction, job.id, draft);
        });
        return;
      }
      const isContentPackage = job.division === 'creator' &&
        (job.staffId === 'clipper' || (!job.contentFlowId && !sourceDraftForCreatorFollowup(job.id)));
      const sourceDraftId = sourceDraftForCreatorFollowup(job.id) ?? sourceForOpportunityJob(job.id);
      const isDigitalProductPackage = sourceDraftId !== undefined && isDigitalProductResearchDraftId(sourceDraftId);
      const sourceFlow = job.contentFlowId
        ? await prisma.contentFlow.findUnique({ where: { id: job.contentFlowId }, select: { sourceDraftId: true } })
        : null;
      const sourceRecord = sourceFlow?.sourceDraftId
        ? await prisma.officeDraft.findUnique({ where: { id: sourceFlow.sourceDraftId }, select: { data: true } })
        : null;
      const sourceData = sourceRecord?.data;
      const isDigitalProductMarketing = Boolean(sourceData && !Array.isArray(sourceData) &&
        typeof sourceData === 'object' && sourceData.productPackageVersion === 1);
      const mandateGuidance = 'mandateGuidance' in staff ? staff.mandateGuidance : undefined;
      const { content, ai } = await generateReportWithDetails(
        `Anda ${staff.name}, staf ${staff.role}. Buat laporan untuk pimpinan.\n${mandateGuidance ? `${mandateGuidance}\n\n` : ''}${job.instruction}${isContentPackage ? `\n\n${contentPackageInstruction}` : ''}`,
        job.division,
        AbortSignal.timeout(90000),
        isDigitalProductPackage || isDigitalProductMarketing ? 'digital' : undefined,
      );
      if (isContentPackage) {
        const problems = contentPackageProblems(content);
        if (problems.length) throw new Error(`Paket konten AI belum lengkap: ${problems.join(', ')}. Coba lagi.`);
      }
      if (isDigitalProductPackage) {
        const problems = digitalProductPackageProblems(content);
        if (problems.length) throw new Error(`Produk digital AI belum siap dijadikan PDF: ${problems.join(', ')}. Coba lagi.`);
      }
      const now = new Date().toISOString();
      const draft: WorkDraft = {
        id: `job-${job.id}`, division: job.division, ticketId: job.ticketId,
        title: job.title, content, ai, ...(sourceDraftId ? { sourceDraftId } : {}), ...(isContentPackage ? { contentPackageVersion: 1 as const } : {}), ...(isDigitalProductPackage ? { productPackageVersion: 1 as const } : {}), status: job.contentFlowId && job.staffId !== 'clipper' ? 'INTERMEDIATE' : 'PENDING', createdAt: now, updatedAt: now,
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
  const run = () => {
    void (async () => {
      await processNextJob();
    })().catch((error) => console.error('[Antrean kantor] Worker gagal:', error));
  };
  run();
  setInterval(run, 3000);
}
