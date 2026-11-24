export interface DigitalProductChapter {
  heading: string;
  body: string;
}

export interface DigitalProductBuyerContent {
  title: string;
  subtitle: string;
  productType: string;
  targetAudience: string;
  summary: string;
  howToUse: string;
  mainContent: string;
  chapters: DigitalProductChapter[];
}

export interface DigitalProductSellerMetadata {
  listingDescription: string;
  suggestedPrice: string;
  verificationNotes: string;
  extraNotes: string;
}

export interface ParsedDigitalProductPackage {
  buyer: DigitalProductBuyerContent;
  seller: DigitalProductSellerMetadata;
  hasSellerMetadata: boolean;
}

export const DIGITAL_PRODUCT_BUYER_HEADINGS = [
  'Judul Produk',
  'Subjudul',
  'Jenis Produk',
  'Target Pengguna',
  'Ringkasan',
  'Cara Pakai',
  'Isi Produk',
] as const;

export const DIGITAL_PRODUCT_SELLER_HEADINGS = [
  'Metadata & Listing Seller',
  'Deskripsi Listing Lynk.id',
  'Deskripsi Listing Produk',
  'Saran Harga',
  'Batasan dan Catatan Verifikasi',
  'Batasan dan Hal yang Perlu Diverifikasi',
  'Hal yang Perlu Diverifikasi',
  'Catatan Verifikasi',
  'Catatan Internal',
  'Contoh Uji Sintetis',
] as const;

type BuyerKey = 'title' | 'subtitle' | 'productType' | 'targetAudience' | 'summary' | 'howToUse' | 'mainContent';
type SellerKey = 'sellerBanner' | 'listingDescription' | 'suggestedPrice' | 'verificationNotes' | 'extraNotes';
type SectionKey = BuyerKey | SellerKey;

const SECTION_PATTERNS: Array<{ key: SectionKey; pattern: RegExp }> = [
  { key: 'title', pattern: /^judul produk$/i },
  { key: 'subtitle', pattern: /^sub\s*judul(?:\s+produk)?$/i },
  { key: 'productType', pattern: /^jenis produk$/i },
  { key: 'targetAudience', pattern: /^target (?:pengguna|pembeli|audiens)$/i },
  { key: 'summary', pattern: /^(?:ringkasan|tentang produk(?: ini)?|pengantar)$/i },
  { key: 'howToUse', pattern: /^(?:cara pakai|cara menggunakan(?: produk ini)?|panduan penggunaan)$/i },
  { key: 'mainContent', pattern: /^isi produk(?:\s+lengkap|\s+utama)?$/i },
  { key: 'sellerBanner', pattern: /^(?:bagian\s*\d+\s*[-:–—]?\s*)?metadata\s*(?:&|dan)\s*listing\s*seller(?:\s*\(.*\))?$/i },
  { key: 'listingDescription', pattern: /^deskripsi listing(?:\s+lynk\.?id|\s+produk)?$/i },
  { key: 'suggestedPrice', pattern: /^(?:saran|rekomendasi|usulan|strategi)\s+harga(?:\s+jual)?$/i },
  { key: 'verificationNotes', pattern: /^(?:batasan\s*(?:&|dan)\s*)?(?:catatan verifikasi|hal yang perlu diverifikasi)$/i },
  { key: 'verificationNotes', pattern: /^batasan(?:\s+dan\s+catatan)?$/i },
  { key: 'extraNotes', pattern: /^(?:contoh uji sintetis|catatan internal(?:\s+seller|\s+kantor)?|checklist serah[- ]terima(?: manual)?)$/i },
];

const INTERNAL_LINE_PATTERNS: RegExp[] = [
  /^\[PERLU LENGKAPI FORMAT[^\]]*\]$/i,
  /^\[PERLU VERIFIKASI[^\]]*\]$/i,
  /laporan\s+(?:ini\s+)?disampaikan\s+(?:untuk|kepada)\s+(?:ditinjau\s+)?pimpinan/i,
  /draf\s+(?:ini\s+)?(?:disiapkan|disampaikan|tetap)?\s*(?:untuk\s+)?ditinjau\s+pimpinan/i,
  /hasil\s+tetap\s+draf\s+untuk\s+ditinjau\s+pimpinan/i,
  /tinjau\s+dan\s+sesuaikan\s+sebelum\s+dijual/i,
  /belum\s+ada\s+upload\s+otomatis\s+atau\s+koneksi\s+akun\s+lynk/i,
  /^(?:contoh uji sintetis|batasan dan hal yang perlu diverifikasi|batasan dan catatan verifikasi)\s*:/i,
];

const INTERNAL_BANNER_LINE = /^=+\s*bagian\s*\d+\b.*=+$/i;

