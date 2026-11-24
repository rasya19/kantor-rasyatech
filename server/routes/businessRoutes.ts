import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { enqueueDigitalProductResearch, isDailyDigitalProductResearchJob, researchProduct } from '../services/businessResearch.js';
import { enqueueOpportunitySprint, isOpportunitySprintJob, sourceForOpportunityJob } from '../services/opportunityFlow.js';
import { buildExecutiveReport, isLeadStatus, jakartaDateKey, jakartaPeriodBounds, type ReportPeriod } from '../services/executiveReport.js';
import { WorkflowError } from '../services/workflowService.js';
import { wakeJobWorker } from '../services/jobService.js';
import { getUsdIdrRate } from '../services/exchangeRate.js';
import { getOpenRouterCredits, getOpenRouterKeyBudget } from '../services/openrouter.js';

const router = Router();
const products = ['paud', 'posyandu', 'scanbite', 'konter', 'lorisan', 'digital', 'other'];
const commercialProducts = ['scanbite', 'konter', 'lorisan', 'digital'];
const route = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

router.get('/schedule', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: process.env.OPPORTUNITY_SCHEDULE_ENABLED === 'true' });
});

router.post('/research', route(async (req, res) => {
  if (req.body?.product !== 'paud' && req.body?.product !== 'posyandu' && req.body?.product !== 'opportunities') throw new WorkflowError('Produk tidak valid.');
  if (req.body.product === 'opportunities') {
    const queued = await enqueueDigitalProductResearch();
    wakeJobWorker();
    res.status(202).json(queued);
    return;
  }
  res.status(201).json({ draft: await researchProduct(req.body.product) });
}));

router.post('/opportunities/sprint', route(async (_req, res) => {
  const result = await enqueueOpportunitySprint();
  if (!result.alreadyActive) wakeJobWorker();
  res.set('Cache-Control', 'no-store');
  res.status(result.alreadyActive ? 200 : 202).json(result);
}));

router.delete('/opportunities/jobs/:id', route(async (req, res) => {
  const id = req.params.id;
  if (!isOpportunitySprintJob(id)) throw new WorkflowError('Tugas ini bukan bagian dari sprint peluang.', 400);
  const job = await prisma.officeJob.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!job) throw new WorkflowError('Tugas sprint tidak ditemukan.', 404);
  if (job.status !== 'FAILED') throw new WorkflowError('Hanya tugas sprint yang gagal yang dapat dihapus dari daftar.', 409);
  const dismissed = await prisma.officeJob.updateMany({
    where: { id, status: 'FAILED' },
    data: { status: 'DISMISSED' },
  });
  if (!dismissed.count) throw new WorkflowError('Status tugas berubah. Muat ulang antrean dan coba lagi.', 409);
  res.json({ success: true });
}));

router.post('/opportunities/jobs/:id/start', route(async (req, res) => {
  const id = req.params.id;
  if (!sourceForOpportunityJob(id)) throw new WorkflowError('Pilih tugas lanjutan yang valid dari sprint peluang.', 400);
  const parentId = id.slice(0, id.lastIndexOf(':'));
  const job = await prisma.officeJob.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!job) throw new WorkflowError('Tugas sprint tidak ditemukan.', 404);
  if (job.status !== 'PAUSED') throw new WorkflowError('Tugas ini tidak sedang menunggu pilihan.', 409);

  const parent = await prisma.officeJob.findUnique({ where: { id: parentId }, select: { status: true } });
  if (parent?.status !== 'DONE') throw new WorkflowError('Riset sprint utama belum selesai.', 409);
  const siblingActivity = await prisma.officeJob.findFirst({
    where: {
      id: { startsWith: `${parentId}:` },
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    select: { id: true },
  });
  if (siblingActivity) throw new WorkflowError('Selesaikan atau sisihkan tugas sprint yang sudah dipilih sebelum memilih tugas berikutnya.', 409);

  const started = await prisma.officeJob.updateMany({
    where: { id, status: 'PAUSED' },
    data: { status: 'QUEUED' },
  });
  if (!started.count) throw new WorkflowError('Status tugas berubah. Muat ulang antrean dan coba lagi.', 409);
  wakeJobWorker();
  res.status(202).json({ success: true });
}));

