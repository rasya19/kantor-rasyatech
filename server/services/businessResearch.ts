import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { companyMissionInstruction, currentWibDate, WorkflowError } from './workflowService.js';
import { generateOpenRouter, OpenRouterError } from './openrouter.js';
import type { WorkDraft } from '../../src/workflowTypes.js';

export const opportunityResearchTimeoutMs = 150_000;
const digitalProductResearchPrefix = 'digital-product-research-';
const dailyDigitalProductPrefix = 'daily-digital-product-';
const wibOffsetMs = 7 * 60 * 60 * 1000;
const dailyProductResearchThemes = [
  'kebutuhan operasional usaha kecil/UMKM',
  'kebutuhan kreator konten independen',
  'kebutuhan pencari kerja dan pengembangan karier',
  'kebutuhan pengajar dan pembelajar, tanpa menganggap guru sebagai satu-satunya pasar',
  'kebutuhan rumah tangga dan pengelolaan aktivitas sehari-hari',
  'kebutuhan pekerja lepas dan jasa profesional',
  'kebutuhan komunitas hobi dan kegiatan lokal',
];

function dailyProductResearchTheme(date: string): string {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return dailyProductResearchThemes[((day % dailyProductResearchThemes.length) + dailyProductResearchThemes.length) % dailyProductResearchThemes.length];
}

export function isDigitalProductResearchJob(id: string): boolean {
  return /^digital-product-research-[0-9a-f-]{36}$/.test(id) ||
    /^daily-digital-product-\d{4}-\d{2}-\d{2}$/.test(id);
}

export async function scheduleDailyDigitalProductResearch(now = new Date()): Promise<number> {
  const wib = new Date(now.getTime() + wibOffsetMs);
  if (wib.getUTCHours() < 6) return 0;
  const date = wib.toISOString().slice(0, 10);
  const focus = dailyProductResearchTheme(date);
  const result = await prisma.officeJob.createMany({
    data: [{
      id: `${dailyDigitalProductPrefix}${date}`,
      division: 'creator',
      staffId: 'strategist',
      title: `Riset produk digital harian · ${date}`,
      instruction: `Fokus riset hari ini: ${focus}. Bandingkan kebutuhan dari beberapa kelompok pengguna dalam tema ini, lalu rekomendasikan satu konsep produk digital non-aplikasi yang paling layak diuji berdasarkan bukti, bukan asumsi. Pisahkan fakta dari hipotesis; jangan menjanjikan permintaan atau pendapatan, menghubungi pelanggan, membayar layanan, atau memublikasikan.`,
      status: 'PAUSED',
    }],
    skipDuplicates: true,
  });
  return result.count;
}

export function startDailyDigitalProductScheduler(): void {
  const run = () => {
    void scheduleDailyDigitalProductResearch().catch((error) =>
      console.error('[Produk digital harian] Penjadwalan gagal:', error));
  };
  run();
  setInterval(run, 60_000);
}

export function isDailyDigitalProductResearchJob(id: string): boolean {
  return /^daily-digital-product-\d{4}-\d{2}-\d{2}$/.test(id);
}

export async function enqueueDigitalProductResearch(): Promise<{ id: string }> {
  const id = `${digitalProductResearchPrefix}${randomUUID()}`;
  await prisma.officeJob.create({ data: {
    id,
    division: 'creator',
    staffId: 'strategist',
    title: 'Riset peluang produk digital non-aplikasi',
    instruction: 'Riset peluang produk digital non-aplikasi untuk berbagai kelompok pengguna dan kebutuhan di Indonesia; jangan terpaku pada produk pendidikan atau satu profesi. Jelajahi beberapa kategori seperti template, panduan, workbook, kit konten, prompt/workflow, atau materi belajar. Bandingkan maksimal tiga konsep dari kelompok pengguna/kategori berbeda dan rekomendasikan satu eksperimen termurah berdasarkan bukti publik yang dapat diperiksa. Cantumkan tautan dan tanggal sumber, bukti kebutuhan/pesaing bila tersedia, bentuk produk minimum, eksperimen minat manual 7 hari, biaya yang perlu dikonfirmasi, serta kriteria lanjut/berhenti. Jangan mengarang permintaan atau harga pasar, menjanjikan pendapatan, meminta data pribadi, menghubungi pelanggan, atau memublikasikan. Jangan meneliti atau mengusulkan aplikasi baru untuk tugas ini.',
  } });
  return { id };
}

