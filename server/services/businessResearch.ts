import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { WorkflowError } from './workflowService';
import { generateOpenRouter, openRouterModel, OpenRouterError } from './openrouter';
import type { WorkDraft } from '../../src/workflowTypes';

export async function generateProductResearch(product: 'paud' | 'posyandu' | 'opportunities', id: string = randomUUID()): Promise<WorkDraft> {
  const model = openRouterModel('engineer');
  const subject = product === 'paud' ? 'software administrasi sekolah PAUD di Indonesia' : product === 'posyandu' ? 'software administrasi posyandu di Indonesia' : 'kebutuhan aplikasi yang layak dijual di berbagai sektor Indonesia, misalnya manajemen konter, warung dan usaha lainnya';
  let response;
  try {
    response = await generateOpenRouter(`Riset sumber publik terbaru tentang ${subject}. Bandingkan beberapa peluang, pilih satu ide, jelaskan segmen, masalah, MVP, hipotesis harga, validasi dan penjualan. Bedakan fakta bersumber dan hipotesis. Jangan mengarang fitur, pelanggan, harga pasar, penghasilan atau data medis.`, 'Buat laporan bahasa Indonesia untuk pimpinan; jangan menjanjikan pendapatan.', 'engineer', AbortSignal.timeout(90000), true);
  } catch (error) {
    if (error instanceof OpenRouterError) throw new WorkflowError(error.message, error.status);
    throw error;
  }
  const content = response.content;
  const validSources: { url: string; title: string }[] = [];
  const citations: { text: string; sourceIndexes: number[] }[] = [];
  for (const annotation of response.annotations) {
    if (!annotation || typeof annotation !== 'object' || !('type' in annotation) || annotation.type !== 'url_citation' || !('url_citation' in annotation) || !annotation.url_citation || typeof annotation.url_citation !== 'object') continue;
    const item = annotation.url_citation;
    if (!('url' in item) || typeof item.url !== 'string') continue;
    try {
      const parsed = new URL(item.url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      const source = { url: parsed.href, title: 'title' in item && typeof item.title === 'string' ? item.title : parsed.hostname };
      const index = validSources.push(source) - 1;
      if ('start_index' in item && 'end_index' in item && typeof item.start_index === 'number' && typeof item.end_index === 'number' && Number.isInteger(item.start_index) && Number.isInteger(item.end_index) && item.start_index >= 0 && item.end_index > item.start_index && item.end_index <= content.length) {
        citations.push({ text: content.slice(item.start_index, item.end_index), sourceIndexes: [index] });
      }
    } catch { continue; }
  }
  if (validSources.length === 0) {
    throw new WorkflowError('Riset tidak menghasilkan teks dan sumber pencarian yang dapat diperiksa. Tidak ada draf yang disimpan; permintaan mungkin tetap ditagih.', 502);
  }
  const now = new Date().toISOString();
  const draft: WorkDraft = {
    id, ticketId: null, division: 'engineer',
    title: `Riset peluang ${product === 'paud' ? 'Siput PAUD' : product === 'posyandu' ? 'Siput Posyandu' : 'aplikasi baru'}`,
    content,
    grounding: { searchSuggestions: '', sources: validSources, citations },
    status: 'PENDING', createdAt: now, updatedAt: now, ai: { provider: 'openrouter', model },
  };
  return draft;
}

export async function researchProduct(product: 'paud' | 'posyandu' | 'opportunities'): Promise<WorkDraft> {
  const draft = await generateProductResearch(product);
  const data: Prisma.InputJsonObject = { ...draft };
  await prisma.officeDraft.create({ data: { id: draft.id, data, events: { create: { action: 'CREATED', data } } } });
  return draft;
}
