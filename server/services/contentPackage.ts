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
Judul Tren adalah ide, bukan klaim tren yang sudah diteliti langsung. Cantumkan TikTok, Reels, dan Shorts sebagai target bila sesuai; jelaskan format 9:16 dan arahan visual/template sederhana. Sertakan tagar dalam caption. Jangan mengklaim video sudah dibuat atau dipublikasikan.`;

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
  return problems;
}