type GroundedResearchOptions = {
  id: string;
  title: string;
  division: WorkDraft['division'];
  instruction: string;
  product?: string;
  minimumSources?: number;
  validateContent?: (content: string) => string[];
};

const quantitativeClaimPattern = /(?:\b\d+(?:[.,]\d+)?\s*(?:%|persen|orang|pendaftar|peserta|users?|pengguna|sekolah|jam|menit|hari|minggu|bulan|tahun|prompt|halaman|downloads?|konversi|grup|komunitas|transaksi)\b|\b(?:Rp|US\$|\$)\s*\d[\d.,]*(?:\s*(?:-|–|—|sampai|hingga)\s*(?:(?:Rp|US\$|\$)\s*)?\d[\d.,]*)?)/gi;

export function digitalProductResearchProblems(content: string): string[] {
  const reportBody = content.replace(/(?:^|\n)#{0,6}\s*(?:\*\*)?(?:Daftar Sumber|Sumber Rujukan)\b[\s\S]*$/i, '');
  const problems: string[] = [];
  for (const line of reportBody.split(/\r?\n/)) {
    if (/^\s*(?:\*\*)?(?:Tanggal|Tanggal akses|Tanggal publikasi)\s*:/i.test(line)) continue;
    const hasCitation = /\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/\S+/i.test(line);
    const text = line.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/gi, '[sumber]').replace(/https?:\/\/\S+/gi, '[sumber]');
    for (const match of text.matchAll(quantitativeClaimPattern)) {
      const metric = match[0];
      const lower = line.toLowerCase();
      const ownerPriceHypothesis = /rp\s*25[.,]000[\s\S]*(?:–|-|sampai|hingga)[\s\S]*rp\s*50[.,]000/i.test(line) &&
        /hipotesis|usulan|uji/i.test(line);
      const experimentDuration = /\b7\s*hari\b/i.test(metric) && /eksperimen|uji|validasi/i.test(line);
      const explicitlyLabeledHypothesis = /hipotesis|usulan|uji coba/i.test(lower);
      if (!hasCitation && !ownerPriceHypothesis && !experimentDuration && !explicitlyLabeledHypothesis) {
        problems.push(metric);
      }
    }
  }
  return [...new Set(problems)];
}

export function currentDigitalProductSourceProblems(content: string, currentYear = Number(currentWibDate().slice(0, 4))): string[] {
  const sourceSection = content.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Daftar Sumber(?: Rujukan)?|Sumber Riset|Sumber yang digunakan)\b[\s\S]*$/i)?.[0];
  if (!sourceSection) return ['daftar sumber publik dengan tanggal publikasi/pembaruan'];

  const blocks = sourceSection.split(/(?=^\s*\d+[.)]\s+)/m).filter((block) => /https?:\/\//i.test(block));
  const datedCurrentSources = new Set<string>();
  const staleSources: string[] = [];
  for (const block of blocks) {
    const url = block.match(/https?:\/\/[^\s)]+/i)?.[0];
    if (!url) continue;
    const publicationLines = block.split(/\r?\n/).filter((line) =>
      /\b(?:tanggal\s+(?:publikasi|pembaruan)|dipublikasikan|diperbarui|published|last updated|updated)\b/i.test(line) &&
      !/\btanggal\s+akses\b/i.test(line));
    const publicationYears = publicationLines.flatMap((line) => [...line.matchAll(/\b20\d{2}\b/g)].map((match) => Number(match[0])));
    if (publicationYears.includes(currentYear)) {
      datedCurrentSources.add(url);
    } else {
      const title = block.match(/(?:Judul|Title)\s*:\s*([^\r\n]+)/i)?.[1]?.trim() ?? url;
      staleSources.push(title);
    }
  }

  const problems = staleSources.map((source) => `tanggal publikasi/pembaruan sumber belum terverifikasi untuk tahun ${currentYear}: ${source}`);
  if (datedCurrentSources.size < 3) {
    problems.push(`minimal 3 sumber unik dengan tanggal publikasi/pembaruan ${currentYear} (tanggal akses saja tidak dihitung)`);
  }
  return problems;
}

