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
const PORT = process.env.NODE_ENV === 'production'
  ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)
  : 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Production / Dev Vite Server Mounting
async function bootstrapServer() {
  let dbReady = false;
  if (!process.env.DATABASE_URL?.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL belum diatur.');
    }
    console.warn('[Database] DATABASE_URL belum diatur. Server dev tetap berjalan tanpa worker database.');
  } else {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error(`[Database] Pemeriksaan koneksi gagal (${errorName}). Periksa DATABASE_URL, jaringan, SSL, dan status migrasi.`);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Database readiness check gagal.');
      }
      console.warn('[Database] Server dev tetap berjalan tanpa worker database.');
    }
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

  if (dbReady) {
    const pausedSprintTasks = await pauseQueuedOpportunityTasks();
    if (pausedSprintTasks) console.log(`[Antrean kantor] ${pausedSprintTasks} tugas sprint ditahan; pilih tugas satu per satu dari Peluang & Keuangan.`);
    startDailyDigitalProductScheduler();
    startOpportunityScheduler();
    startJobWorker();
    startVideoWorker();
  }
  app.listen(PORT, HOST, () => {
    console.log(`[Kantor AI Server] Berjalan pada http://${HOST}:${PORT}`);
  });
}

bootstrapServer().catch((err) => {
  console.error('[Kantor AI Server] Startup dibatalkan:', err instanceof Error ? err.message : 'Kesalahan tidak dikenal.');
  process.exit(1);
});
