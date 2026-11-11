export type MarketingBrief = {
  product: 'Siput PAUD' | 'Siput Posyandu';
  audience: string;
  verifiedFeatures: string;
  unavailableFeatures: string;
  priceAndLink: string;
  channels: string;
};

function answer(value: string): string {
  return value.trim() || '[PERLU KONFIRMASI]';
}

export function marketingBriefInstruction(brief: MarketingBrief): string {
  return [
    `Buat bahan marketing untuk produk ${brief.product}.`,
    `Target pengguna/pembeli: ${answer(brief.audience)}`,
    `Fitur yang sudah dikonfirmasi pemilik: ${answer(brief.verifiedFeatures)}`,
    `Fitur yang belum tersedia atau belum dipastikan: ${answer(brief.unavailableFeatures)}`,
    `Harga dan tautan resmi: ${answer(brief.priceAndLink)}`,
    `Kanal tujuan: ${answer(brief.channels)}`,
    '',
    'Siapkan 3 ide konten beserta caption dan hashtag yang relevan, lalu checklist publikasi untuk ditinjau pemilik.',
    'Gunakan hanya informasi terkonfirmasi di atas. Jangan mengarang fitur, harga, tautan, testimoni, hasil, atau klaim dampak. Jangan menyebut fitur yang belum tersedia/sebelum dipastikan sebagai fitur aktif. Tandai informasi yang belum ada dengan [PERLU KONFIRMASI] dan ajukan pertanyaan spesifik kepada pemilik. Jangan menghubungi pelanggan atau memublikasikan konten.',
  ].join('\n');
}
