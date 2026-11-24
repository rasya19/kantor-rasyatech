import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './server/lib/prisma.js';
import { createApiApp } from './server/app.js';
import { startJobWorker } from './server/services/jobService.js';
import { pauseQueuedOpportunityTasks, startOpportunityScheduler } from './server/services/opportunityFlow.js';
import { startVideoWorker } from './server/services/videoService.js';
import { startDailyDigitalProductScheduler } from './server/services/businessResearch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createApiApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Production / Dev Vite Server Mounting
async function bootstrapServer() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL belum diatur.');
  }
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[Database] Pemeriksaan koneksi gagal (${errorName}). Periksa DATABASE_URL, jaringan, SSL, dan status migrasi.`);
    throw new Error('Database readiness check gagal.');
  }

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Mount Vite middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const pausedSprintTasks = await pauseQueuedOpportunityTasks();
  if (pausedSprintTasks) console.log(`[Antrean kantor] ${pausedSprintTasks} tugas sprint ditahan; pilih tugas satu per satu dari Peluang & Keuangan.`);
  startDailyDigitalProductScheduler();
  startOpportunityScheduler();
  startJobWorker();
  startVideoWorker();
  app.listen(PORT, HOST, () => {
    console.log(`[Kantor AI Server] Berjalan pada http://${HOST}:${PORT}`);
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
      console.warn('[Kantor AI Server] Server tidak memiliki autentikasi; jangan buka akses jaringan tanpa proteksi tambahan.');
    }
  });
}

bootstrapServer().catch((err) => {
  console.error('[Kantor AI Server] Startup dibatalkan:', err instanceof Error ? err.message : 'Kesalahan tidak dikenal.');
  process.exit(1);
});
