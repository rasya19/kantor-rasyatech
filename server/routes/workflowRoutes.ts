import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createContentDraft, createDraft, createTicketDraft, generateReportWithDetails, WorkflowError } from '../services/workflowService.js';
import { getActivitySnapshot, trackActivity } from '../services/activityService.js';
import {
  contentPackageInstruction,
  contentPackageProblems,
  digitalProductPackageInstruction,
  digitalProductSystemInstruction,
} from '../services/contentPackage.js';
import { extractVideoIdeas } from '../../src/lib/videoIdeas.js';
import { generateOfficeAssistantReply, type AssistantMessage } from '../services/officeAssistant.js';
import { creatorFollowupInstruction, digitalProductFollowupJob, creatorFollowupJobId, mandateRequestsContent } from '../services/creatorFollowup.js';
import { digitalProductIdeaKey } from '../../src/lib/digitalProductIdeas.js';
import { createContentFlow } from '../services/contentFlow.js';
import { videoPath, wakeVideoWorker } from '../services/videoService.js';
import { wakeJobWorker } from '../services/jobService.js';
import { adminConfigured, adminCookie, adminSessionFromCookie, clearAdminCookie, createAdminSession, isValidAdminSession, verifyAdminPassword } from '../services/adminAuth.js';
import { getVideoRuntimeConfig, setVideoEnabled, videoEnabled } from '../services/videoRuntimeConfig.js';
import { defaultMaxTokens, getOpenRouterKeyBudget } from '../services/openrouter.js';
import type { Ticket, TicketCategory, TicketDivision, TicketStatus, WorkDraft } from '../../src/workflowTypes.js';
import { isDigitalProductResearchDraftId, isOfficeDivision } from '../../src/workflowTypes.js';

const router = Router();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };

function text(value: unknown, label: string, max = 8000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new WorkflowError(`${label} wajib diisi (maksimal ${max} karakter).`);
  }
  return value.trim();
}

