const sections = ['Judul Tren', 'Konsep', 'Hook 3 Detik', 'Naskah Narasi', 'Caption', 'Target Platform', 'Tata Letak Visual', 'Hal yang Perlu Diverifikasi'] as const;

export const contentPackageInstruction = `Siapkan paket konten siap pakai berupa teks, bukan video fisik. Gunakan tepat delapan judul bagian berikut, masing-masing di baris tersendiri, dengan isi yang tidak kosong:
Judul Tren:
Konsep:
Hook 3 Detik:
Naskah Narasi:
Caption:
Target Platform:
Tata Letak Visual:
Hal yang Perlu Diverifikasi:
Judul Tren adalah ide, bukan klaim tren yang sudah diteliti langsung. Sesuaikan kedalaman setiap bagian dengan mandat dan draf sumber; jangan menjawab satu-dua frasa atau mengulang ide yang sama untuk mengisi ruang. Buat hook yang menarik tetapi jujur, naskah narasi utuh dengan tempo wajar (sekitar 2–2,5 kata per detik), dan arahan visual per adegan yang bisa langsung dirakit. Ikuti durasi yang diminta brief; model video dapat mendukung sampai 30 detik. Jangan memadatkan ucapan sampai terdengar terburu-buru. Cantumkan TikTok, Reels, dan Shorts sebagai target bila sesuai; jelaskan format 9:16 dan arahan visual sederhana yang dapat dirakit manual di editor timeline biasa. Hindari alur Script to Video, template berbayar, efek/filter/font/fitur berlabel Pro, dan aset stok berbayar. Utamakan rekaman atau gambar milik sendiri, potongan sederhana, teks dasar, dan narasi sendiri; musik hanya jika pengguna memiliki hak pakai. Jika sebuah aset/fitur meminta upgrade atau berlabel Pro, berikan pengganti sederhana tanpa biaya. Sertakan tagar dalam caption. Jangan mengklaim video sudah dibuat atau dipublikasikan. Jangan menyuruh audiens membeli, memesan lewat DM, atau membuka link di bio kecuali tautan/cara pemesanan resmi diberikan dan diverifikasi dalam brief sumber. Jika belum ada, gunakan ajakan non-transaksional dan tandai cara pemesanan sebagai [PERLU KONFIRMASI].`;

export function contentPackageProblems(content: string): string[] {
  const found = new Map<string, string>();
  let current: string | undefined;
  for (const line of content.split(/\r?\n/)) {
    const normalized = line.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    const heading = sections.find((section) => normalized.toLowerCase().startsWith(`${section.toLowerCase()}:`));
    if (heading) {
      current = heading;
      found.set(heading, `${found.get(heading) ?? ''} ${normalized.slice(heading.length + 1)}`.trim());
    } else if (current) {
      found.set(current, `${found.get(current) ?? ''}\n${line}`.trim());
    }
  }
  const problems: string[] = sections.filter((section) => !found.get(section)?.trim()).map((section) => section);
  if (found.get('Target Platform') && !/\b(tiktok|reels|shorts)\b/i.test(found.get('Target Platform')!)) {
    problems.push('Target Platform (TikTok, Reels, atau Shorts)');
  }
  if (/\b(?:link di bio|beli sekarang|pesan (?:sekarang|lewat|via) (?:dm|wa|whatsapp)|order sekarang)\b/i.test(content) &&
      !/https?:\/\/\S+/i.test(content)) {
    problems.push('Ajakan pembelian tanpa tautan resmi yang diberikan');
  }
  return problems;
}
