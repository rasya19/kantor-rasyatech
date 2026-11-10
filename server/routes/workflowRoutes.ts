import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createContentDraft, createDraft, createTicketDraft, generateReportWithDetails, WorkflowError } from '../services/workflowService';
import { getActivitySnapshot, trackActivity } from '../services/activityService';
import { contentPackageInstruction, contentPackageProblems } from '../services/contentPackage';
import { videoEnabled, videoPath } from '../services/videoService';
import type { Ticket, TicketCategory, TicketDivision, TicketStatus, WorkDraft } from '../../src/workflowTypes';
import { isOfficeDivision } from '../../src/workflowTypes';

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
    ...(value.contentPackageVersion === 1 ? { contentPackageVersion: 1 } : {}), ...(grounding ? { grounding } : {}),
    ...(typeof value.sourceDraftId === 'string' ? { sourceDraftId: value.sourceDraftId } : {}),
  };
}

router.get('/activity', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getActivitySnapshot());
});

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

router.get('/videos', asyncRoute(async (_req, res) => {
  const jobs = await prisma.videoJob.findMany({
    select: { id: true, draftId: true, status: true, error: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: videoEnabled(), jobs });
}));

router.post('/videos/:draftId', asyncRoute(async (req, res) => {
  if (!videoEnabled()) throw new WorkflowError('Pembuatan video dinonaktifkan selama migrasi ke OpenRouter; tidak ada video yang dikirim.', 409);
  try {
    const job = await prisma.$transaction(async (tx) => {
      const record = await tx.officeDraft.findUnique({ where: { id: req.params.draftId } });
      if (!record) throw new WorkflowError('Draf tidak ditemukan.', 404);
      const draft = parseDraft(record.data);
      if (draft.status !== 'APPROVED' || draft.contentPackageVersion !== 1) throw new WorkflowError('Hanya paket konten baru yang sudah disetujui dapat dibuat menjadi video.', 409);
      const locked = await tx.officeDraft.updateMany({ where: { id: record.id, updatedAt: record.updatedAt }, data: { data: record.data as Prisma.InputJsonValue } });
      if (!locked.count) throw new WorkflowError('Draf berubah. Muat ulang dan coba lagi.', 409);
      return tx.videoJob.create({ data: { draftId: draft.id, prompt: draft.content }, select: { id: true } });
    });
    res.status(202).json({ id: job.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new WorkflowError('Paket ini sudah memiliki tugas video. Periksa statusnya di Siap Publikasi.', 409);
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
  if (previous.contentPackageVersion === 1 && action !== 'APPROVE' && await prisma.videoJob.findUnique({ where: { draftId: previous.id } })) {
    throw new WorkflowError('Paket sudah memiliki tugas video dan tidak dapat diubah. Buat paket baru untuk perubahan.', 409);
  }
  if (action === 'APPROVE' && previous.status !== 'PENDING') throw new WorkflowError('Draf tidak menunggu persetujuan.', 409);
  const update = async (notes: string) => {
    let content = previous.content;
    let ai = previous.ai;
    if (action === 'EDIT') content = text(req.body?.content, 'Isi draf', 30000);
    if (action === 'REVISE') {
      const result = await generateReportWithDetails(`Revisi laporan berikut sesuai arahan pimpinan. Jangan mengarang fakta.\nArahan: ${notes}\nLaporan sebelumnya:\n${content}${previous.contentPackageVersion === 1 ? `\n\n${contentPackageInstruction}` : ''}`, previous.division, AbortSignal.timeout(90000));
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
      if (action === 'APPROVE' && draft.contentPackageVersion === 1 && !draft.sourceDraftId && videoEnabled()) {
        await transaction.videoJob.create({ data: { draftId: draft.id, prompt: draft.content } });
      }
    });
    return draft;
  };
  const draft = action === 'REVISE'
    ? await trackActivity(previous.division, 'REVISE', () => update(text(req.body?.notes, 'Catatan revisi', 4000)))
    : await update('');
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
