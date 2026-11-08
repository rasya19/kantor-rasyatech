import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import workflowRoutes from './server/routes/workflowRoutes';
import { startCreatorScheduler } from './server/services/workflowService';
import jobRoutes from './server/routes/jobRoutes';
import { startJobWorker } from './server/services/jobService';
import { startVideoWorker } from './server/services/videoService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json());

// Mount Modular API Routes
app.use('/api/workflow', workflowRoutes);
app.use('/api/office-work', jobRoutes);

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Kantor AI PT Rasyatech Digital Zenith', time: new Date().toISOString() });
});

// Start Autonomous Proactive Background Cron Scanner
startCreatorScheduler();
startJobWorker();
startVideoWorker();

// Production / Dev Vite Server Mounting
async function bootstrapServer() {
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

  app.listen(PORT, HOST, () => {
    console.log(`[Kantor AI Server] Berjalan pada http://${HOST}:${PORT}`);
    if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
      console.warn('[Kantor AI Server] Server tidak memiliki autentikasi; jangan buka akses jaringan tanpa proteksi tambahan.');
    }
  });
}

bootstrapServer().catch((err) => {
  console.error('[Kantor AI Server] Fatal error booting server:', err);
  process.exit(1);
});
