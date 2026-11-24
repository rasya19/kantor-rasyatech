import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateWarungLicense } from '../../src/lib/warungLicense';
import { recordWarungLicense } from '../services/warungLicenseService';

const router = Router();
const route = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void handler(req, res).catch(next); };

router.get('/', route(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const warungs = await prisma.warung.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, createdAt: true,
      licenses: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, deviceId: true, year: true, code: true, createdAt: true },
      },
    },
  });
  res.json({ warungs });
}));

router.post('/licenses', route(async (req, res) => {
  let input;
  try {
    input = validateWarungLicense(req.body ?? {});
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    res.status(400).json({ error: error.message });
    return;
  }

  const result = await prisma.$transaction((tx) => recordWarungLicense(tx, input));
  res.status(201).json(result);
}));

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Warung] Gagal memproses data lisensi:', error instanceof Error ? error.message : 'Kesalahan tidak dikenal.');
  res.status(500).json({ error: 'Data warung tidak dapat diproses. Periksa koneksi database dan migrasi, lalu coba lagi.' });
});

export default router;