function ticketFromDb(value: {
  id: string; division: string; category: string; title: string; description: string;
  status: string; notes: string; createdAt: Date; updatedAt: Date;
}): Ticket {
  if (!['paud', 'posyandu'].includes(value.division) ||
      !['BUG', 'QUESTION', 'COMPLAINT'].includes(value.category) ||
      !['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'].includes(value.status)) {
    throw new Error(`Invalid ticket data: ${value.id}`);
  }
  return {
    ...value,
    division: value.division as TicketDivision,
    category: value.category as TicketCategory,
    status: value.status as TicketStatus,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}

function parseDraft(value: Prisma.JsonValue): WorkDraft {
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      typeof value.id !== 'string' || (value.ticketId !== null && typeof value.ticketId !== 'string') ||
      !isOfficeDivision(value.division) ||
      typeof value.title !== 'string' || typeof value.content !== 'string' ||
      (value.status !== 'PENDING' && value.status !== 'APPROVED' && value.status !== 'INTERMEDIATE') ||
      typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    throw new Error('Invalid stored draft data');
  }
  let ai: WorkDraft['ai'];
  let grounding: WorkDraft['grounding'];
  if (value.sourceDraftId !== undefined && typeof value.sourceDraftId !== 'string') throw new Error('Invalid source draft ID');
  if (value.grounding !== undefined) {
    const item = value.grounding;
    if (!item || Array.isArray(item) || typeof item !== 'object' || typeof item.searchSuggestions !== 'string' ||
        !Array.isArray(item.sources) || !Array.isArray(item.citations)) throw new Error('Invalid stored grounding data');
    const sources = item.sources.map((source) => {
      if (!source || Array.isArray(source) || typeof source !== 'object' || typeof source.url !== 'string' || typeof source.title !== 'string' || !/^https?:\/\//i.test(source.url)) throw new Error('Invalid grounding source');
      return { url: source.url, title: source.title };
    });
    const citations = item.citations.map((citation) => {
      if (!citation || Array.isArray(citation) || typeof citation !== 'object' || typeof citation.text !== 'string' ||
          !Array.isArray(citation.sourceIndexes) || !citation.sourceIndexes.every((index) => typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < sources.length)) throw new Error('Invalid grounding citation');
      return { text: citation.text, sourceIndexes: citation.sourceIndexes as number[] };
    });
    grounding = { searchSuggestions: item.searchSuggestions, sources, citations };
  }
  if (value.contentPackageVersion !== undefined && (value.contentPackageVersion !== 1 || value.division !== 'creator')) {
    throw new Error('Invalid stored content package version');
  }
  if (value.productPackageVersion !== undefined && (value.productPackageVersion !== 1 || value.division !== 'creator')) {
    throw new Error('Invalid stored product package version');
  }
  if (value.ai !== undefined) {
    if (!value.ai || Array.isArray(value.ai) || typeof value.ai !== 'object' ||
        (value.ai.provider !== 'gemini' && value.ai.provider !== 'copilot' && value.ai.provider !== 'openrouter') || typeof value.ai.model !== 'string') {
      throw new Error('Invalid stored AI provider data');
    }
    ai = { provider: value.ai.provider, model: value.ai.model };
  }
  return {
    id: value.id, ticketId: value.ticketId, division: value.division, title: value.title,
    content: value.content, status: value.status, createdAt: value.createdAt, updatedAt: value.updatedAt, ...(ai ? { ai } : {}),
    ...(value.contentPackageVersion === 1 ? { contentPackageVersion: 1 } : {}), ...(value.productPackageVersion === 1 ? { productPackageVersion: 1 } : {}), ...(grounding ? { grounding } : {}),
    ...(typeof value.sourceDraftId === 'string' ? { sourceDraftId: value.sourceDraftId } : {}),
  };
}

function requireSameOrigin(req: Request): void {
  const origin = req.get('origin');
  if (!origin) throw new WorkflowError('Header asal permintaan admin wajib diisi.', 403);
  try {
    if (new URL(origin).host !== req.get('host')) throw new WorkflowError('Permintaan admin harus berasal dari kantor ini.', 403);
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError('Permintaan admin harus berasal dari kantor ini.', 403);
  }
}

function requireAdmin(req: Request): void {
  if (!isValidAdminSession(adminSessionFromCookie(req.get('cookie')))) {
    throw new WorkflowError('Login admin diperlukan untuk mengubah kontrol video.', 401);
  }
}

const failedAdminLogins = new Map<string, { count: number; blockedUntil: number }>();

function checkAdminLoginRateLimit(req: Request): void {
  const now = Date.now();
  const address = req.ip || 'unknown';
  const current = failedAdminLogins.get(address);
  for (const [key, value] of failedAdminLogins) {
    if (value.blockedUntil < now && value.count === 0) failedAdminLogins.delete(key);
  }
  if (current && current.blockedUntil > now) throw new WorkflowError('Terlalu banyak percobaan login. Coba lagi dalam 15 menit.', 429);
}

function recordFailedAdminLogin(req: Request): void {
  const address = req.ip || 'unknown';
  const current = failedAdminLogins.get(address) ?? { count: 0, blockedUntil: 0 };
  current.count++;
  if (current.count >= 5) {
    current.count = 0;
    current.blockedUntil = Date.now() + 15 * 60_000;
  }
  failedAdminLogins.set(address, current);
}

async function engineerMandateContentFlow(
  tx: Prisma.TransactionClient,
  draft: WorkDraft,
): Promise<{ eligible: boolean; id: string | null; created: boolean }> {
  if (draft.status !== 'APPROVED' || draft.ticketId !== null || draft.division !== 'engineer') {
    return { eligible: false, id: null, created: false };
  }
  const [sourceJob, existing] = await Promise.all([
    tx.officeJob.findFirst({
      where: { draftId: draft.id, division: 'engineer', staffId: 'market_research', ticketId: null, status: 'DONE' },
      select: { instruction: true },
    }),
    tx.contentFlow.findUnique({ where: { sourceDraftId: draft.id }, select: { id: true } }),
  ]);
  if (!sourceJob || !mandateRequestsContent(sourceJob.instruction)) return { eligible: false, id: null, created: false };
  if (existing) return { eligible: true, id: existing.id, created: false };
  const id = randomUUID();
  await createContentFlow(
    tx,
    `Strategi konten · ${draft.title}`,
    `Tugas Clipper (paket langsung): susun satu paket konten lengkap yang relevan berdasarkan mandat dan laporan yang disetujui. Jangan mengklaim telah melakukan riset tren atau memeriksa algoritma platform secara langsung. Tandai hal yang perlu diverifikasi. Hasil akan menjadi draf untuk ditinjau; jangan membuat atau memublikasikan video.\n\nMandat sumber:\n${sourceJob.instruction.slice(0, 1500)}\n\nLaporan yang disetujui:\n${draft.content.slice(0, 4000)}`,
    id,
    draft.id,
  );
  return { eligible: true, id, created: true };
}

async function marketingManagerContentFlow(
  tx: Prisma.TransactionClient,
  draft: WorkDraft,
): Promise<{ eligible: boolean; id: string | null; created: boolean }> {
  if (draft.status !== 'APPROVED' || draft.ticketId !== null || draft.division !== 'marketing') {
    return { eligible: false, id: null, created: false };
  }
  const [sourceJob, existing] = await Promise.all([
    tx.officeJob.findFirst({
      where: { draftId: draft.id, division: 'marketing', staffId: 'marketing_manager', ticketId: null, status: 'DONE' },
      select: { instruction: true },
    }),
    tx.contentFlow.findUnique({ where: { sourceDraftId: draft.id }, select: { id: true } }),
  ]);
  if (existing) return { eligible: true, id: existing.id, created: false };
  const id = randomUUID();
  const sourceInstruction = sourceJob?.instruction ??
    'Brief asli Manajer Pemasaran tidak terhubung. Gunakan hanya fakta yang tertulis dalam laporan disetujui di bawah; jangan mengisi detail yang hilang.';
  await createContentFlow(
    tx,
    `Konten marketing · ${draft.title}`,
    `Tugas Clipper: ubah laporan Manajer Pemasaran yang sudah disetujui menjadi satu paket konten lengkap siap tinjau. Gunakan hanya fitur, harga, tautan, target pengguna, kanal, dan klaim yang dinyatakan terverifikasi dalam brief sumber. Jangan mengarang testimoni, hasil, atau ketersediaan. Jangan menyuruh audiens membeli atau membuka link di bio kecuali tautan/cara pemesanan resmi ada di brief. Jika belum ada, gunakan ajakan non-transaksional dan tandai [PERLU KONFIRMASI]. Hasil adalah draf untuk ditinjau; jangan membuat video, menghubungi pelanggan, atau memublikasikan.\n\nMandat dan brief sumber Manajer Pemasaran:\n${sourceInstruction.slice(0, 1500)}\n\nLaporan Manajer Pemasaran yang disetujui:\n${draft.content.slice(0, 4000)}`,
    id,
    draft.id,
  );
  return { eligible: true, id, created: true };
}

router.get('/activity', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getActivitySnapshot());
});

