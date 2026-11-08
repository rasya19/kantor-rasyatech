import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { aiClient } from '../config/gemini';
import { prisma } from '../lib/prisma';
import { trackActivity } from './activityService';
import { selectAi } from './aiRouting';
import { generateCopilotReport } from './copilotReport';
import { createContentFlow } from './contentFlow';
import { contentPackageInstruction, contentPackageProblems } from './contentPackage';
import type { OfficeDivision, Ticket, WorkDraft } from '../../src/workflowTypes';

export class WorkflowError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const systemInstruction = 'Anda staf Kantor AI Rasyatech. Buat laporan profesional dalam bahasa Indonesia untuk ditinjau pimpinan sebelum tindakan apa pun. Bedakan fakta yang diberikan dari dugaan dan tulis informasi yang masih dibutuhkan. Jangan mengarang fitur produk, menampilkan kode mentah kecuali diminta secara eksplisit, atau mengklaim telah mengakses sistem, memperbaiki bug, mengirim pesan, meneliti tren langsung, atau mempublikasikan konten. Untuk laporan klien sertakan ringkasan, prioritas usulan, langkah investigasi aman, dan draf jawaban WhatsApp. Untuk konten sertakan ide video 9:16, hook 3 detik, naskah, caption, tagar, rencana monetisasi tanpa janji penghasilan, dan hal yang perlu diverifikasi. Pernyataan pemilik tentang fitur PAUD: 1-klik sinkronisasi Dapodik, rekap presensi otomatis, manajemen SPP, dan pendaftaran PSE Komdigi; informasi ini perlu diverifikasi sebelum dinyatakan sebagai fakta kepada klien.';

export async function generateReportWithDetails(instruction: string, division?: OfficeDivision, signal?: AbortSignal): Promise<{ content: string; ai: { provider: 'gemini' | 'copilot'; model: string } }> {
  let ai;
  try {
    ai = selectAi(division);
  } catch (error) {
    throw new WorkflowError(error instanceof Error ? error.message : 'Konfigurasi AI tidak valid.', 503);
  }
  if (ai.provider === 'gemini' && !aiClient) {
    throw new WorkflowError('GEMINI_API_KEY belum dikonfigurasi. Draf AI tidak dibuat.', 503);
  }
  if (ai.provider === 'copilot' && !process.env.COPILOT_GITHUB_TOKEN) {
    throw new WorkflowError('COPILOT_GITHUB_TOKEN belum dikonfigurasi. Draf AI tidak dibuat.', 503);
  }
  const credits = Number(process.env.COPILOT_MAX_AI_CREDITS);
  if (ai.provider === 'copilot' && (!Number.isFinite(credits) || credits <= 0)) {
    throw new WorkflowError('COPILOT_MAX_AI_CREDITS harus diisi angka positif.', 503);
  }
  try {
    if (ai.provider === 'copilot') {
      return { content: await generateCopilotReport(instruction, systemInstruction, ai.model, signal), ai };
    }
    if (!aiClient) throw new Error('Gemini tidak tersedia.');
    const response = await aiClient.models.generateContent({
      model: ai.model,
      contents: instruction,
      config: {
        abortSignal: signal,
        systemInstruction,
      },
    });
    const text = response.text?.trim();
    if (!text) throw new Error('Gemini mengembalikan respons kosong.');
    return { content: text, ai };
  } catch (error) {
    if (ai.provider === 'gemini') {
      const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
      console.error(`[Workflow] Gemini gagal; status HTTP: ${status ?? 'tidak tersedia'}.`);
      if (status === 404) throw new WorkflowError(`Model Gemini "${ai.model}" tidak tersedia untuk permintaan ini. Periksa GEMINI_MODEL dan akses model pada proyek Google AI.`, 502);
      if (status === 400 || status === 401 || status === 403) throw new WorkflowError('Gemini menolak permintaan. Periksa kunci API, izin proyek, dan konfigurasi model.', 502);
      if (status === 429) throw new WorkflowError('Kuota Gemini atau batas permintaan tercapai. Periksa kuota dan tagihan, lalu coba lagi.', 429);
      if (status === 500 || status === 502 || status === 503 || status === 504) throw new WorkflowError('Layanan Gemini sedang mengalami gangguan. Coba lagi nanti.', 503);
      throw new WorkflowError('Gemini gagal membuat laporan. Periksa koneksi, konfigurasi, dan log server; coba lagi.', 502);
    }
    console.error('[Workflow] Copilot gagal membuat laporan:', error);
    throw new WorkflowError('Copilot gagal membuat laporan. Periksa konfigurasi, akses, kuota dan log server; coba lagi.', 502);
  }
}

