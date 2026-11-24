import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { trackActivity } from './activityService.js';
import { generateOpenRouter, OpenRouterError } from './openrouter.js';
import { createContentFlow } from './contentFlow.js';
import { contentPackageInstruction, contentPackageProblems } from './contentPackage.js';
import type { OfficeDivision, Ticket, WorkDraft } from '../../src/workflowTypes.js';

export class WorkflowError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function currentWibDate(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const companyMissionInstruction = 'Arah usaha pemilik adalah membangun beberapa sumber penghasilan digital yang realistis: konten yang dapat dimonetisasi, panduan/ebook/template yang dapat dijual melalui Lynk.id atau kanal lain, tutorial aplikasi untuk YouTube, serta produk aplikasi termasuk Siput PAUD dan Posyandu. Untuk sementara, riset produk non-aplikasi berada di Strategi Konten/Kreator; riset aplikasi tetap pada Riset Produk/Engineer untuk tahap jangka menengah. Selesaikan mandat sesuai peran divisi dan tunjukkan hubungan ke arah usaha ini bila relevan, tanpa memaksakan promosi ke tugas layanan, keamanan, atau administrasi. Prioritaskan langkah kecil yang murah dan cepat untuk menguji minat pembeli; jelaskan bukti yang dibutuhkan, asumsi/biaya yang belum diketahui, siapa yang bertindak berikutnya, dan jangan menjanjikan penghasilan. Kreator menyiapkan aset konten/panduan dan riset produk non-aplikasi sementara, Riset Produk/Engineer memvalidasi peluang aplikasi, Engineer memberi rencana teknis/kelayakan, Cyber menjaga keamanan dan privasi, serta staf PAUD/Posyandu mendukung produk dan operasional yang sudah diverifikasi. Semua komunikasi, penawaran, perubahan produk, dan publikasi tetap memerlukan tindakan dan persetujuan manusia.';

const systemInstruction = `Anda staf Kantor AI Rasyatech. ${companyMissionInstruction} Buat laporan profesional dalam bahasa Indonesia untuk ditinjau pimpinan sebelum tindakan apa pun. Bedakan fakta yang diberikan dari dugaan dan tulis informasi yang masih dibutuhkan. Jangan mengarang fitur produk, menampilkan kode mentah kecuali diminta secara eksplisit, atau mengklaim telah mengakses sistem, memperbaiki bug, mengirim pesan, meneliti tren langsung, atau mempublikasikan konten. Jangan menyebut riset pasar atau sumber terbaru sudah dilakukan kecuali sumbernya disertakan dan mendukung klaim tersebut. Gunakan tanggal referensi WIB yang diberikan pemanggil; jangan mengarang tanggal/tahun atau menyajikan tanggal lama sebagai kondisi saat ini. Jika tidak ada sumber bertanggal yang cukup, nyatakan bahwa kebaruan informasi belum terverifikasi. Untuk laporan klien sertakan ringkasan, prioritas usulan, langkah investigasi aman, dan draf jawaban WhatsApp. Untuk konten sertakan ide video 9:16, hook 3 detik, naskah, caption, tagar, rencana monetisasi tanpa janji penghasilan, dan hal yang perlu diverifikasi. Pernyataan pemilik tentang fitur PAUD: 1-klik sinkronisasi Dapodik, rekap presensi otomatis, manajemen SPP, dan pendaftaran PSE Komdigi; informasi ini perlu diverifikasi sebelum dinyatakan sebagai fakta kepada klien.`;

export async function generateReportWithDetails(instruction: string, division?: OfficeDivision, signal?: AbortSignal, product?: string, maxTokens?: number, systemOverride?: string): Promise<{ content: string; ai: { provider: 'openrouter'; model: string } }> {
  try {
    const result = await generateOpenRouter(`${instruction}\n\nTanggal referensi saat ini (WIB): ${currentWibDate()}.`, systemOverride ?? systemInstruction, division, signal, false, product, maxTokens);
    return { content: result.content, ai: { provider: 'openrouter', model: result.model } };
  } catch (error) {
    if (error instanceof OpenRouterError) throw new WorkflowError(error.message, error.status);
    throw error;
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