router.post('/assistant/chat', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  const raw = req.body?.messages;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12) {
    throw new WorkflowError('Percakapan harus berisi 1–12 pesan terakhir.', 400);
  }
  const messages: AssistantMessage[] = [];
  let totalLength = 0;
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        (item.role !== 'user' && item.role !== 'assistant') ||
        typeof item.content !== 'string' || !item.content.trim() || item.content.length > 2000) {
      throw new WorkflowError('Format pesan tidak valid (maksimal 2.000 karakter per pesan).', 400);
    }
    if (index > 0 && messages[index - 1]?.role === item.role) {
      throw new WorkflowError('Urutan pesan percakapan tidak valid.', 400);
    }
    totalLength += item.content.length;
    if (totalLength > 24000) throw new WorkflowError('Konteks percakapan terlalu panjang.', 400);
    messages.push({ role: item.role, content: item.content.trim() });
  }
  if (messages[messages.length - 1]?.role !== 'user') {
    throw new WorkflowError('Pesan terakhir harus berasal dari pemilik.', 400);
  }
  res.set('Cache-Control', 'no-store');
  res.json(await generateOfficeAssistantReply(messages));
}));

router.get('/tickets', asyncRoute(async (_req, res) => {
  const tickets = await prisma.officeTicket.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ tickets: tickets.map(ticketFromDb) });
}));

router.post('/tickets', asyncRoute(async (req, res) => {
  const division = text(req.body?.division, 'Divisi', 20);
  const category = text(req.body?.category, 'Kategori', 20);
  if (!['paud', 'posyandu'].includes(division) || !['BUG', 'QUESTION', 'COMPLAINT'].includes(category)) {
    throw new WorkflowError('Divisi atau kategori tidak valid.');
  }
  const ticket = await prisma.officeTicket.create({
    data: { division, category, title: text(req.body?.title, 'Judul', 200), description: text(req.body?.description, 'Laporan') },
  });
  res.status(201).json({ ticket: ticketFromDb(ticket) });
}));

router.patch('/tickets/:id', asyncRoute(async (req, res) => {
  const status = text(req.body?.status, 'Status', 30);
  if (!['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'].includes(status)) throw new WorkflowError('Status tidak valid.');
  const notes = req.body?.notes;
  if (typeof notes !== 'string' || notes.length > 8000) throw new WorkflowError('Catatan tidak valid.');
  const existing = await prisma.officeTicket.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new WorkflowError('Tiket tidak ditemukan.', 404);
  const ticket = await prisma.officeTicket.update({ where: { id: existing.id }, data: { status, notes } });
  res.json({ ticket: ticketFromDb(ticket) });
}));

router.post('/tickets/:id/drafts', asyncRoute(async (req, res) => {
  const ticket = await prisma.officeTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw new WorkflowError('Tiket tidak ditemukan.', 404);
  const draft = await createTicketDraft(ticketFromDb(ticket));
  res.status(201).json({ draft });
}));

router.get('/drafts', asyncRoute(async (_req, res) => {
  const drafts = await prisma.officeDraft.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ drafts: drafts.map((draft) => parseDraft(draft.data)) });
}));

router.get('/drafts/:id/creator-followup', asyncRoute(async (req, res) => {
  const record = await prisma.officeDraft.findUnique({ where: { id: req.params.id } });
  if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
  const draft = parseDraft(record.data);
  const [sourceJob, existingJob] = await Promise.all([
    prisma.officeJob.findFirst({
      where: { draftId: draft.id, division: draft.division, ticketId: null },
      select: { instruction: true, status: true },
    }),
    prisma.officeJob.findUnique({
      where: { id: creatorFollowupJobId(draft.id) },
      select: { status: true },
    }),
  ]);
  const eligible = draft.status === 'APPROVED' && draft.ticketId === null &&
    (draft.division === 'paud' || draft.division === 'posyandu') &&
    sourceJob?.status === 'DONE' && mandateRequestsContent(sourceJob.instruction) && !existingJob;
  res.set('Cache-Control', 'no-store');
  res.json({ eligible, status: existingJob?.status ?? null });
}));