export function stripInternalDraftPrefix(title: string): string {
  return title
    .trim()
    .replace(/^(?:MVP|Paket|Draf)\s+produk\s+digital\s*[·:–—-]\s*/i, '')
    .replace(/^Produk\s+digital\s*[·:–—-]\s*/i, '')
    .trim();
}

export function sanitizeBuyerText(text: string): string {
  const cleanedLines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      cleanedLines.push('');
      continue;
    }
    if (INTERNAL_BANNER_LINE.test(trimmed)) continue;
    if (INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) continue;

    // Strip inline internal draft notices if accidentally appended mid-paragraph
    const sanitized = rawLine
      .replace(/\(?\s*tinjau\s+dan\s+sesuaikan\s+sebelum\s+dijual\.?\s*\)?/gi, '')
      .replace(/laporan\s+(?:ini\s+)?disampaikan\s+untuk\s+ditinjau\s+pimpinan\.?/gi, '')
      .replace(/hasil\s+tetap\s+draf\s+untuk\s+ditinjau\s+pimpinan\.?/gi, '')
      .replace(/\[PERLU LENGKAPI FORMAT[^\]]*\]/gi, '')
      .replace(/\s+$/g, '');

    if (sanitized.trim()) {
      cleanedLines.push(sanitized);
    }
  }
  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeHeadingCandidate(line: string): string {
  return line
    .trim()
    .replace(/^=+\s*/, '')
    .replace(/\s*=+$/, '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .trim();
}

function matchTopLevelSection(line: string): { key: SectionKey; remainder: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Do not treat markdown table rows or fenced code lines as section headings
  if (trimmed.startsWith('|') || trimmed.startsWith('```')) return null;

  const normalized = normalizeHeadingCandidate(trimmed);
  if (!normalized) return null;

  // Match "Heading: value" or standalone "Heading"
  const colonIdx = normalized.indexOf(':');
  const candidateLabel = colonIdx >= 0 ? normalized.slice(0, colonIdx).trim() : normalized;
  const remainder = colonIdx >= 0 ? normalized.slice(colonIdx + 1).trim() : '';

  for (const { key, pattern } of SECTION_PATTERNS) {
    if (pattern.test(candidateLabel)) {
      return { key, remainder };
    }
  }

  // Also check banner style like "=== METADATA & LISTING SELLER (Khusus Aplikasi) ==="
  if (
    /^=+\s*metadata\s*(?:&|dan)\s*listing\s*seller/i.test(trimmed) ||
    /^#{1,4}\s*(?:bagian\s*\d+\s*[-:–—]?\s*)?metadata\s*(?:&|dan)\s*listing\s*seller/i.test(trimmed)
  ) {
    return { key: 'sellerBanner', remainder: '' };
  }

  return null;
}

function isSellerKey(key: SectionKey | null): key is SellerKey {
  return key === 'sellerBanner' || key === 'listingDescription' || key === 'suggestedPrice' || key === 'verificationNotes' || key === 'extraNotes';
}

function extractChapters(mainContent: string): DigitalProductChapter[] {
  if (!mainContent.trim()) return [];
  const chapters: DigitalProductChapter[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];
  let inCodeFence = false;

  const flush = () => {
    const body = currentLines.join('\n').trim();
    if (currentHeading || body) {
      chapters.push({ heading: currentHeading, body });
    }
    currentLines = [];
  };

  for (const line of mainContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      currentLines.push(line);
      continue;
    }
    if (!inCodeFence) {
      const h2Match = trimmed.match(/^#{1,2}\s+(.+)$/);
      const explicitChapterMatch = trimmed.match(/^(?:\*\*)?(Bab\s+\d+\s*[:.-]\s*.+?)(?:\*\*)?$/i);
      if (h2Match) {
        flush();
        currentHeading = h2Match[1].replace(/\*\*/g, '').trim();
        continue;
      }
      if (explicitChapterMatch) {
        flush();
        currentHeading = explicitChapterMatch[1].replace(/\*\*/g, '').trim();
        continue;
      }
    }
    currentLines.push(line);
  }
  flush();

  return chapters.filter((chapter) => chapter.heading || chapter.body);
}

export function splitDigitalProductPackage(rawContent: string, fallbackTitle = ''): ParsedDigitalProductPackage {
  const buckets: Record<Exclude<SectionKey, 'sellerBanner'>, string[]> = {
    title: [],
    subtitle: [],
    productType: [],
    targetAudience: [],
    summary: [],
    howToUse: [],
    mainContent: [],
    listingDescription: [],
    suggestedPrice: [],
    verificationNotes: [],
    extraNotes: [],
  };

  let current: SectionKey | null = null;
  let inCodeFence = false;

  for (const rawLine of rawContent.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      if (current && current !== 'sellerBanner') {
        buckets[current].push(rawLine);
      }
      continue;
    }

    if (!inCodeFence) {
      // Ignore top-level Part 1 banner lines like "=== BAGIAN 1: ISI PRODUK PEMBELI ==="
      if (/^=+\s*bagian\s*1\b/i.test(trimmed) || /^#{1,3}\s*bagian\s*1\s*[-:–—]/i.test(trimmed)) {
        continue;
      }

      const matched = matchTopLevelSection(rawLine);
      if (matched) {
        // Once we're inside mainContent, keep normal buyer subheadings unless it's a seller/internal section
        const isAllowedSwitch =
          current !== 'mainContent' ||
          isSellerKey(matched.key) ||
          matched.key === 'mainContent';
        if (isAllowedSwitch) {
          current = matched.key;
          if (matched.remainder && current !== 'sellerBanner') {
            buckets[current].push(matched.remainder);
          }
          continue;
        }
      }
    }

    if (current && current !== 'sellerBanner') {
      buckets[current].push(rawLine);
    } else if (current === null && trimmed) {
      // Unstructured pre-heading text defaults to mainContent if not internal
      if (!INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        buckets.mainContent.push(rawLine);
      }
    } else if (current === 'sellerBanner' && trimmed) {
      buckets.extraNotes.push(rawLine);
    }
  }

  const cleanField = (key: Exclude<SectionKey, 'sellerBanner'>, sanitize = true) => {
    const joined = buckets[key].join('\n').trim();
    return sanitize ? sanitizeBuyerText(joined) : joined;
  };

  const parsedTitle = cleanField('title').split(/\r?\n/)[0]?.trim() || stripInternalDraftPrefix(fallbackTitle) || 'Produk Digital';
  const mainContent = cleanField('mainContent');

  const buyer: DigitalProductBuyerContent = {
    title: parsedTitle,
    subtitle: cleanField('subtitle'),
    productType: cleanField('productType'),
    targetAudience: cleanField('targetAudience'),
    summary: cleanField('summary'),
    howToUse: cleanField('howToUse'),
    mainContent,
    chapters: extractChapters(mainContent),
  };

  const seller: DigitalProductSellerMetadata = {
    listingDescription: cleanField('listingDescription', false),
    suggestedPrice: cleanField('suggestedPrice', false),
    verificationNotes: cleanField('verificationNotes', false),
    extraNotes: cleanField('extraNotes', false),
  };

  const hasSellerMetadata = Boolean(
    seller.listingDescription ||
    seller.suggestedPrice ||
    seller.verificationNotes ||
    seller.extraNotes,
  );

  return { buyer, seller, hasSellerMetadata };
}

