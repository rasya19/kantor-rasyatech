import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getStaff } from '../../src/staff.js';
import { isOfficeDivision } from '../../src/workflowTypes.js';
import type { OfficeJob, WorkDraft } from '../../src/workflowTypes.js';
import { generateReportWithDetails } from './workflowService.js';
import { forwardContentStage } from './contentFlow.js';
import { contentPackageInstruction, contentPackageProblems } from './contentPackage.js';
import { generateDigitalProductResearch, generateProductResearch, isDigitalProductResearchJob } from './businessResearch.js';
import { forwardOpportunityResearch, isOpportunityResearchJob, sourceForOpportunityJob } from './opportunityFlow.js';
import { digitalProductPackageProblems, sourceDraftForCreatorFollowup } from './creatorFollowup.js';
import { isDigitalProductResearchDraftId } from '../../src/workflowTypes.js';
import { generateFinancialManagerReport } from './financialManager.js';

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

export async function processNextJob(): Promise<boolean> {
  if (workerBusy) return false;
  workerBusy = true;
  try {
    await prisma.officeJob.updateMany({
      where: { status: 'RUNNING', leaseUntil: { lt: new Date() } },
      data: { status: 'FAILED', error: 'Pemrosesan terputus. Periksa hasil lalu coba lagi.', claimToken: null, leaseUntil: null },
    });
    const job = await prisma.officeJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' } });
    if (!job) return false;
    const token = randomUUID();
    const claimed = await prisma.officeJob.updateMany({
      where: { id: job.id, status: 'QUEUED' },
      data: { status: 'RUNNING', claimToken: token, leaseUntil: new Date(Date.now() + jobLeaseDurationMs), error: null },
    });
    if (claimed.count !== 1) return false;
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
        return true;
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
        return true;
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
      const generated = await generateReportWithDetails(
        `Anda ${staff.name}, staf ${staff.role}. Buat laporan untuk pimpinan.\n${mandateGuidance ? `${mandateGuidance}\n\n` : ''}${job.instruction}${isContentPackage ? `\n\n${contentPackageInstruction}` : ''}`,
        job.division,
        AbortSignal.timeout(90000),
        isDigitalProductPackage || isDigitalProductMarketing ? 'digital' : undefined,
      );
      let finalContent = generated.content;
      const ai = generated.ai;
      let markContentPackage = isContentPackage;
      let markDigitalProductPackage = isDigitalProductPackage;

      if (isContentPackage) {
        const problems = contentPackageProblems(finalContent, job.instruction);
        if (problems.length) {
          // Keep partial format instead of discarding already-billed AI output.
          finalContent = `[PERLU LENGKAPI FORMAT — bagian belum terisi: ${problems.join(', ')}]\n\n${finalContent}`;
          markContentPackage = false;
        }
      }
      if (isDigitalProductPackage) {
        const problems = digitalProductPackageProblems(finalContent);
        if (problems.length) {
          finalContent = `[PERLU LENGKAPI FORMAT PDF — bagian belum terisi: ${problems.join(', ')}]\n\n${finalContent}`;
          markDigitalProductPackage = false;
        }
      }
      const now = new Date().toISOString();
      const draft: WorkDraft = {
        id: `job-${job.id}`, division: job.division, ticketId: job.ticketId,
        title: job.title, content: finalContent, ai, ...(sourceDraftId ? { sourceDraftId } : {}), ...(markContentPackage ? { contentPackageVersion: 1 as const } : {}), ...(markDigitalProductPackage ? { productPackageVersion: 1 as const } : {}), status: job.contentFlowId && job.staffId !== 'clipper' ? 'INTERMEDIATE' : 'PENDING', createdAt: now, updatedAt: now,
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
        if (job.contentFlowId) await forwardContentStage(transaction, job.contentFlowId, job.staffId, finalContent);
      });
    } catch (error) {
      console.error('[Antrean kantor] Tugas gagal:', error);
      const message = error instanceof Error ? error.message : 'Kesalahan pemrosesan tugas.';
      await prisma.officeJob.updateMany({
        where: { id: job.id, status: 'RUNNING', claimToken: token },
        data: { status: 'FAILED', error: message.slice(0, 500), claimToken: null, leaseUntil: null },
      });
    }
    return true;
  } finally {
    workerBusy = false;
  }
}

const jobIdleBackoffMs = [5_000, 15_000, 30_000, 60_000];
let jobWorkerTimer: ReturnType<typeof setTimeout> | null = null;
let jobWorkerStarted = false;
let jobIdleStep = 0;

function scheduleJobWorker(delayMs: number): void {
  if (!jobWorkerStarted) return;
  if (jobWorkerTimer) clearTimeout(jobWorkerTimer);
  jobWorkerTimer = setTimeout(() => {
    void (async () => {
      const worked = await processNextJob();
      if (worked) {
        jobIdleStep = 0;
        scheduleJobWorker(1_500);
      } else {
        const delay = jobIdleBackoffMs[Math.min(jobIdleStep, jobIdleBackoffMs.length - 1)];
        jobIdleStep = Math.min(jobIdleStep + 1, jobIdleBackoffMs.length - 1);
        scheduleJobWorker(delay);
      }
    })().catch((error) => {
      console.error('[Antrean kantor] Worker gagal:', error);
      scheduleJobWorker(15_000);
    });
  }, delayMs);
}

export function wakeJobWorker(): void {
  jobIdleStep = 0;
  if (jobWorkerStarted) scheduleJobWorker(50);
}

export function startJobWorker(): void {
  jobWorkerStarted = true;
  jobIdleStep = 0;
  scheduleJobWorker(0);
}