export async function generateReport(instruction: string, signal?: AbortSignal, division?: OfficeDivision): Promise<string> {
  return (await generateReportWithDetails(instruction, division, signal)).content;
}

export async function createDraft(options: {
  division: WorkDraft['division'];
  title: string;
  instruction: string;
  ticketId?: string;
  id?: string;
}): Promise<WorkDraft> {
  return trackActivity(options.division, 'CREATE', async () => {
    const isContentPackage = options.division === 'creator';
    const { content, ai } = await generateReportWithDetails(`${options.instruction}${isContentPackage ? `\n\n${contentPackageInstruction}` : ''}`, options.division, AbortSignal.timeout(90000));
    if (isContentPackage) {
      const problems = contentPackageProblems(content);
      if (problems.length) throw new WorkflowError(`Paket konten AI belum lengkap: ${problems.join(', ')}. Coba lagi.`, 502);
    }
    const now = new Date().toISOString();
    const draft: WorkDraft = {
      id: options.id || randomUUID(),
      ticketId: options.ticketId || null,
      division: options.division,
      title: options.title,
      content,
      ...(isContentPackage ? { contentPackageVersion: 1 as const } : {}),
      ai,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    const snapshot: Prisma.InputJsonObject = { ...draft };
    await prisma.officeDraft.create({
      data: {
        id: draft.id,
        ticketId: draft.ticketId,
        data: snapshot,
        events: { create: { action: 'CREATED', data: snapshot } },
      },
    });
    return draft;
  });
}

export async function createTicketDraft(ticket: Ticket): Promise<WorkDraft> {
  return createDraft({
    division: ticket.division,
    title: `Laporan ${ticket.division.toUpperCase()}: ${ticket.title}`,
    ticketId: ticket.id,
    instruction: `Buat laporan untuk pimpinan berdasarkan tiket berikut. Jangan menganggap bug sudah terverifikasi atau mengarang fakta.\nProduk: ${ticket.division}\nKategori: ${ticket.category}\nJudul: ${ticket.title}\nLaporan klien: ${ticket.description}\nCatatan admin: ${ticket.notes}`,
  });
}

export async function createContentDraft(topic: string, id?: string): Promise<WorkDraft> {
  return createDraft({
    division: 'creator',
    title: `Ide konten: ${topic}`,
    instruction: `Buat draf konten untuk topik berikut: ${topic}. Sajikan usulan konten video pendek, bukan klaim tren yang sudah diverifikasi. Semua publikasi dan monetisasi dilakukan manusia setelah persetujuan.`,
    id,
  });
}

export function jakartaSchedule(now: Date): { date: string; due: boolean } {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return { date: wib.toISOString().slice(0, 10), due: wib.getUTCHours() >= 6 };
}

let schedulerBusy = false;
let lastAttemptDate = '';
let lastAttemptTime = 0;
export async function runScheduledCreator(now = new Date()): Promise<void> {
  const { date, due } = jakartaSchedule(now);
  if (!due || schedulerBusy) return;
  if (lastAttemptDate === date && now.getTime() - lastAttemptTime < 10 * 60 * 1000) return;
  lastAttemptDate = date;
  lastAttemptTime = now.getTime();
  schedulerBusy = true;
  try {
    const id = `creator-daily-${date}`;
    if (await prisma.officeDraft.findUnique({ where: { id } })) return;
    await prisma.$transaction((tx) => createContentFlow(tx,
      'Ide konten harian: edukasi Siput PAUD atau Posyandu',
      'Buat draf konten edukasi produk Siput PAUD atau Posyandu untuk calon pengguna. Sajikan usulan video pendek, bukan klaim tren yang sudah diverifikasi. Semua publikasi dan monetisasi dilakukan manusia setelah persetujuan.', id));
    console.log(`[Scheduler] Tugas konten ${date} WIB masuk antrean Trendy.`);
  } catch (error) {
    // The deterministic job ID also prevents duplicate jobs across server instances.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    console.error('[Scheduler] Tugas harian gagal dijadwalkan; akan dicoba lagi:', error);
  } finally {
    schedulerBusy = false;
  }
}

export function startCreatorScheduler(): void {
  void runScheduledCreator();
  setTimeout(() => {
    void runScheduledCreator();
    setInterval(() => { void runScheduledCreator(); }, 60 * 1000);
  }, 60 * 1000 - Date.now() % (60 * 1000));
}
