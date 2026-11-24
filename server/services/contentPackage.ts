import {
  countNumberedItems,
  detectPromisedItemCount,
  sanitizeBuyerText,
  splitDigitalProductPackage,
} from '../../src/lib/digitalProductContent.js';

export { sanitizeBuyerText, splitDigitalProductPackage };

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

export const digitalProductSystemInstruction = `Anda adalah penulis dan desainer konten produk digital profesional berbahasa Indonesia untuk publikasi siap jual di Lynk.id. Tugas Anda adalah menulis ISI PRODUK DIGITAL UTUH, LENGKAP, DAN LANGSUNG SIAP PAKAI BAGI PEMBELI — bukan blueprint, bukan kerangka singkat, bukan proposal, dan bukan laporan internal untuk pimpinan. Tulis seluruh bagian produk pembeli dengan bahasa editorial yang bersih, ramah, praktis, dan langsung menyapa pembeli. Pisahkan seluruh informasi khusus penjual (deskripsi listing Lynk.id, saran harga, dan catatan verifikasi seller) ke dalam blok METADATA & LISTING SELLER di bagian paling akhir sehingga tidak pernah ikut tercetak di file PDF pembeli. Jangan pernah menuliskan catatan internal seperti "Contoh Uji Sintetis", "Batasan dan Hal yang Perlu Diverifikasi", "Laporan disampaikan untuk ditinjau pimpinan", atau "Tinjau dan sesuaikan sebelum dijual" di dalam isi produk pembeli. Jangan mengarang testimoni pembeli atau menjanjikan pendapatan pasti.`;

export const digitalProductPackageInstruction = `Susun satu PAKET PRODUK DIGITAL SIAP JUAL untuk pembeli di Lynk.id — BUKAN blueprint, bukan kerangka, dan bukan draf laporan internal.

WAJIB gunakan tepat dua bagian terpisah berikut secara berurutan:

=== BAGIAN 1: ISI PRODUK PEMBELI (DICETAK KE PDF) ===
Judul Produk:
Subjudul:
Jenis Produk:
Target Pengguna:
Ringkasan:
Cara Pakai:
Isi Produk:

=== METADATA & LISTING SELLER ===
Deskripsi Listing Lynk.id:
Saran Harga:
Batasan dan Catatan Verifikasi:

ATURAN WAJIB BAGIAN 1 (ISI PRODUK PEMBELI — MASUK PDF):
1. Tulis ISI PRODUK UTUH DAN LENGKAP sesuai seluruh janji yang tertera pada Judul Produk dan konsep terpilih. DILARANG menulis hanya kerangka, ringkasan, placeholder, atau sekadar 1–2 contoh sintetis.
2. Jika judul atau konsep menjanjikan jumlah item tertentu (misalnya 30 caption, 20 prompt, 14 hari kalender, atau 10 template), WAJIB menuliskan seluruh item secara lengkap bernomor urut 1 sampai jumlah penuh (misalnya 1 sampai 30) siap pakai. DILARANG memotong daftar dengan "dst.", "...", "ulangi pola yang sama", atau "[isi sendiri di sini]".
3. Sesuaikan format isi dengan jenis produk:
   - Kit konten / sosial media: tulis seluruh caption lengkap bernomor 1–30 (atau jumlah penuh yang dijanjikan) siap salin-tempel, panduan/grid kalender konten lengkap berbentuk tabel markdown, dan daftar prompt/ide lengkap.
   - Panduan/workbook/ebook: tulis seluruh bab secara penuh, langkah praktis, lembar kerja, dan daftar periksa siap pakai.
   - Template / naskah dokumen: tulis naskah dokumen utuh dan struktur tabel/kolom lengkap siap pakai pembeli.
   - Koleksi prompt / workflow: tulis seluruh prompt lengkap siap salin beserta panduan parameter pemakaian.
4. Bagi bagian Isi Produk menjadi bab yang rapi menggunakan judul markdown "## Bab 1: ...", "## Bab 2: ...", dst., dan gunakan tabel markdown ("| Kolom | ... |") bila menyajikan jadwal/grid/lembar kerja agar tata letak PDF rapi dan profesional.
5. Gunakan bahasa profesional langsung untuk pembeli/pembaca. DILARANG keras mencantumkan kalimat atau bagian internal kantor seperti "Contoh Uji Sintetis", "Batasan dan Hal yang Perlu Diverifikasi", "Laporan disampaikan untuk ditinjau pimpinan", "draf untuk ditinjau pimpinan", atau "Tinjau dan sesuaikan sebelum dijual" di dalam Bagian 1.

ATURAN WAJIB BAGIAN 2 (METADATA & LISTING SELLER — HANYA DI PANEL PRATINJAU APLIKASI, TIDAK DICETAK KE PDF):
1. Deskripsi Listing Lynk.id: tulis deskripsi halaman penjualan Lynk.id yang menjelaskan isi nyata produk, jumlah aset yang didapat, target pembeli, dan format PDF tanpa klaim testimoni fiktif, permintaan pasar palsu, atau janji pendapatan. Jangan menyuruh audiens membeli atau mengarahkan ke link di bio kecuali tautan pemesanan resmi diberikan.
2. Saran Harga: tuliskan rentang saran harga jual dalam Rupiah beserta rasional singkat, tandai jelas sebagai saran/hipotesis untuk pemilik.
3. Batasan dan Catatan Verifikasi: tuliskan catatan khusus pemilik/seller tentang hal yang perlu dicek sebelum diunggah manual ke Lynk.id (bagian ini HANYA tampil di UI aplikasi dan TIDAK PERNAH dicetak ke file PDF pembeli).`;