export function formatBuyerPreviewMarkdown(parsed: ParsedDigitalProductPackage): string {
  const { buyer } = parsed;
  const parts: string[] = [];
  if (buyer.title) parts.push(`Judul Produk: ${buyer.title}`);
  if (buyer.subtitle) parts.push(`Subjudul: ${buyer.subtitle}`);
  if (buyer.productType) parts.push(`Jenis Produk: ${buyer.productType}`);
  if (buyer.targetAudience) parts.push(`Target Pengguna: ${buyer.targetAudience}`);
  if (buyer.summary) parts.push(`Ringkasan:\n${buyer.summary}`);
  if (buyer.howToUse) parts.push(`Cara Pakai:\n${buyer.howToUse}`);
  if (buyer.mainContent) parts.push(`Isi Produk:\n${buyer.mainContent}`);
  return parts.join('\n\n').trim();
}

export function detectPromisedItemCount(title: string): { count: number; unit: string } | null {
  const match = title.match(/\b(\d{1,3})\s+(caption|prompt|template|ide|naskah|skrip|script|judul|hook|hari|checklist|pertanyaan|latihan|studi kasus|surat|formulir|sop)\b/i);
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isInteger(count) || count < 5 || count > 365) return null;
  return { count, unit: match[2].toLowerCase() };
}

export function countNumberedItems(text: string): { count: number; highestNumber: number } {
  const numbers = new Set<number>();
  let highest = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match "1. ...", "1) ...", "### 1. ...", "**1.** ...", "Caption 1:", "Prompt #12 - ...", "Hari 7:", "| 1 | ..."
    const patterns = [
      /^(?:#{1,4}\s*)?(?:\*\*)?(\d{1,3})(?:\*\*)?[.)]\s+\S/,
      /^(?:#{1,4}\s*)?(?:\*\*)?(?:caption|prompt|template|ide|naskah|skrip|script|judul|hook|hari|nomor|no\.?|item|langkah|latihan|soal|modul|dokumen)\s*#?(\d{1,3})\b/i,
      /^\|\s*(\d{1,3})\s*\|/,
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const value = Number(match[1]);
        if (Number.isInteger(value) && value >= 1 && value <= 365) {
          numbers.add(value);
          if (value > highest) highest = value;
          break;
        }
      }
    }
  }

  return { count: numbers.size, highestNumber: highest };
}
