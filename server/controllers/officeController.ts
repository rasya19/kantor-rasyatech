import { Request, Response } from 'express';
import { STAFF_REGISTRY, dispatchToGemini, reviseDraftWithGemini } from '../services/geminiService';
import { getProactiveDrafts, triggerManualProactiveBatch, runDailyCreatorRoutine } from '../services/scannerService';

export const officeController = {
  // GET /api/ai-office/staff
  getStaff: (_req: Request, res: Response) => {
    res.json({
      success: true,
      staff: Object.values(STAFF_REGISTRY),
    });
  },

  // POST /api/ai-office/dispatch
  dispatchTask: async (req: Request, res: Response) => {
    try {
      const { taskPrompt, staffHint, divisionHint } = req.body;

      if (!taskPrompt || typeof taskPrompt !== 'string') {
        res.status(400).json({ error: 'Instruksi tugas untuk Kantor AI wajib diisi.' });
        return;
      }

      const draft = await dispatchToGemini(taskPrompt, staffHint, divisionHint);
      res.json({
        success: true,
        draft,
      });
    } catch (err: unknown) {
      console.error('[Office Controller] Dispatch error:', err);
      res.status(500).json({ error: 'Terjadi kendala saat memproses draf.' });
    }
  },

  // POST /api/ai-office/revise
  reviseTask: async (req: Request, res: Response) => {
    try {
      const { draftId, previousDraft, revisionNotes, staffName, divisionName } = req.body;

      if (!revisionNotes) {
        res.status(400).json({ error: 'Catatan revisi dari Bos Ismanto wajib diisi.' });
        return;
      }

      const revisedDraft = await reviseDraftWithGemini(
        draftId,
        previousDraft,
        revisionNotes,
        staffName || 'Pegawai AI',
        divisionName || 'PT Rasyatech Digital Zenith'
      );

      res.json({
        success: true,
        revisedDraft,
      });
    } catch (err: unknown) {
      console.error('[Office Controller] Revise error:', err);
      res.status(500).json({ error: 'Gagal merevisi draf.' });
    }
  },

  // GET /api/ai-office/proactive
  getProactive: (_req: Request, res: Response) => {
    const drafts = getProactiveDrafts();
    res.json({
      success: true,
      proactiveDrafts: drafts,
      totalCount: drafts.length,
      timestamp: new Date().toISOString(),
    });
  },

  // POST /api/ai-office/proactive/scan
  triggerScan: (_req: Request, res: Response) => {
    const batch = triggerManualProactiveBatch();
    res.json({
      success: true,
      message: 'Pemindaian proaktif radar otonom sukses dijalankan.',
      proactiveReports: batch,
      scanTimestamp: new Date().toISOString(),
    });
  },

  // POST /api/ai-office/creator/daily-routine
  dailyCreatorRoutine: async (req: Request, res: Response) => {
    try {
      const { topic } = req.body || {};
      const report = await runDailyCreatorRoutine(topic);
      res.json({
        success: true,
        message: 'Siklus harian 06.00 Pagi Divisi Content Creator berhasil dijalankan.',
        report,
      });
    } catch (err: unknown) {
      console.error('[Office Controller] Creator routine error:', err);
      res.status(500).json({ error: 'Gagal menjalankan siklus harian content creator.' });
    }
  },
};