router.get('/drafts/:id/mandate-content-followup', asyncRoute(async (req, res) => {
  const record = await prisma.officeDraft.findUnique({ where: { id: req.params.id } });
  if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
  const draft = parseDraft(record.data);
  const [sourceJob, existing] = await Promise.all([
    prisma.officeJob.findFirst({
      where: { draftId: draft.id, division: 'engineer', staffId: 'market_research', ticketId: null, status: 'DONE' },
      select: { instruction: true },
    }),
    prisma.contentFlow.findUnique({ where: { sourceDraftId: draft.id }, select: { id: true } }),
  ]);
  const eligible = draft.status === 'APPROVED' && draft.ticketId === null && draft.division === 'engineer' &&
    Boolean(sourceJob && mandateRequestsContent(sourceJob.instruction));
  res.set('Cache-Control', 'no-store');
  res.json({ eligible: Boolean(eligible && !existing), forwarded: Boolean(existing), flowId: existing?.id ?? null });
}));

router.get('/drafts/:id/marketing-content-followup', asyncRoute(async (req, res) => {
  const record = await prisma.officeDraft.findUnique({ where: { id: req.params.id } });
  if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
  const draft = parseDraft(record.data);
  const [sourceJob, existing] = await Promise.all([
    prisma.officeJob.findFirst({
      where: { draftId: draft.id, division: 'marketing', staffId: 'marketing_manager', ticketId: null, status: 'DONE' },
      select: { id: true },
    }),
    prisma.contentFlow.findUnique({ where: { sourceDraftId: draft.id }, select: { id: true } }),
  ]);
  const eligible = draft.status === 'APPROVED' && draft.ticketId === null && draft.division === 'marketing';
  const stages = existing
    ? await prisma.officeJob.findMany({
      where: { contentFlowId: existing.id },
      select: { id: true, staffId: true, title: true, status: true, draftId: true, error: true },
      orderBy: { createdAt: 'asc' },
    })
    : [];
  res.set('Cache-Control', 'no-store');
  res.json({
    eligible: Boolean(eligible && !existing),
    forwarded: Boolean(existing),
    flowId: existing?.id ?? null,
    sourceBriefLinked: Boolean(sourceJob),
    stages,
  });
}));

router.post('/drafts/:id/marketing-content-followup', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.officeDraft.findUnique({ where: { id: req.params.id } });
    if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
    const draft = parseDraft(record.data);
    if (draft.status !== 'APPROVED' || draft.ticketId !== null || draft.division !== 'marketing') {
      throw new WorkflowError('Hanya laporan Manajer Pemasaran yang sudah disetujui dapat diteruskan.', 409);
    }
    const followup = await marketingManagerContentFlow(tx, draft);
    if (!followup.eligible) throw new WorkflowError('Laporan Manajer Pemasaran tidak dapat diteruskan.', 409);
    if (!followup.id) throw new WorkflowError('Tahap lanjutan gagal dibuat. Muat ulang dan coba lagi.', 500);
    return { id: followup.id, created: followup.created };
  });
  if (result.created) wakeJobWorker();
  res.status(202).json(result);
}));

router.post('/drafts/:id/mandate-content-followup', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.officeDraft.findUnique({ where: { id: req.params.id } });
    if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
    const draft = parseDraft(record.data);
    if (draft.status !== 'APPROVED' || draft.ticketId !== null || draft.division !== 'engineer') {
      throw new WorkflowError('Hanya mandat Riset Produk Engineer yang sudah disetujui dapat diteruskan.', 409);
    }
    const followup = await engineerMandateContentFlow(tx, draft);
    if (!followup.eligible) throw new WorkflowError('Mandat ini tidak meminta materi konten untuk diteruskan ke Trendy.', 409);
    if (!followup.id) throw new WorkflowError('Tahap lanjutan gagal dibuat. Muat ulang dan coba lagi.', 500);
    return { id: followup.id, created: followup.created };
  });
  if (result.created) wakeJobWorker();
  res.status(202).json(result);
}));

router.post('/drafts/:id/digital-product-ideas', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  const conceptTitle = text(req.body?.conceptTitle, 'Judul ide produk', 200);
  const concept = text(req.body?.concept, 'Ide produk yang dipilih', 6000);
  if (concept.length < 30) throw new WorkflowError('Pilih satu ide lengkap dari laporan riset.', 400);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.officeDraft.findUnique({ where: { id: req.params.id } });
    if (!record) throw new WorkflowError('Laporan riset tidak ditemukan.', 404);
    const draft = parseDraft(record.data);
    if (!isDigitalProductResearchDraftId(draft.id) || draft.status !== 'APPROVED' || draft.division !== 'creator') {
      throw new WorkflowError('Setujui laporan riset produk digital sebelum memilih ide.', 409);
    }
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    if (!normalize(draft.content).includes(normalize(concept))) {
      throw new WorkflowError('Ide harus disalin dari laporan riset yang disetujui.', 400);
    }
    const key = digitalProductIdeaKey(conceptTitle, concept);
    const job = digitalProductFollowupJob(draft.id, conceptTitle, draft.content, concept, key);
    const existing = await tx.officeJob.findUnique({ where: { id: job.id }, select: { id: true, status: true } });
    if (existing) return { id: existing.id, status: existing.status, created: false };
    const locked = await tx.officeDraft.updateMany({
      where: { id: draft.id, updatedAt: record.updatedAt },
      data: { data: record.data as Prisma.InputJsonValue },
    });
    if (!locked.count) throw new WorkflowError('Laporan berubah. Muat ulang sebelum memilih ide.', 409);
    await tx.officeJob.create({ data: job });
    return { id: job.id, status: 'QUEUED', created: true };
  });
  if (result.created) wakeJobWorker();
  res.status(result.created ? 202 : 200).json(result);
}));