router.post('/daily-product/jobs/:id/start', route(async (req, res) => {
  const { id } = req.params;
  if (!isDailyDigitalProductResearchJob(id)) throw new WorkflowError('Tugas produk digital harian tidak valid.');
  const job = await prisma.officeJob.findUnique({
    where: { id },
    select: { id: true, division: true, staffId: true, status: true },
  });
  if (!job) throw new WorkflowError('Tugas produk digital harian tidak ditemukan.', 404);
  if (job.division !== 'creator' || job.staffId !== 'strategist' || job.status !== 'PAUSED') {
    throw new WorkflowError('Tugas ini tidak lagi menunggu pilihan.', 409);
  }
  const active = await prisma.officeJob.findFirst({
    where: {
      id: { startsWith: 'daily-digital-product-' },
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    select: { id: true },
  });
  if (active) throw new WorkflowError('Selesaikan atau periksa tugas produk digital yang sedang berjalan sebelum memulai tugas berikutnya.', 409);
  const started = await prisma.officeJob.updateMany({
    where: { id, status: 'PAUSED' },
    data: { status: 'QUEUED' },
  });
  if (!started.count) throw new WorkflowError('Status tugas berubah. Muat ulang antrean dan coba lagi.', 409);
  wakeJobWorker();
  res.status(202).json({ success: true });
}));

router.get('/transactions', route(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const transactions = await prisma.financeTransaction.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
  res.json({ transactions });
}));

router.get('/executive-report', route(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : jakartaDateKey();
  const periodValue = typeof req.query.period === 'string' ? req.query.period : 'day';
  if (!['day', 'week', 'month'].includes(periodValue)) throw new WorkflowError('Periode laporan tidak valid.');
  const period = periodValue as ReportPeriod;
  const bounds = jakartaPeriodBounds(date, period);
  if (!bounds) throw new WorkflowError('Tanggal laporan tidak valid.');
  const range = { gte: bounds.start, lt: bounds.end };
  const [transactions, usage, leads, recentLeads, jobs, draftRecords, rateInfo, keyBudgetResult, creditsResult] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { date: { gte: bounds.startDate, lte: bounds.endDate }, voidedAt: null },
      select: { product: true, kind: true, amount: true },
    }),
    prisma.openRouterUsage.findMany({
      where: { createdAt: range },
      select: { division: true, product: true, model: true, promptTokens: true, completionTokens: true, costUsd: true, usageAvailable: true },
    }),
    prisma.businessLead.findMany({
      select: { status: true, valueIdr: true, createdAt: true, convertedAt: true, soldAt: true, lostAt: true },
    }),
    prisma.businessLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, product: true, status: true, valueIdr: true, note: true, createdAt: true },
    }),
    prisma.officeJob.findMany({
      where: { OR: [{ createdAt: range }, { updatedAt: range }] },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: { id: true, title: true, division: true, status: true, draftId: true, error: true, createdAt: true, updatedAt: true },
    }),
    prisma.officeDraft.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, data: true, createdAt: true },
    }),
    getUsdIdrRate(),
    getOpenRouterKeyBudget(AbortSignal.timeout(4000)).catch(() => null),
    getOpenRouterCredits(AbortSignal.timeout(4000)).catch(() => null),
  ]);
  const usdIdr = rateInfo.rate;
  res.set('Cache-Control', 'no-store');
  res.json({
    report: {
      ...buildExecutiveReport({ date, period, startDate: bounds.startDate, endDate: bounds.endDate, transactions, usage, leads, usdIdr }),
      exchangeRateInvalid: rateInfo.envInvalid && usdIdr === null,
      exchangeRateSource: rateInfo.source,
      exchangeRateProvider: rateInfo.provider,
      exchangeRateUpdatedAt: rateInfo.updatedAt,
      openRouterLive: {
        keyLimitUsd: keyBudgetResult ? keyBudgetResult.limitUsd : null,
        keyRemainingUsd: keyBudgetResult ? keyBudgetResult.remainingUsd : null,
        accountTotalCredits: creditsResult ? creditsResult.totalCredits : null,
        accountTotalUsage: creditsResult ? creditsResult.totalUsage : null,
        accountRemainingCredits: creditsResult ? Math.max(0, creditsResult.totalCredits - creditsResult.totalUsage) : null,
      },
      recentLeads: recentLeads.map((lead) => ({ ...lead, createdAt: lead.createdAt.toISOString() })),
      incomeSourceConnected: false,
      externalExpensesAutoTracked: false,
      workSummary: {
        total: jobs.length,
        completed: jobs.filter((job) => job.status === 'DONE').length,
        failed: jobs.filter((job) => job.status === 'FAILED').length,
        queued: jobs.filter((job) => job.status === 'QUEUED').length,
        running: jobs.filter((job) => job.status === 'RUNNING').length,
        paused: jobs.filter((job) => job.status === 'PAUSED').length,
      },
      activities: jobs.map((job) => ({
        ...job,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
      outputs: draftRecords.flatMap((record) => {
        const data = record.data;
        if (!data || Array.isArray(data) || typeof data !== 'object' ||
            typeof data.title !== 'string' || typeof data.division !== 'string' ||
            typeof data.status !== 'string') return [];
        return [{
          id: record.id,
          title: data.title,
          division: data.division,
          status: data.status,
          isDigitalProduct: data.productPackageVersion === 1,
          createdAt: record.createdAt.toISOString(),
        }];
      }),
    },
  });
}));