const PLACEHOLDER_SHORTCUT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'placeholder/singkatan daftar di Isi Produk', pattern: /\b(?:dan\s+seterusnya\s+(?:sampai|hingga)|dst\.?\s*(?:sampai|hingga)|ulangi\s+pola\s+(?:yang\s+sama|di\s+atas)|lanjutkan\s+(?:sampai|hingga)\s+(?:nomor|hari|item)?\s*\d+)\b/i },
  { label: 'placeholder kosong di Isi Produk', pattern: /\[(?:isi\s+(?:sendiri|caption|konten|teks|prompt|template)\s+di\s+sini|tulis\s+(?:caption|isi|konten)\s+di\s+sini|placeholder[^\]]*|masukkan\s+isi\s+di\s+sini)\]/i },
];

const INTERNAL_LEAK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'bagian/teks internal Contoh Uji Sintetis', pattern: /contoh\s+uji\s+sintetis/i },
  { label: 'teks internal Laporan disampaikan untuk ditinjau pimpinan', pattern: /laporan\s+(?:ini\s+)?disampaikan\s+(?:untuk|kepada)\s+(?:ditinjau\s+)?pimpinan/i },
  { label: 'watermark internal Tinjau dan sesuaikan sebelum dijual', pattern: /tinjau\s+dan\s+sesuaikan\s+sebelum\s+dijual/i },
];

function extractRawBuyerSection(content: string): string {
  const sellerMarkerIndex = content.search(
    /^\s*(?:[=#*_.\d\s-]*)(?:bagian\s*\d+\s*[-:–—]?\s*)?(?:metadata\s*(?:&|dan)\s*listing\s*seller\b|deskripsi listing(?:\s+lynk\.?id|\s+produk)?\s*:)/im,
  );
  return sellerMarkerIndex >= 0 ? content.slice(0, sellerMarkerIndex) : content;
}

export function digitalProductPackageProblems(content: string): string[] {
  const parsed = splitDigitalProductPackage(content);
  const problems: string[] = [];

  if (!parsed.buyer.title || !/^\s*(?:[#*_.\d\s-]*)judul produk\s*:/im.test(content)) {
    problems.push('Judul Produk');
  }
  if (!parsed.buyer.productType) problems.push('Jenis Produk');
  if (!parsed.buyer.targetAudience) problems.push('Target Pengguna');
  if (!parsed.buyer.summary) problems.push('Ringkasan');
  if (!parsed.buyer.howToUse) problems.push('Cara Pakai');
  if (!parsed.buyer.mainContent) problems.push('Isi Produk');

  if (!parsed.seller.listingDescription) problems.push('Deskripsi Listing Lynk.id');
  if (!parsed.seller.suggestedPrice) problems.push('Saran Harga');
  if (!parsed.seller.verificationNotes) problems.push('Batasan dan Catatan Verifikasi');

  const rawBuyerBlock = extractRawBuyerSection(content);
  for (const { label, pattern } of INTERNAL_LEAK_PATTERNS) {
    if (pattern.test(rawBuyerBlock)) {
      problems.push(label);
    }
  }
  if (/^\s*(?:[#*_.\d\s-]*)contoh\s+uji\s+sintetis\s*:/im.test(content)) {
    if (!problems.includes('bagian/teks internal Contoh Uji Sintetis')) {
      problems.push('bagian/teks internal Contoh Uji Sintetis');
    }
  }

  for (const { label, pattern } of PLACEHOLDER_SHORTCUT_PATTERNS) {
    if (pattern.test(parsed.buyer.mainContent)) {
      problems.push(label);
    }
  }

  const promised = detectPromisedItemCount(parsed.buyer.title);
  if (promised && parsed.buyer.mainContent) {
    const counted = countNumberedItems(parsed.buyer.mainContent);
    if (counted.count < promised.count) {
      problems.push(`Isi Produk belum lengkap (ditemukan ${counted.count} dari ${promised.count} ${promised.unit} yang dijanjikan judul)`);
    }
  }

  return problems;
}

export function contentPackageProblems(content: string, sourceInstruction?: string): string[] {
  const found = new Map<string, string>();
  let current: string | undefined;
  for (const line of content.split(/\r?\n/)) {
    const normalized = line
      .trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .replace(/[*_`]+/g, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
      .trim();
    const heading = sections.find((section) => {
      const lowerNorm = normalized.toLowerCase();
      const lowerSec = section.toLowerCase();
      return lowerNorm === lowerSec || lowerNorm.startsWith(`${lowerSec}:`) || lowerNorm.startsWith(`${lowerSec} :`);
    });
    if (heading) {
      current = heading;
      const remainder = normalized.slice(heading.length).replace(/^\s*:\s*/, '').trim();
      if (remainder) {
        found.set(heading, `${found.get(heading) ?? ''} ${remainder}`.trim());
      } else if (!found.has(heading)) {
        found.set(heading, '');
      }
    } else if (current) {
      found.set(current, `${found.get(current) ?? ''}\n${line}`.trim());
    }
  }
  const problems: string[] = sections.filter((section) => !found.get(section)?.trim()).map((section) => section);
  if (found.get('Target Platform') && !/\b(tiktok|reels|shorts)\b/i.test(found.get('Target Platform')!)) {
    problems.push('Target Platform (TikTok, Reels, atau Shorts)');
  }
  const hasVerifiedContact = (text?: string) => Boolean(text && (/https?:\/\/\S+/i.test(text) || /(?:\+62|62|0)8\d[\d\s-]{7,13}/.test(text)));
  if (/\b(?:link di bio|beli sekarang|pesan (?:sekarang|lewat|via) (?:dm|wa|whatsapp)|order sekarang)\b/i.test(content) &&
      !hasVerifiedContact(content) && !hasVerifiedContact(sourceInstruction)) {
    problems.push('Ajakan pembelian tanpa tautan resmi yang diberikan');
  }
  return problems;
}