router.post('/drafts/:id/creator-followup', asyncRoute(async (req, res) => {
  const verifiedFacts = text(req.body?.verifiedFacts, 'Fitur yang sudah diverifikasi pemilik', 4000);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.officeDraft.findUnique({ where: { id: req.params.id } });
    if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
    const draft = parseDraft(record.data);
    if (draft.status !== 'APPROVED' || draft.ticketId !== null ||
        (draft.division !== 'paud' && draft.division !== 'posyandu')) {
      throw new WorkflowError('Hanya mandat PAUD/Posyandu yang sudah disetujui dapat diteruskan ke Creator.', 409);
    }

    const id = creatorFollowupJobId(draft.id);
    const existing = await tx.officeJob.findUnique({ where: { id }, select: { status: true } });
    if (existing) return { id, status: existing.status, created: false };

    const sourceJob = await tx.officeJob.findFirst({
      where: { draftId: draft.id, division: draft.division, ticketId: null, status: 'DONE' },
      select: { instruction: true },
    });
    if (!sourceJob || !mandateRequestsContent(sourceJob.instruction)) {
      throw new WorkflowError('Mandat ini tidak meminta materi konten untuk diteruskan.', 409);
    }

    const locked = await tx.officeDraft.updateMany({
      where: { id: draft.id, updatedAt: record.updatedAt },
      data: { data: record.data as Prisma.InputJsonValue },
    });
    if (!locked.count) throw new WorkflowError('Draf berubah. Muat ulang sebelum meneruskan.', 409);

    await tx.officeJob.create({ data: {
      id,
      division: 'creator',
      staffId: 'clipper',
      title: `Paket konten: ${draft.title}`,
      instruction: creatorFollowupInstruction(sourceJob.instruction, draft.content, verifiedFacts),
    } });
    return { id, status: 'QUEUED', created: true };
  });
  if (result.created) wakeJobWorker();
  res.status(result.created ? 202 : 200).json(result);
}));

router.delete('/drafts/:id', asyncRoute(async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.officeDraft.findUnique({ where: { id: req.params.id } });
    if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
    const draft = parseDraft(record.data);
    const rootJobs = await tx.officeJob.findMany({ where: { draftId: draft.id } });

    const jobIds = new Set(rootJobs.map((job) => job.id));
    const draftIds = new Set([draft.id]);
    const flowIds = new Set<string>();
    const sourceFlows = await tx.contentFlow.findMany({ where: { sourceDraftId: draft.id } });
    for (const flow of sourceFlows) flowIds.add(flow.id);
    for (const job of rootJobs) if (job.contentFlowId) flowIds.add(job.contentFlowId);

    let changed = true;
    while (changed) {
      const before = jobIds.size + draftIds.size + flowIds.size;
      const relatedJobConditions = [
        ...(flowIds.size ? [{ contentFlowId: { in: [...flowIds] } }] : []),
        ...[...jobIds].map((id) => ({ id: { startsWith: `${id}:` } })),
        ...[...draftIds].map((id) => ({ id: { startsWith: `${id}:` } })),
      ];
      const relatedJobs = relatedJobConditions.length
        ? await tx.officeJob.findMany({ where: { OR: relatedJobConditions } })
        : [];
      for (const job of relatedJobs) {
        jobIds.add(job.id);
        if (job.draftId) draftIds.add(job.draftId);
        if (job.contentFlowId) flowIds.add(job.contentFlowId);
      }
      const linkedFlows = await tx.contentFlow.findMany({
        where: { sourceDraftId: { in: [...draftIds] } },
      });
      for (const flow of linkedFlows) flowIds.add(flow.id);
      for (const job of rootJobs) if (job.draftId) draftIds.add(job.draftId);
      changed = before !== jobIds.size + draftIds.size + flowIds.size;
    }

    const relatedDrafts = await tx.officeDraft.findMany({ where: { id: { in: [...draftIds] } } });
    if (relatedDrafts.some((item) => item.ticketId !== null)) {
      throw new WorkflowError('Draf ini terhubung ke tiket. Tiket dan laporannya dipertahankan; hapus atau putuskan keterkaitan melalui alur tiket.', 409);
    }
    const relatedJobs = jobIds.size
      ? await tx.officeJob.findMany({ where: { id: { in: [...jobIds] } } })
      : [];
    if (relatedJobs.some((job) => job.ticketId !== null)) {
      throw new WorkflowError('Draf ini terhubung ke tiket. Tiket dan tugasnya dipertahankan.', 409);
    }
    if (relatedJobs.some((job) => job.status === 'QUEUED' || job.status === 'RUNNING')) {
      throw new WorkflowError('Draf ini memiliki tugas yang masih antre atau berjalan. Tunggu hingga selesai sebelum menghapus.', 409);
    }
    const video = await tx.videoJob.findFirst({ where: { draftId: { in: [...draftIds] } } });
    if (video) {
      throw new WorkflowError('Draf ini memiliki tugas/artefak video terkait. Hapus atau arsipkan video melalui alur publikasi terlebih dahulu.', 409);
    }

    if (jobIds.size) {
      const deletedJobs = await tx.officeJob.deleteMany({
        where: { id: { in: [...jobIds] }, status: { notIn: ['QUEUED', 'RUNNING'] } },
      });
      if (deletedJobs.count !== jobIds.size) {
        throw new WorkflowError('Status tugas berubah saat penghapusan. Muat ulang dan coba lagi.', 409);
      }
    }
    if (flowIds.size) {
      await tx.contentFlow.deleteMany({ where: { id: { in: [...flowIds] } } });
    }
    const deletedDrafts = await tx.officeDraft.deleteMany({ where: { id: { in: [...draftIds] } } });
    if (deletedDrafts.count !== draftIds.size) {
      throw new WorkflowError('Data draf berubah saat penghapusan. Muat ulang dan coba lagi.', 409);
    }
    return { deletedDrafts: deletedDrafts.count, deletedJobs: jobIds.size };
  });
  res.json(result);
}));