export function digitalProductResearchValidationProblems(content: string, currentYear = Number(currentWibDate().slice(0, 4))): string[] {
  const sourceSection = content.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:Daftar Sumber(?: Rujukan)?|Sumber Riset|Sumber yang digunakan)\b[\s\S]*$/i)?.[0];
  if (!sourceSection) return [...digitalProductResearchProblems(content), 'daftar minimal 3 tautan sumber web unik'];
  const sources = new Set(
    [...sourceSection.matchAll(/https?:\/\/[^\s)]+/gi)]
      .map(([url]) => url.replace(/[.,;]+$/, '')),
  );
  const problems = digitalProductResearchProblems(content);
  if (sources.size < 3) problems.push(`minimal 3 tautan sumber web unik (ditemukan ${sources.size})`);
  return problems;
}

async function generateGroundedResearch({ id, title, division, instruction, product, minimumSources = 1, validateContent }: GroundedResearchOptions): Promise<WorkDraft> {
  let response;
  try {
    response = await generateOpenRouter(`${instruction}\n\nTanggal akses saat ini (WIB): ${currentWibDate()}.`, `${companyMissionInstruction} Semua riset harus memakai pencarian web eksternal dan menyertakan bukti yang dapat diperiksa. Buat laporan bahasa Indonesia yang ringkas untuk pimpinan; ide dan hipotesis bukan bukti permintaan atau pendapatan.`, division, AbortSignal.timeout(opportunityResearchTimeoutMs), true, product, 2400);
  } catch (error) {
    if (error instanceof OpenRouterError) throw new WorkflowError(error.message, error.status);
    throw error;
  }
  const content = response.content;
  const contentProblems = validateContent?.(content) ?? [];
  const validSources: { url: string; title: string }[] = [];
  const citations: { text: string; sourceIndexes: number[] }[] = [];
  const sourceIndexByUrl = new Map<string, number>();
  for (const annotation of response.annotations) {
    if (!annotation || typeof annotation !== 'object' || !('type' in annotation) || annotation.type !== 'url_citation' || !('url_citation' in annotation) || !annotation.url_citation || typeof annotation.url_citation !== 'object') continue;
    const item = annotation.url_citation;
    if (!('url' in item) || typeof item.url !== 'string') continue;
    try {
      const parsed = new URL(item.url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      let index = sourceIndexByUrl.get(parsed.href);
      if (index === undefined) {
        index = validSources.push({ url: parsed.href, title: 'title' in item && typeof item.title === 'string' ? item.title : parsed.hostname }) - 1;
        sourceIndexByUrl.set(parsed.href, index);
      }
      if ('start_index' in item && 'end_index' in item && typeof item.start_index === 'number' && typeof item.end_index === 'number' && Number.isInteger(item.start_index) && Number.isInteger(item.end_index) && item.start_index >= 0 && item.end_index > item.start_index && item.end_index <= content.length) {
        citations.push({ text: content.slice(item.start_index, item.end_index), sourceIndexes: [index] });
      }
    } catch { continue; }
  }
  if (validSources.length === 0) {
    throw new WorkflowError(`Riset hanya menghasilkan ${validSources.length} sumber web; minimal ${minimumSources} sumber diperlukan. Tidak ada draf yang disimpan; permintaan mungkin tetap ditagih.`, 502);
  }
  const warnings = [
    ...contentProblems,
    ...(validSources.length < minimumSources
      ? [`sumber web terverifikasi baru ${validSources.length} dari minimal ${minimumSources}`]
      : []),
  ];
  const finalContent = warnings.length
    ? `[PERLU VERIFIKASI SUMBER — catatan pemeriksaan otomatis: ${warnings.join('; ')}]\n\n${content}`
    : content;
  const now = new Date().toISOString();
  const draft: WorkDraft = {
    id, ticketId: null, division,
    title,
    content: finalContent,
    grounding: { searchSuggestions: '', sources: validSources, citations },
    status: 'PENDING', createdAt: now, updatedAt: now, ai: { provider: 'openrouter', model: response.model },
  };
  return draft;
}

export async function generateDigitalProductResearch(id: string = randomUUID(), researchFocus?: string): Promise<WorkDraft> {
  const focusInstruction = researchFocus ? `\n\nARAHAN TAMBAHAN DARI TUGAS TERJADWAL:\n${researchFocus}` : '';
  const instruction = `Lakukan riset web eksternal terbaru untuk mencari peluang produk digital non-aplikasi yang dapat diuji di Indonesia. Jelajahi kebutuhan dari kelompok yang beragam, misalnya UMKM, kreator, pekerja lepas, pencari kerja, pengajar/pembelajar, rumah tangga, atau komunitas. Jangan menganggap satu kelompok sebagai target utama tanpa bukti. Pertimbangkan format produk yang sesuai masalah, seperti template, panduan, workbook, kit konten, prompt/workflow, atau materi belajar; jangan memaksakan satu format. Jangan membangun atau memprioritaskan aplikasi dalam laporan ini.

Gunakan hanya bukti pasar yang tanggal publikasi atau pembaruan terakhirnya berada pada tahun berjalan (${currentWibDate().slice(0, 4)}) untuk mendukung klaim tentang permintaan, tren, harga pesaing, atau kondisi platform saat ini. Sumber bertanggal sebelum tahun berjalan tidak boleh dipakai untuk menggambarkan kondisi pasar terkini. Tanggal akses bukan tanggal publikasi/pembaruan dan tidak membuat sumber lama menjadi baru. Bila menemukan sumber lama, jangan jadikan bukti utama; boleh sebut singkat sebagai konteks historis yang jelas, bukan tren sekarang. Jika tidak ada cukup bukti terkini, nyatakan bahwa riset belum bisa memverifikasi peluang dan jangan mengisi kekosongan dengan angka atau rekomendasi spekulatif.

Cari dan bandingkan maksimal tiga konsep dari kelompok pengguna atau kategori produk yang berbeda, menggunakan bukti publik dari sumber independen/primer mengenai masalah pengguna, produk sejenis yang benar-benar ditawarkan, tanda permintaan yang dapat diamati, dan harga pesaing jika tersedia. Tulis setiap konsep dalam blok mandiri dengan format persis: ## IDE PRODUK 1: [nama konsep] (nomor berurutan sampai maksimal 3), lalu jelaskan kelompok pengguna, masalah, bentuk produk non-aplikasi, bukti dan batas verifikasinya. Jangan gabungkan beberapa ide dalam satu blok. Untuk setiap klaim spesifik tentang permintaan, tren, harga, biaya, atau platform, cantumkan tautan sumber serta tanggal publikasi/pembaruan tepat di dekat klaim. Di akhir laporan, buat daftar minimal tiga sumber unik: judul, penerbit, tautan, tanggal publikasi atau pembaruan yang dapat diverifikasi. Cantumkan "tanggal publikasi/pembaruan tidak ditemukan" bila memang tidak ada; jangan menyamarkannya sebagai sumber terkini. Jangan mengarang angka, statistik, testimoni, kompetitor, atau benchmark. Jika bukti tidak tersedia, katakan "belum terverifikasi".

Jangan menjanjikan produk cepat laku atau banyak pembeli. Rekomendasikan satu eksperimen termurah yang bisa dilakukan manual dalam 7 hari: kelompok calon pengguna, contoh isi minimum, cara mengukur minat sebelum membuat produk penuh, biaya yang perlu dikonfirmasi, dan kriteria lanjut/berhenti. Harga hanya boleh disebut jika ada sumber terkini atau secara eksplisit diberi label hipotesis uji, bukan fakta pasar. Jangan mengusulkan roadmap berbulan-bulan atau proyeksi pendapatan. Jangan meminta atau menggunakan data pribadi, termasuk data anak atau kesehatan.${focusInstruction}`;
  return generateGroundedResearch({
    id,
    title: 'Riset peluang produk digital non-aplikasi',
    division: 'creator',
    instruction,
    product: 'digital',
    minimumSources: 3,
    validateContent: (content) => digitalProductResearchValidationProblems(content),
  });
}

export async function generateProductResearch(product: 'paud' | 'posyandu' | 'opportunities', id: string = randomUUID()): Promise<WorkDraft> {
  const targets = {
    paud: {
      title: 'Riset peluang Siput PAUD',
      instruction: 'Riset sumber publik terbaru tentang kebutuhan software administrasi sekolah PAUD di Indonesia. Identifikasi calon pembeli berdasarkan peran, masalah, dan bukti publik beserta sumber/tanggal; ajukan satu eksperimen validasi manual 7 hari, hipotesis harga, metrik minat, serta kriteria lanjut/berhenti. Jangan mengarang fitur Siput PAUD, pelanggan, testimoni, harga pasar, biaya, atau penghasilan; fitur yang disebut pemilik harus diverifikasi.',
    },
    posyandu: {
      title: 'Riset peluang Siput Posyandu',
      instruction: 'Riset sumber publik terbaru tentang kebutuhan software administrasi Posyandu di Indonesia. Identifikasi calon pembeli berdasarkan peran, masalah, dan bukti publik beserta sumber/tanggal; ajukan satu eksperimen validasi manual 7 hari, hipotesis harga, metrik minat, serta kriteria lanjut/berhenti. Jangan mengarang fitur Siput Posyandu, pelanggan, testimoni, harga pasar, biaya, atau penghasilan; jangan memberi saran medis atau meminta data kesehatan/pribadi.',
    },
    opportunities: {
      title: 'Riset peluang aplikasi ScanBite, Konter +62, dan Lorisan Warung',
      instruction: 'Riset sumber publik terbaru untuk memvalidasi peluang aplikasi yang disebut pemilik: ScanBite (order kafe lewat QR), Konter +62 (POS), dan Manajemen Lorisan Warung. Untuk setiap aplikasi, identifikasi calon pembeli berdasarkan peran, masalah dan bukti publik dengan sumber/tanggal, serta satu eksperimen validasi manual 7 hari. Nama dan deskripsi tersebut hanya informasi dari pemilik, bukan bukti fitur tersedia, produk siap, pelanggan, harga, atau permintaan. Tandai fakta, asumsi, biaya yang perlu dikonfirmasi, metrik minat, serta kriteria lanjut/berhenti. Jangan mengarang fitur, pelanggan, testimoni, harga pasar, biaya, atau penghasilan.',
    },
  }[product];
  return generateGroundedResearch({
    id,
    title: targets.title,
    division: 'engineer',
    instruction: targets.instruction,
  });
}

export async function researchProduct(product: 'paud' | 'posyandu' | 'opportunities'): Promise<WorkDraft> {
  const draft = await generateProductResearch(product);
  const data: Prisma.InputJsonObject = { ...draft };
  await prisma.officeDraft.create({ data: { id: draft.id, data, events: { create: { action: 'CREATED', data } } } });
  return draft;
}
