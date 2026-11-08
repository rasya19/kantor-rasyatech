import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { listJobs } from '../services/jobService';
import { WorkflowError } from '../services/workflowService';
import { getStaff, ticketStaff } from '../../src/staff';
import { isOfficeDivision } from '../../src/workflowTypes';
import type { TicketCategory, TicketDivision } from '../../src/workflowTypes';
import { createContentFlow, forwardContentStage } from '../services/contentFlow';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

const router = Router();
const route = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

function required(value: unknown, name: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new WorkflowError(`${name} wajib diisi (maksimal ${limit} karakter).`);
  return value.trim();
}

router.get('/jobs', route(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ jobs: await listJobs() });
}));

router.post('/jobs', route(async (req, res) => {
  const division = required(req.body?.division, 'Divisi', 20);
  const staffId = required(req.body?.staffId, 'Staf', 40);
  const staff = getStaff(staffId);
  if (!isOfficeDivision(division) || !staff || staff.division !== division) throw new WorkflowError('Staf tidak sesuai dengan divisi.');
  const instruction = required(req.body?.instruction, 'Instruksi', 8000);
  if (division === 'creator' && staffId === 'trendy') {
    const id = randomUUID();
    await prisma.$transaction((tx) => createContentFlow(tx, `Ide Trendy: ${instruction.slice(0, 80)}`, instruction, id));
    res.status(202).json({ id });
  } else {
    const job = await prisma.officeJob.create({
      data: { division, staffId, title: `Mandat ${staff.name}: ${instruction.slice(0, 80)}`, instruction },
      select: { id: true },
    });
    res.status(202).json({ id: job.id });
  }
}));

router.get('/content-flow/from-draft/:id', route(async (req, res) => {
  const record = await prisma.officeDraft.findUnique({ where: { id: req.params.id } });
  const original = await prisma.officeJob.findFirst({ where: { draftId: req.params.id, staffId: 'trendy', division: 'creator', status: 'DONE', contentFlowId: null } });
  const existing = await prisma.contentFlow.findUnique({ where: { sourceDraftId: req.params.id } });
  const data = record?.data;
  const eligible = Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.division === 'creator' && data.status === 'APPROVED' && original && !existing);
  res.set('Cache-Control', 'no-store');
  res.json({ eligible, forwarded: Boolean(existing) });
}));

router.post('/content-flow/from-draft/:id', route(async (req, res) => {
  const id = req.params.id;
  let flow;
  try {
  flow = await prisma.$transaction(async (tx) => {
    const record = await tx.officeDraft.findUnique({ where: { id } });
    if (!record || !record.data || typeof record.data !== 'object' || Array.isArray(record.data) ||
        record.data.division !== 'creator' || record.data.status !== 'APPROVED' || typeof record.data.content !== 'string') {
      throw new WorkflowError('Pilih laporan konten Trendy yang sudah disetujui.', 409);
    }
    const original = await tx.officeJob.findFirst({ where: { draftId: id, staffId: 'trendy', division: 'creator', status: 'DONE' } });
    if (!original || original.contentFlowId) throw new WorkflowError('Hanya laporan Trendy lama yang belum menjadi bagian alur otomatis dapat diteruskan.', 409);
    if (await tx.contentFlow.findUnique({ where: { sourceDraftId: id } })) throw new WorkflowError('Laporan ini sudah diteruskan ke Script-AI.', 409);
    const locked = await tx.officeDraft.updateMany({ where: { id, updatedAt: record.updatedAt }, data: { data: record.data as Prisma.InputJsonValue } });
    if (locked.count !== 1) throw new WorkflowError('Laporan berubah. Muat ulang dan coba lagi.', 409);
    const flowId = randomUUID();
    await tx.contentFlow.create({ data: { id: flowId, sourceDraftId: id } });
    await forwardContentStage(tx, flowId, 'trendy', record.data.content);
    return flowId;
  });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new WorkflowError('Laporan ini sudah diteruskan ke Script-AI.', 409);
    throw error;
  }
  res.status(202).json({ id: flow });
}));

router.post('/tickets', route(async (req, res) => {
  const division = required(req.body?.division, 'Divisi', 20);
  const category = required(req.body?.category, 'Kategori', 20);
  if ((division !== 'paud' && division !== 'posyandu') ||
      (category !== 'BUG' && category !== 'QUESTION' && category !== 'COMPLAINT')) throw new WorkflowError('Divisi atau kategori tidak valid.');
  const title = required(req.body?.title, 'Judul', 200);
  const description = required(req.body?.description, 'Laporan', 8000);
  const staffId = ticketStaff(division as TicketDivision, category as TicketCategory);
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.officeTicket.create({ data: { division, category, title, description } });
    await tx.officeJob.create({ data: {
      division, staffId, ticketId: created.id, title: `Laporan ${division.toUpperCase()}: ${title}`,
      instruction: `Buat laporan untuk pimpinan berdasarkan tiket berikut. Jangan menganggap bug sudah terverifikasi atau mengarang fakta.\nProduk: ${division}\nKategori: ${category}\nJudul: ${title}\nLaporan klien: ${description}`,
    } });
    return created;
  });
  res.status(201).json({ ticket });
}));

router.post('/tickets/:id/jobs', route(async (req, res) => {
  const ticket = await prisma.officeTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) throw new WorkflowError('Tiket tidak ditemukan.', 404);
  if ((ticket.division !== 'paud' && ticket.division !== 'posyandu') ||
      (ticket.category !== 'BUG' && ticket.category !== 'QUESTION' && ticket.category !== 'COMPLAINT')) {
    throw new WorkflowError('Divisi atau kategori tiket tidak valid.');
  }
  const job = await prisma.officeJob.create({ data: {
    division: ticket.division, staffId: ticketStaff(ticket.division, ticket.category), ticketId: ticket.id,
    title: `Laporan ${ticket.division.toUpperCase()}: ${ticket.title}`,
    instruction: `Buat laporan untuk pimpinan berdasarkan tiket berikut. Jangan menganggap bug sudah terverifikasi atau mengarang fakta.\nProduk: ${ticket.division}\nKategori: ${ticket.category}\nJudul: ${ticket.title}\nLaporan klien: ${ticket.description}\nCatatan admin: ${ticket.notes}`,
  }, select: { id: true } });
  res.status(202).json({ id: job.id });
}));

router.post('/jobs/:id/retry', route(async (req, res) => {
  const result = await prisma.officeJob.updateMany({
    where: { id: req.params.id, status: 'FAILED' },
    data: { status: 'QUEUED', error: null, claimToken: null, leaseUntil: null },
  });
  if (!result.count) throw new WorkflowError('Tugas tidak ditemukan atau tidak dalam keadaan gagal.', 409);
  res.json({ success: true });
}));

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Antrean API]', error);
  if (error instanceof WorkflowError) res.status(error.status).json({ error: error.message });
  else res.status(500).json({ error: 'Antrean gagal diakses. Periksa database dan migrasi.' });
});
export default router;