router.get('/videos', asyncRoute(async (req, res) => {
  const jobs = await prisma.videoJob.findMany({
    select: { id: true, draftId: true, status: true, error: true, prompt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const config = await getVideoRuntimeConfig();
  res.set('Cache-Control', 'no-store');
  res.json({
    enabled: config.enabled,
    approvedBudgetIdr: config.approvedBudgetIdr,
    adminConfigured: adminConfigured(),
    authenticated: isValidAdminSession(adminSessionFromCookie(req.get('cookie'))),
    jobs: jobs.map(({ prompt, ...job }) => ({
      ...job,
      title: extractVideoIdeas(prompt)[0]?.title ?? 'Video konten',
    })),
  });
}));

router.get('/admin/openrouter-budget', asyncRoute(async (req, res) => {
  requireAdmin(req);
  const budget = await getOpenRouterKeyBudget(AbortSignal.timeout(5000));
  res.set('Cache-Control', 'no-store');
  res.json(budget);
}));

router.get('/admin/video', asyncRoute(async (req, res) => {
  const config = await getVideoRuntimeConfig();
  res.set('Cache-Control', 'no-store');
  res.json({
    enabled: config.enabled,
    approvedBudgetIdr: config.approvedBudgetIdr,
    adminConfigured: adminConfigured(),
    authenticated: isValidAdminSession(adminSessionFromCookie(req.get('cookie'))),
  });
}));

router.post('/admin/login', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  if (!adminConfigured()) throw new WorkflowError('Atur OFFICE_ADMIN_PASSWORD minimal 8 karakter pada environment server.', 503);
  checkAdminLoginRateLimit(req);
  if (!verifyAdminPassword(req.body?.password)) {
    recordFailedAdminLogin(req);
    throw new WorkflowError('Password admin tidak cocok.', 401);
  }
  failedAdminLogins.delete(req.ip || 'unknown');
  res.setHeader('Set-Cookie', adminCookie(createAdminSession(), process.env.NODE_ENV === 'production'));
  res.set('Cache-Control', 'no-store');
  res.json({ authenticated: true });
}));

router.post('/admin/logout', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  requireAdmin(req);
  res.setHeader('Set-Cookie', clearAdminCookie(process.env.NODE_ENV === 'production'));
  res.set('Cache-Control', 'no-store');
  res.json({ authenticated: false });
}));

router.patch('/admin/video', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  requireAdmin(req);
  if (typeof req.body?.enabled !== 'boolean') throw new WorkflowError('Status saklar video tidak valid.');
  const config = await setVideoEnabled(req.body.enabled);
  if (config.enabled) wakeVideoWorker();
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: config.enabled, approvedBudgetIdr: config.approvedBudgetIdr });
}));

router.post('/videos/:id/acknowledge-unknown', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  requireAdmin(req);
  if (req.body?.checked !== true) throw new WorkflowError('Konfirmasi pemeriksaan status OpenRouter wajib diisi.');
  const job = await prisma.videoJob.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, activeDraftId: true, error: true },
  });
  if (!job) throw new WorkflowError('Percobaan video tidak ditemukan.', 404);
  if (job.status !== 'UNKNOWN' || !job.activeDraftId) {
    throw new WorkflowError('Percobaan ini bukan lagi berstatus tidak diketahui atau kuncinya sudah dilepas.', 409);
  }
  const result = await prisma.videoJob.updateMany({
    where: { id: job.id, status: 'UNKNOWN', activeDraftId: job.activeDraftId },
    data: {
      status: 'FAILED',
      activeDraftId: null,
      error: [
        job.error,
        'Admin telah memeriksa status dan tagihan OpenRouter lalu melepas kunci percobaan. Permintaan yang mungkin masih berjalan di provider tidak dibatalkan.',
      ].filter(Boolean).join('\n'),
    },
  });
  if (!result.count) throw new WorkflowError('Status percobaan berubah. Muat ulang sebelum mencoba lagi.', 409);
  res.set('Cache-Control', 'no-store');
  res.json({ released: true });
}));

