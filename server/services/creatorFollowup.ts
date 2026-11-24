import { digitalProductIdeaJobId } from '../../src/lib/digitalProductIdeas.js';

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
  return `Buat satu MVP produk digital non-aplikasi yang konkret dan lengkap hanya dari ide yang dipilih langsung oleh pimpinan. Jangan memilih ide lain dan jangan membuat aplikasi atau hanya mengusulkan rencana produk. Ikuti kelompok pengguna, masalah, dan format dari ide terpilih. Isi produk harus cukup lengkap untuk diuji oleh pemilik dan disesuaikan sebelum dijual. Gunakan tepat struktur berikut:
Judul Produk:
Jenis Produk:
Target Pengguna:
Ringkasan:
Cara Pakai:
Isi Produk:
Contoh Uji Sintetis:
Batasan dan Hal yang Perlu Diverifikasi:
Deskripsi Listing Produk:

Sesuaikan Isi Produk dengan formatnya: lengkapi template dengan kolom dan contoh rekaan; panduan/workbook dengan isi dan latihan; kit konten dengan aset teks yang dapat diedit; prompt/workflow dengan instruksi siap pakai dan placeholder; atau materi belajar dengan urutan dan kegiatan yang sesuai. Jangan menyebut format atau fitur yang tidak didukung oleh konsep riset. Isi contoh hanya data sintetis/non-pribadi dan beri label demonstrasi, bukan hasil/testimoni pembeli. Deskripsi listing harus menjelaskan isi nyata tanpa klaim permintaan, hasil, pendapatan, atau pembeli yang tidak terverifikasi. Jangan menetapkan harga tanpa dasar; tandai sebagai hipotesis bila hanya usulan. Jangan menyebut produk tersedia untuk dibeli atau mengarahkan ke link di bio kecuali tautan pemesanan resmi diberikan. Jangan menghubungi calon pembeli, mengumpulkan data pribadi, memproses pembayaran, atau memublikasikan. Hasil tetap draf untuk ditinjau pimpinan.

IDE YANG DIPILIH PIMPINAN:
${selectedIdea}\n\nRiset yang disetujui (konteks dan sumber untuk diperiksa, bukan izin untuk mengulang klaim yang tidak didukung):\n${approvedResearch}`;
}

export function digitalProductPackageProblems(content: string): string[] {
  const normalized = content.replace(/\*\*/g, '');
  const problems: string[] = [];
  for (const section of ['Judul Produk', 'Jenis Produk', 'Target Pengguna', 'Ringkasan', 'Cara Pakai', 'Isi Produk', 'Contoh Uji Sintetis', 'Batasan dan Hal yang Perlu Diverifikasi', 'Deskripsi Listing Produk']) {
    if (!new RegExp(`^\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*\\S`, 'im').test(normalized)) problems.push(section);
  }
  return problems;
}

export function digitalProductFollowupJob(draftId: string, title: string, content: string, selectedIdea: string, ideaKey: string) {
  return {
    id: digitalProductIdeaJobId(draftId, ideaKey),
    division: 'creator',
    staffId: 'script_ai',
    title: `MVP produk digital · ${title}`,
    instruction: digitalProductFollowupInstruction(content, selectedIdea),
  } as const;
}
