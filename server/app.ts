import express, { type Request, type Response } from 'express';
import { prisma } from './lib/prisma';
import workflowRoutes from './routes/workflowRoutes';
import jobRoutes from './routes/jobRoutes';
import businessRoutes from './routes/businessRoutes';
import warungRoutes from './routes/warungRoutes';

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

  return app;
}
