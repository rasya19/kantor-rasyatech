import express, { type Request, type Response } from 'express';
import { prisma } from './lib/prisma.js';
import workflowRoutes from './routes/workflowRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import warungRoutes from './routes/warungRoutes.js';

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  app.use('/api/workflow', workflowRoutes);
  app.use('/api/office-work', jobRoutes);
  app.use('/api/business', businessRoutes);
  app.use('/api/warung', warungRoutes);

  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected', service: 'Kantor AI PT Rasyatech Digital Zenith', time: new Date().toISOString() });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error(`[Database] Pemeriksaan health gagal (${errorName}).`);
      res.status(503).json({ status: 'unavailable', database: 'unavailable', service: 'Kantor AI PT Rasyatech Digital Zenith' });
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('[API Server] Unhandled error:', err);
    if (res.headersSent) return;
    const message = err instanceof Error ? err.message : 'Kesalahan internal server.';
    res.status(500).json({ error: message });
  });

  return app;
}