router.post('/videos/:draftId', asyncRoute(async (req, res) => {
  requireSameOrigin(req);
  requireAdmin(req);
  if (!await videoEnabled()) throw new WorkflowError('Pembuatan video AI nonaktif. Aktifkan saklar video melalui login admin setelah memeriksa anggaran.', 409);
  try {
    const job = await prisma.$transaction(async (tx) => {
      const record = await tx.officeDraft.findUnique({ where: { id: req.params.draftId } });
      if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
      const draft = parseDraft(record.data);
      if (draft.status !== 'APPROVED' || draft.contentPackageVersion !== 1) throw new WorkflowError('Hanya paket konten baru yang sudah disetujui dapat dibuat menjadi video.', 409);
      const ideas = extractVideoIdeas(draft.content, draft.title);
      const ideaKey = req.body?.ideaKey;
      if (typeof ideaKey !== 'string' || !ideaKey) {
        if (ideas.length > 1) throw new WorkflowError('Pilih ide video yang ingin dibuat terlebih dahulu.', 400);
      } else if (!ideas.some((idea) => idea.key === ideaKey)) {
        throw new WorkflowError('Pilihan ide video tidak ditemukan dalam paket yang disetujui.', 400);
      }
      const selectedIdea = ideas.find((idea) => idea.key === ideaKey) ?? ideas[0];
      if (!selectedIdea) throw new WorkflowError('Paket konten tidak memiliki ide video yang dapat dipilih.', 400);
      const locked = await tx.officeDraft.updateMany({ where: { id: record.id, updatedAt: record.updatedAt }, data: { data: record.data as Prisma.InputJsonValue } });
      if (!locked.count) throw new WorkflowError('Draf berubah. Muat ulang dan coba lagi.', 409);
      const active = await tx.videoJob.findUnique({ where: { activeDraftId: draft.id }, select: { id: true } });
      if (active) throw new WorkflowError('Video untuk draf ini masih antre, sedang dibuat, atau hasil tagihannya belum pasti. Tunggu atau periksa OpenRouter sebelum mencoba ulang.', 409);
      return tx.videoJob.create({ data: { draftId: draft.id, activeDraftId: draft.id, prompt: selectedIdea.content }, select: { id: true } });
    });
    wakeVideoWorker();
    res.status(202).json({ id: job.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new WorkflowError('Video untuk draf ini baru saja dimasukkan ke antrean. Periksa statusnya sebelum mencoba lagi.', 409);
    throw error;
  }
}));

router.get('/videos/:id/file', asyncRoute(async (req, res) => {
  const job = await prisma.videoJob.findUnique({ where: { id: req.params.id } });
  if (!job || job.status !== 'READY') throw new WorkflowError('Video belum tersedia.', 404);
  res.set('Cache-Control', 'no-store');
  res.type('video/mp4');
  res.sendFile(videoPath(job.id), (error) => {
    if (error && !res.headersSent) res.status(500).json({ error: 'File video tidak ditemukan atau tidak dapat dibaca di server.' });
    if (error) console.error('[Video] File tidak dapat dibaca:', error.message);
  });
}));

router.post('/drafts/content', asyncRoute(async (req, res) => {
  const topic = text(req.body?.topic, 'Topik', 500);
  const draft = await createContentDraft(topic);
  res.status(201).json({ draft });
}));

router.post('/drafts/mandate', asyncRoute(async (req, res) => {
  const division = text(req.body?.division, 'Divisi', 20);
  if (!isOfficeDivision(division)) {
    throw new WorkflowError('Divisi tidak valid.');
  }
  const instruction = text(req.body?.instruction, 'Mandat', 8000);
  const draft = await createDraft({
    division,
    title: `Mandat ${division.toUpperCase()}: ${instruction.slice(0, 80)}`,
    instruction: `Mandat pimpinan untuk divisi ${division}:\n${instruction}\nSiapkan laporan terlebih dahulu dan jangan melakukan tindakan eksternal.${division === 'cyber' ? '\nFokus: Sentinel menyusun usulan pemantauan, Guard-AI merekomendasikan perlindungan data dan mitigasi risiko, Audit menyusun rencana peninjauan log. Anda belum memiliki akses ke log atau sistem, dan belum melakukan pemindaian, audit, atau pemantauan. Pisahkan dugaan dan rencana dari temuan yang benar-benar diberikan.' : ''}`,
  });
  res.status(201).json({ draft });
}));

router.get('/drafts/:id/events', asyncRoute(async (req, res) => {
  const events = await prisma.officeDraftEvent.findMany({
    where: { draftId: req.params.id }, orderBy: { createdAt: 'desc' },
  });
  res.json({ events: events.map((event) => ({ ...event, data: parseDraft(event.data) })) });
}));

router.patch('/drafts/:id', asyncRoute(async (req, res) => {
  const action = text(req.body?.action, 'Aksi', 20);
  if (!['EDIT', 'APPROVE', 'REVISE'].includes(action)) throw new WorkflowError('Aksi draf tidak valid.');
  const record = await prisma.officeDraft.findUnique({ where: { id: req.params.id } });
  if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
  const previous = parseDraft(record.data);
  if (previous.grounding && action !== 'APPROVE') throw new WorkflowError('Laporan riset bersumber tidak dapat diedit atau direvisi. Buat riset baru.', 409);
  if (previous.status === 'INTERMEDIATE') throw new WorkflowError('Tahap ini sudah diteruskan otomatis. Periksa dan setujui hasil akhir Clipper.', 409);
  if (previous.contentPackageVersion === 1 && action !== 'APPROVE' && await prisma.videoJob.findFirst({ where: { draftId: previous.id } })) {
    throw new WorkflowError('Paket sudah memiliki tugas video dan tidak dapat diubah. Buat paket baru untuk perubahan.', 409);
  }
  if (action === 'APPROVE' && previous.status !== 'PENDING') throw new WorkflowError('Draf tidak menunggu persetujuan.', 409);
  const update = async (notes: string) => {
    let content = previous.content;
    let ai = previous.ai;
    if (action === 'EDIT') content = text(req.body?.content, 'Isi draf', 120000);
    if (action === 'REVISE') {
      const isDigitalProduct = previous.productPackageVersion === 1;
      const revisePrompt = isDigitalProduct
        ? `Revisi paket produk digital berikut sesuai arahan pemilik. Pertahankan isi produk yang utuh, lengkap, dan siap dijual untuk pembeli di Lynk.id tanpa catatan internal.\nArahan: ${notes}\nPaket produk sebelumnya:\n${content}\n\n${digitalProductPackageInstruction}`
        : `Revisi laporan berikut sesuai arahan pimpinan. Jangan mengarang fakta.\nArahan: ${notes}\nLaporan sebelumnya:\n${content}${previous.contentPackageVersion === 1 ? `\n\n${contentPackageInstruction}` : ''}`;
      const result = await generateReportWithDetails(
        revisePrompt,
        previous.division,
        AbortSignal.timeout(isDigitalProduct ? 180_000 : 90_000),
        isDigitalProduct ? 'digital' : undefined,
        isDigitalProduct ? Math.max(defaultMaxTokens(), 8192) : undefined,
        isDigitalProduct ? digitalProductSystemInstruction : undefined,
      );
      content = result.content;
      ai = result.ai;
    }
    if (previous.contentPackageVersion === 1) {
      const problems = contentPackageProblems(content);
      if (problems.length) throw new WorkflowError(`Paket konten belum lengkap: ${problems.join(', ')}.`, action === 'REVISE' ? 502 : 400);
    }
    const draft: WorkDraft = {
      ...previous, content, ...(ai ? { ai } : {}), status: action === 'APPROVE' ? 'APPROVED' : 'PENDING', updatedAt: new Date().toISOString(),
    };
    const snapshot: Prisma.InputJsonObject = { ...draft };
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.officeDraft.updateMany({
        where: { id: draft.id, updatedAt: record.updatedAt }, data: { data: snapshot },
      });
      if (updated.count !== 1) throw new WorkflowError('Draf berubah di sesi lain. Muat ulang sebelum mencoba lagi.', 409);
      await transaction.officeDraftEvent.create({ data: { draftId: draft.id, action, notes, data: snapshot } });
      if (action === 'APPROVE' && draft.division === 'engineer' && draft.ticketId === null) {
        await engineerMandateContentFlow(transaction, draft);
      }
      if (action === 'APPROVE' && draft.division === 'marketing' && draft.ticketId === null) {
        await marketingManagerContentFlow(transaction, draft);
      }
      if (action === 'APPROVE' && draft.productPackageVersion === 1) {
        await createContentFlow(
          transaction,
          `Promosi produk digital · ${draft.title}`,
          `Siapkan materi promosi untuk produk digital yang disetujui. Gunakan hanya isi produk yang diberikan; jangan mengarang validasi pasar, hasil belajar, harga pasar, atau testimoni. Jangan menyuruh audiens membeli, memesan lewat DM, atau membuka link di bio kecuali tautan/cara pemesanan resmi diberikan di isi produk. Jika belum ada, gunakan ajakan non-transaksional dan tandai cara pemesanan sebagai [PERLU KONFIRMASI]. Buat paket promosi yang bisa ditinjau pimpinan, tanpa publikasi atau upload otomatis.\n\nIsi produk:\n${draft.content.slice(0, 4000)}`,
          undefined,
          draft.id,
        );
      }
    });
    return draft;
  };
  const draft = action === 'REVISE'
    ? await trackActivity(previous.division, 'REVISE', () => update(text(req.body?.notes, 'Catatan revisi', 4000)))
    : await update('');
  if (action === 'APPROVE') wakeJobWorker();
  res.json({ draft });
}));

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Workflow API]', err);
  if (err instanceof WorkflowError) {
    res.status(err.status).json({ error: err.message });
  } else {
    res.status(500).json({ error: 'Penyimpanan gagal. Periksa DATABASE_URL, migrasi, dan log server.' });
  }
});

export default router;
