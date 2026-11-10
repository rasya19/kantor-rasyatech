import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { researchProduct } from '../services/businessResearch';
import { WorkflowError } from '../services/workflowService';

const router = Router();
const route = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

router.get('/schedule', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ enabled: process.env.OPPORTUNITY_SCHEDULE_ENABLED !== 'false' });
});

router.post('/research', route(async (req, res) => {
  if (req.body?.product !== 'paud' && req.body?.product !== 'posyandu' && req.body?.product !== 'opportunities') throw new WorkflowError('Produk tidak valid.');
  res.status(201).json({ draft: await researchProduct(req.body.product) });
}));

router.get('/transactions', route(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const transactions = await prisma.financeTransaction.findMany({ orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
  res.json({ transactions });
}));

router.post('/transactions', route(async (req, res) => {
  const { product, kind, amount, date, note } = req.body || {};
  if (!['paud', 'posyandu', 'other'].includes(product) || !['INCOME', 'EXPENSE'].includes(kind)) throw new WorkflowError('Produk atau jenis transaksi tidak valid.');
  if (!Number.isInteger(amount) || amount <= 0 || amount > 2147483647) throw new WorkflowError('Nominal harus berupa rupiah bulat antara 1 dan 2.147.483.647.');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new WorkflowError('Tanggal tidak valid.');
  if (typeof note !== 'string' || note.length > 200) throw new WorkflowError('Catatan maksimal 200 karakter.');
  const transaction = await prisma.financeTransaction.create({ data: { product, kind, amount, date, note: note.trim() } });
  res.status(201).json({ transaction });
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
