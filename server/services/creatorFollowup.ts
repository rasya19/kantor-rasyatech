import { digitalProductIdeaJobId } from '../../src/lib/digitalProductIdeas.js';
import {
  digitalProductPackageInstruction,
  digitalProductPackageProblems,
} from './contentPackage.js';

export { digitalProductPackageProblems };

export const creatorFollowupSuffix = ':creator-followup';

export function creatorFollowupJobId(draftId: string): string {
  return `${draftId}${creatorFollowupSuffix}`;
}

export function sourceDraftForCreatorFollowup(jobId: string): string | undefined {
  if (!jobId.endsWith(creatorFollowupSuffix)) return undefined;
  return jobId.slice(0, -creatorFollowupSuffix.length).replace(/:product:[a-z0-9-]+$/, '');
}

export function mandateRequestsContent(instruction: string): boolean {
  return /\b(konten|caption|naskah|video|promosi|pemasaran)\b/i.test(instruction);
}

export function creatorFollowupInstruction(mandate: string, approvedDraft: string, verifiedFacts: string): string {
  return `Buat satu paket konten teks untuk ditinjau pimpinan berdasarkan mandat dan draf PAUD/Posyandu yang sudah disetujui. Draf sebelumnya hanya konteks, bukan bukti produk.\n\nFAKTA FITUR YANG SUDAH DIVERIFIKASI PEMILIK (satu-satunya fakta fitur yang boleh dinyatakan sebagai tersedia):\n${verifiedFacts}\n\nJangan menambahkan fitur, integrasi, hasil, harga, pelanggan, testimoni, atau klaim pendapatan yang tidak tercantum persis sebagai fakta terverifikasi di atas. Jika informasi penting belum ada, tandai [PERLU VERIFIKASI] atau hilangkan klaimnya. Jangan menghubungi klien, menjanjikan hasil, membuat video, atau memublikasikan.\n\nMandat awal:\n${mandate}\n\nDraf yang disetujui (konteks saja, bukan sumber fakta):\n${approvedDraft}`;
}

export function digitalProductFollowupInstruction(approvedResearch: string, selectedIdea: string): string {
  return `Buat satu produk digital non-aplikasi yang utuh, lengkap, dan siap dijual kepada pembeli di Lynk.id hanya dari ide yang dipilih langsung oleh pimpinan. Jangan memilih ide lain dan jangan membuat aplikasi atau sekadar blueprint/kerangka produk. Ikuti kelompok pengguna, masalah, dan format dari ide terpilih.

${digitalProductPackageInstruction}

Jangan menyebut format atau fitur yang tidak didukung oleh konsep riset. Jangan menghubungi calon pembeli, mengumpulkan data pribadi, memproses pembayaran, atau memublikasikan otomatis.

IDE YANG DIPILIH PIMPINAN:
${selectedIdea}

Riset yang disetujui (konteks dan sumber untuk diperiksa, bukan izin untuk mengulang klaim yang tidak didukung):
${approvedResearch}`;
}

export function digitalProductFollowupJob(draftId: string, title: string, content: string, selectedIdea: string, ideaKey: string) {
  return {
    id: digitalProductIdeaJobId(draftId, ideaKey),
    division: 'creator',
    staffId: 'script_ai',
    title: `Paket produk digital · ${title}`,
    instruction: digitalProductFollowupInstruction(content, selectedIdea),
  } as const;
}