router.post('/transactions', route(async (req, res) => {
  const { product, kind, amount, date, note } = req.body || {};
  if (!products.includes(product) || !['INCOME', 'EXPENSE', 'ESTIMATE'].includes(kind)) throw new WorkflowError('Produk atau jenis transaksi tidak valid.');
  if (!Number.isInteger(amount) || amount <= 0 || amount > 2147483647) throw new WorkflowError('Nominal harus berupa rupiah bulat antara 1 dan 2.147.483.647.');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new WorkflowError('Tanggal tidak valid.');
  if (typeof note !== 'string' || note.length > 200) throw new WorkflowError('Catatan maksimal 200 karakter.');
  const transaction = await prisma.financeTransaction.create({ data: { product, kind, amount, date, note: note.trim() } });
  res.status(201).json({ transaction });
}));

router.post('/leads', route(async (req, res) => {
  const { product, valueIdr, note } = req.body || {};
  if (!commercialProducts.includes(product)) throw new WorkflowError('Produk lead tidak valid.');
  if (valueIdr !== null && valueIdr !== undefined &&
      (!Number.isInteger(valueIdr) || valueIdr <= 0 || valueIdr > 2147483647)) {
    throw new WorkflowError('Nilai estimasi harus berupa rupiah bulat antara 1 dan 2.147.483.647.');
  }
  if (typeof note !== 'string' || note.length > 200) throw new WorkflowError('Catatan lead maksimal 200 karakter.');
  const lead = await prisma.businessLead.create({
    data: { product, valueIdr: valueIdr ?? null, note: note.trim() },
    select: { id: true, product: true, status: true, valueIdr: true, note: true, createdAt: true },
  });
  res.status(201).json({ lead: { ...lead, createdAt: lead.createdAt.toISOString() } });
}));

router.patch('/leads/:id/status', route(async (req, res) => {
  const { status } = req.body || {};
  if (!isLeadStatus(status) || status === 'LEAD') throw new WorkflowError('Status tujuan lead tidak valid.');
  const lead = await prisma.businessLead.findUnique({ where: { id: req.params.id } });
  if (!lead) throw new WorkflowError('Lead tidak ditemukan.', 404);
  const allowed: Record<string, string[]> = {
    LEAD: ['CONVERTED', 'LOST'],
    CONVERTED: ['SOLD', 'LOST'],
    SOLD: [],
    LOST: [],
  };
  if (!allowed[lead.status]?.includes(status)) throw new WorkflowError('Perubahan status lead tidak diizinkan.', 409);
  const now = new Date();
  const updated = await prisma.businessLead.updateMany({
    where: { id: lead.id, status: lead.status },
    data: {
      status,
      ...(status === 'CONVERTED' ? { convertedAt: now } : {}),
      ...(status === 'SOLD' ? { soldAt: now } : {}),
      ...(status === 'LOST' ? { lostAt: now } : {}),
    },
  });
  if (!updated.count) throw new WorkflowError('Status lead berubah di permintaan lain; muat ulang sebelum mencoba lagi.', 409);
  const saved = await prisma.businessLead.findUniqueOrThrow({
    where: { id: lead.id },
    select: { id: true, product: true, status: true, valueIdr: true, note: true, createdAt: true },
  });
  res.json({ lead: { ...saved, createdAt: saved.createdAt.toISOString() } });
}));

router.post('/transactions/:id/void', route(async (req, res) => {
  const updated = await prisma.financeTransaction.updateMany({
    where: { id: req.params.id, voidedAt: null },
    data: { voidedAt: new Date() },
  });
  if (!updated.count) throw new WorkflowError('Transaksi tidak ditemukan atau sudah dibatalkan.', 409);
  res.json({ ok: true });
}));

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Bisnis API]', err);
  if (err instanceof WorkflowError) res.status(err.status).json({ error: err.message });
  else res.status(500).json({ error: 'Operasi gagal. Periksa konfigurasi, koneksi, migrasi, kuota dan log server. Permintaan riset mungkin tetap ditagih.' });
});

export default router;
