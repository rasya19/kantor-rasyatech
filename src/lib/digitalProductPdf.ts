import { jsPDF } from 'jspdf';
import {
  splitDigitalProductPackage,
  stripInternalDraftPrefix,
  type DigitalProductChapter,
} from './digitalProductContent.js';

type RGB = [number, number, number];

const COLORS = {
  deepTeal: [15, 76, 76] as RGB,
  accentTeal: [13, 148, 136] as RGB,
  emerald: [16, 185, 129] as RGB,
  softTint: [240, 253, 250] as RGB,
  slateTint: [248, 250, 252] as RGB,
  mintText: [204, 251, 241] as RGB,
  inkDark: [15, 23, 42] as RGB,
  inkBody: [51, 65, 85] as RGB,
  inkMuted: [100, 116, 139] as RGB,
  border: [203, 213, 225] as RGB,
  hairline: [226, 232, 240] as RGB,
  white: [255, 255, 255] as RGB,
};

function safeFilename(title: string): string {
  const cleanTitle = stripInternalDraftPrefix(title);
  const slug = cleanTitle
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${slug || 'produk-digital'}.pdf`;
}

function pdfSafeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•·▪▸►]/g, '-')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/[✓✔☑✅]/g, '[v]')
    .replace(/[✗✘☒❌]/g, '[x]')
    .replace(/[^\x20-\x7e\r\n\t]/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

function stripInlineMarkdown(value: string): string {
  return pdfSafeText(
    value
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*/g, ''),
  );
}

function parseMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => stripInlineMarkdown(cell.trim()));
}

function isMarkdownTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return false;
  const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = stripped.split('|').map((c) => c.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

export function createDigitalProductPdf(title: string, content: string): { pdf: jsPDF; filename: string } {
  const parsed = splitDigitalProductPackage(content, title);
  const { buyer } = parsed;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const usableWidth = pageWidth - margin * 2;
  const contentTop = 26;
  const contentBottom = pageHeight - 20;

  const displayTitle = pdfSafeText(buyer.title || stripInternalDraftPrefix(title) || 'Produk Digital').trim() || 'Produk Digital';
  const displaySubtitle = pdfSafeText(buyer.subtitle).trim();
  const displayType = pdfSafeText(buyer.productType || 'EDISI DIGITAL SIAP PAKAI').trim();
  const displayAudience = pdfSafeText(buyer.targetAudience).trim();
  const displaySummary = stripInlineMarkdown(buyer.summary).trim();
  const displayHowToUse = buyer.howToUse.trim();

  pdf.setProperties({
    title: displayTitle,
    subject: 'Produk Digital Siap Pakai',
    creator: 'Rasyatech Digital',
  });

  // ==========================================
  // PAGE 1: COMMERCIAL EDITORIAL COVER PAGE
  // ==========================================
  const heroHeight = 116;
  pdf.setFillColor(...COLORS.deepTeal);
  pdf.rect(0, 0, pageWidth, heroHeight, 'F');

  // Top emerald accent bar
  pdf.setFillColor(...COLORS.emerald);
  pdf.rect(0, 0, pageWidth, 4.5, 'F');

  // Subtle decorative bottom accent bar of hero
  pdf.setFillColor(...COLORS.accentTeal);
  pdf.rect(0, heroHeight - 2.5, pageWidth, 2.5, 'F');

  // Category eyebrow
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...COLORS.mintText);
  pdf.text(displayType.toUpperCase().slice(0, 64), margin, 26);

  // Decorative short rule under eyebrow
  pdf.setFillColor(...COLORS.emerald);
  pdf.rect(margin, 30, 22, 1.2, 'F');

  // Main cover title (auto-size for long titles)
  const titleFontSize = displayTitle.length > 58 ? 20 : displayTitle.length > 36 ? 23 : 26;
  const titleLineHeight = titleFontSize * 0.44;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(titleFontSize);
  pdf.setTextColor(...COLORS.white);
  const coverTitleLines = pdf.splitTextToSize(displayTitle, usableWidth) as string[];
  pdf.text(coverTitleLines.slice(0, 4), margin, 46);

  let heroCursorY = 46 + Math.min(coverTitleLines.length, 4) * titleLineHeight + 4;

  // Subtitle on cover
  if (displaySubtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11.5);
    pdf.setTextColor(...COLORS.mintText);
    const subLines = pdf.splitTextToSize(displaySubtitle, usableWidth) as string[];
    pdf.text(subLines.slice(0, 3), margin, Math.min(heroCursorY, heroHeight - 16));
  }

  // Lower cover editorial cards
  let coverY = heroHeight + 18;

  if (displayAudience) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    const audienceLines = pdf.splitTextToSize(stripInlineMarkdown(displayAudience), usableWidth - 16) as string[];
    const cardHeight = 14 + audienceLines.length * 5.2 + 6;
    pdf.setFillColor(...COLORS.softTint);
    pdf.setDrawColor(...COLORS.border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, coverY, usableWidth, cardHeight, 2.5, 2.5, 'FD');
    pdf.setFillColor(...COLORS.accentTeal);
    pdf.rect(margin, coverY, 2.5, cardHeight, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...COLORS.accentTeal);
    pdf.text('DIRANCANG KHUSUS UNTUK', margin + 8, coverY + 8.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...COLORS.inkDark);
    pdf.text(audienceLines, margin + 8, coverY + 15);
    coverY += cardHeight + 10;
  }

  const titledChapters = buyer.chapters.filter((ch) => ch.heading.trim().length > 0);
  if (titledChapters.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.deepTeal);
    pdf.text('IKHTISAR MATERI DI DALAM PANDUAN INI', margin, coverY + 4);
    coverY += 9;

    const previewChapters = titledChapters.slice(0, 6);
    for (let idx = 0; idx < previewChapters.length; idx++) {
      if (coverY > pageHeight - 42) break;
      const chapterNum = String(idx + 1).padStart(2, '0');
      const chapterHeading = stripInlineMarkdown(previewChapters[idx].heading);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...COLORS.accentTeal);
      pdf.text(chapterNum, margin, coverY);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...COLORS.inkBody);
      const wrappedHeading = pdf.splitTextToSize(chapterHeading, usableWidth - 12) as string[];
      pdf.text(wrappedHeading[0] ?? chapterHeading, margin + 10, coverY);
      coverY += 6.2;
    }
    if (titledChapters.length > 6) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(...COLORS.inkMuted);
      pdf.text(`+ ${titledChapters.length - 6} bagian tambahan lainnya di dalam dokumen ini`, margin + 10, coverY);
    }
  } else if (displaySummary) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...COLORS.deepTeal);
    pdf.text('TENTANG PRODUK INI', margin, coverY + 4);
    coverY += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...COLORS.inkBody);
    const coverSummaryLines = pdf.splitTextToSize(displaySummary, usableWidth) as string[];
    pdf.text(coverSummaryLines.slice(0, 8), margin, coverY);
  }

  // Clean commercial cover bottom imprint (ZERO draft/review notices)
  pdf.setDrawColor(...COLORS.hairline);
  pdf.setLineWidth(0.35);
  pdf.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.deepTeal);
  pdf.text('Edisi Digital Siap Pakai', margin, pageHeight - 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLORS.inkMuted);
  pdf.text('Format PDF - Praktis & Terstruktur', pageWidth - margin, pageHeight - 16, { align: 'right' });

  // ==========================================
  // CONTENT PAGINATION HELPERS (PAGE 2+)
  // ==========================================
  let y = contentTop;

  const addContentPage = () => {
    pdf.addPage();
    y = contentTop;
  };

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > contentBottom) {
      addContentPage();
    }
  };

  const drawSectionLabel = (eyebrow: string, heading: string, forceNewPage = false) => {
    if (forceNewPage && y > contentTop + 6) {
      addContentPage();
    } else {
      ensureSpace(26);
    }

    if (eyebrow) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...COLORS.accentTeal);
      pdf.text(pdfSafeText(eyebrow).toUpperCase(), margin, y);
      y += 5.5;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14.5);
    pdf.setTextColor(...COLORS.deepTeal);
    const lines = pdf.splitTextToSize(stripInlineMarkdown(heading), usableWidth) as string[];
    pdf.text(lines, margin, y);
    y += lines.length * 6.4 + 2;

    pdf.setDrawColor(...COLORS.accentTeal);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y, margin + 28, y);
    pdf.setDrawColor(...COLORS.hairline);
    pdf.setLineWidth(0.25);
    pdf.line(margin + 28, y, pageWidth - margin, y);
    y += 7;
  };

  const renderBodyLines = (text: string) => {
    const lines = text.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const raw = lines[i];
      const trimmed = raw.trim();

      if (!trimmed) {
        y += 2.5;
        i++;
        continue;
      }

      // 1. Fenced code / prompt box
      if (trimmed.startsWith('```')) {
        const blockLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          blockLines.push(pdfSafeText(lines[i]));
          i++;
        }
        if (i < lines.length) i++; // skip closing fence

        const wrappedBoxLines: string[] = [];
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(9);
        for (const bl of blockLines) {
          const split = bl.trim() ? (pdf.splitTextToSize(bl, usableWidth - 12) as string[]) : [''];
          wrappedBoxLines.push(...split);
        }

        // Render box in chunks that fit pages cleanly
        let offset = 0;
        while (offset < wrappedBoxLines.length) {
          const availableMm = contentBottom - y - 8;
          const maxLinesOnPage = Math.max(3, Math.floor(availableMm / 4.6));
          if (availableMm < 18) {
            addContentPage();
            continue;
          }
          const chunk = wrappedBoxLines.slice(offset, offset + maxLinesOnPage);
          const boxHeight = chunk.length * 4.6 + 8;

          pdf.setFillColor(...COLORS.slateTint);
          pdf.setDrawColor(...COLORS.border);
          pdf.setLineWidth(0.25);
          pdf.roundedRect(margin, y, usableWidth, boxHeight, 1.5, 1.5, 'FD');
          pdf.setFillColor(...COLORS.accentTeal);
          pdf.rect(margin, y, 2, boxHeight, 'F');

          pdf.setFont('courier', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(...COLORS.inkDark);
          let lineY = y + 5.8;
          for (const chunkLine of chunk) {
            pdf.text(chunkLine, margin + 6, lineY);
            lineY += 4.6;
          }
          y += boxHeight + 4;
          offset += chunk.length;
        }
        continue;
      }

      // 2. Markdown table / grid
      if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        const tableRows: string[][] = [];
        let hasHeader = false;

        const firstRow = parseMarkdownTableRow(trimmed);
        tableRows.push(firstRow);
        i++;

        if (i < lines.length && isMarkdownTableSeparator(lines[i])) {
          hasHeader = true;
          i++;
        }
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          if (!isMarkdownTableSeparator(lines[i])) {
            tableRows.push(parseMarkdownTableRow(lines[i]));
          }
          i++;
        }

        const colCount = Math.max(1, ...tableRows.map((r) => r.length));
        const colWidths: number[] = [];
        // Give narrow width to first column if it looks like a short number column ("No", "Hari", "1", "2")
        const firstColLooksNumeric =
          colCount >= 3 &&
          tableRows.every((row, rIdx) => {
            const cell = (row[0] ?? '').trim();
            return rIdx === 0 ? cell.length <= 6 : /^\d{1,3}$/.test(cell) || cell.length <= 8;
          });
        if (firstColLooksNumeric) {
          const firstW = 16;
          const restW = (usableWidth - firstW) / (colCount - 1);
          colWidths.push(firstW);
          for (let c = 1; c < colCount; c++) colWidths.push(restW);
        } else {
          const equalW = usableWidth / colCount;
          for (let c = 0; c < colCount; c++) colWidths.push(equalW);
        }

        const drawTableRow = (cells: string[], isHeaderRow: boolean, rowIdx: number) => {
          pdf.setFont('helvetica', isHeaderRow ? 'bold' : 'normal');
          pdf.setFontSize(isHeaderRow ? 8.8 : 8.5);
          const wrappedCells = Array.from({ length: colCount }, (_, colIdx) => {
            const cellText = cells[colIdx] ?? '';
            return pdf.splitTextToSize(cellText, Math.max(8, colWidths[colIdx] - 4)) as string[];
          });
          const maxCellLines = Math.max(1, ...wrappedCells.map((wc) => wc.length));
          const rowHeight = maxCellLines * 4.3 + 4.4;

          if (y + rowHeight > contentBottom) {
            addContentPage();
            if (hasHeader && !isHeaderRow) {
              drawTableRow(tableRows[0], true, 0);
            }
          }

          if (isHeaderRow) {
            pdf.setFillColor(...COLORS.deepTeal);
            pdf.rect(margin, y, usableWidth, rowHeight, 'F');
          } else if (rowIdx % 2 === 1) {
            pdf.setFillColor(...COLORS.slateTint);
            pdf.rect(margin, y, usableWidth, rowHeight, 'F');
          }

          pdf.setDrawColor(...COLORS.border);
          pdf.setLineWidth(0.2);
          pdf.rect(margin, y, usableWidth, rowHeight, 'S');

          let x = margin;
          pdf.setFont('helvetica', isHeaderRow ? 'bold' : 'normal');
          pdf.setFontSize(isHeaderRow ? 8.8 : 8.5);
          pdf.setTextColor(...(isHeaderRow ? COLORS.white : COLORS.inkBody));

          for (let colIdx = 0; colIdx < colCount; colIdx++) {
            if (colIdx > 0) {
              pdf.line(x, y, x, y + rowHeight);
            }
            const linesInCell = wrappedCells[colIdx];
            let cellY = y + 4.6;
            for (const cl of linesInCell) {
              pdf.text(cl, x + 2, cellY);
              cellY += 4.3;
            }
            x += colWidths[colIdx];
          }
          y += rowHeight;
        };

        ensureSpace(20);
        for (let r = 0; r < tableRows.length; r++) {
          drawTableRow(tableRows[r], hasHeader && r === 0, r);
        }
        y += 4.5;
        continue;
      }

      // 3. Horizontal rule
      if (/^[-*_]{3,}$/.test(trimmed)) {
        ensureSpace(6);
        pdf.setDrawColor(...COLORS.hairline);
        pdf.setLineWidth(0.35);
        pdf.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
        y += 5;
        i++;
        continue;
      }

      // 4. Subheading (### or ####)
      const subHeadingMatch = trimmed.match(/^#{3,6}\s+(.+)$/);
      if (subHeadingMatch) {
        ensureSpace(18);
        y += 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11.5);
        pdf.setTextColor(...COLORS.deepTeal);
        const wrapped = pdf.splitTextToSize(stripInlineMarkdown(subHeadingMatch[1]), usableWidth) as string[];
        for (const wl of wrapped) {
          ensureSpace(6);
          pdf.text(wl, margin, y);
          y += 5.6;
        }
        y += 1.5;
        i++;
        continue;
      }

      // 5. Blockquote (> ...)
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(stripInlineMarkdown(lines[i].trim().replace(/^>\s*/, '')));
          i++;
        }
        const quoteText = quoteLines.join(' ').trim();
        if (quoteText) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(9.8);
          const wrapped = pdf.splitTextToSize(quoteText, usableWidth - 12) as string[];
          const boxHeight = wrapped.length * 5 + 6;
          ensureSpace(Math.min(boxHeight + 4, 40));
          if (y + boxHeight <= contentBottom) {
            pdf.setFillColor(...COLORS.softTint);
            pdf.rect(margin, y, usableWidth, boxHeight, 'F');
            pdf.setFillColor(...COLORS.accentTeal);
            pdf.rect(margin, y, 2, boxHeight, 'F');
            pdf.setTextColor(...COLORS.inkBody);
            let qy = y + 5.2;
            for (const wl of wrapped) {
              pdf.text(wl, margin + 6, qy);
              qy += 5;
            }
            y += boxHeight + 3.5;
          } else {
            pdf.setTextColor(...COLORS.inkBody);
            for (const wl of wrapped) {
              ensureSpace(6);
              pdf.text(wl, margin + 5, y);
              y += 5;
            }
            y += 2;
          }
        }
        continue;
      }

      // 6. Numbered item (e.g. "1. ...", "Caption 1: ...", "Prompt 12: ...")
      const numberedMatch = trimmed.match(/^(?:\*\*)?(\d{1,3}[.)]|(?:Caption|Prompt|Template|Hari|Ide|Naskah|Langkah|Checklist|Dokumen|Modul)\s*#?\d{1,3}\s*[:.-]?)(?:\*\*)?\s*(.*)$/i);
      if (numberedMatch) {
        const prefix = stripInlineMarkdown(numberedMatch[1]);
        const rest = stripInlineMarkdown(numberedMatch[2]);
        ensureSpace(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(...COLORS.inkDark);

        const fullLine = rest ? `${prefix} ${rest}` : prefix;
        const isShortTitleLine = rest.length <= 95 && !rest.includes('. ');

        if (isShortTitleLine) {
          const wrapped = pdf.splitTextToSize(fullLine, usableWidth) as string[];
          for (const wl of wrapped) {
            ensureSpace(5.5);
            pdf.text(wl, margin, y);
            y += 5.2;
          }
        } else {
          // Print bold prefix + wrapped body cleanly
          const prefixWidth = Math.min(pdf.getTextWidth(`${prefix} `) + 1, 34);
          pdf.text(prefix, margin, y);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...COLORS.inkBody);
          const wrappedRest = pdf.splitTextToSize(rest, usableWidth - prefixWidth) as string[];
          for (let idx = 0; idx < wrappedRest.length; idx++) {
            if (idx > 0) ensureSpace(5.5);
            pdf.text(wrappedRest[idx], margin + prefixWidth, y);
            y += 5.1;
          }
        }
        y += 1.4;
        i++;
        continue;
      }

      // 7. Bullet item
      const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        const itemText = stripInlineMarkdown(bulletMatch[1]);
        ensureSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(...COLORS.accentTeal);
        pdf.text('-', margin + 2, y);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(...COLORS.inkBody);
        const wrapped = pdf.splitTextToSize(itemText, usableWidth - 8) as string[];
        for (const wl of wrapped) {
          ensureSpace(5.5);
          pdf.text(wl, margin + 7, y);
          y += 5.1;
        }
        y += 0.8;
        i++;
        continue;
      }

      // 8. Bold key-value sub-line (e.g. "**Hook:** ...", "CTA: ...")
      const labelMatch = trimmed.match(/^(?:\*\*)?([A-Za-z0-9 /&()-]{2,34})(?:\*\*)?\s*:\s+(.+)$/);
      if (labelMatch) {
        const labelText = `${stripInlineMarkdown(labelMatch[1])}:`;
        const valText = stripInlineMarkdown(labelMatch[2]);
        ensureSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.8);
        pdf.setTextColor(...COLORS.inkDark);
        const labelW = pdf.getTextWidth(`${labelText} `);
        if (labelW < usableWidth * 0.4) {
          pdf.text(labelText, margin, y);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...COLORS.inkBody);
          const firstLineMax = usableWidth - labelW;
          const restLines = pdf.splitTextToSize(valText, firstLineMax) as string[];
          pdf.text(restLines[0] ?? '', margin + labelW, y);
          y += 5.1;
          if (restLines.length > 1) {
            const overflow = pdf.splitTextToSize(restLines.slice(1).join(' '), usableWidth) as string[];
            for (const ol of overflow) {
              ensureSpace(5.5);
              pdf.text(ol, margin, y);
              y += 5.1;
            }
          }
        } else {
          const combined = pdf.splitTextToSize(`${labelText} ${valText}`, usableWidth) as string[];
          for (const cl of combined) {
            ensureSpace(5.5);
            pdf.text(cl, margin, y);
            y += 5.1;
          }
        }
        y += 0.8;
        i++;
        continue;
      }

      // 9. Regular paragraph
      const cleanedParagraph = stripInlineMarkdown(trimmed);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.inkBody);
      const wrapped = pdf.splitTextToSize(cleanedParagraph, usableWidth) as string[];
      for (const wl of wrapped) {
        ensureSpace(5.5);
        pdf.text(wl, margin, y);
        y += 5.1;
      }
      y += 1.6;
      i++;
    }
  };

  // ==========================================
  // PAGE 2: PENGANTAR, DAFTAR ISI & CARA PAKAI
  // ==========================================
  addContentPage();

  if (displaySummary) {
    drawSectionLabel('PENGANTAR', 'Tentang Produk Ini');
    renderBodyLines(displaySummary);
    y += 4;
  }

  if (displayHowToUse) {
    drawSectionLabel('PANDUAN CEPAT', 'Cara Menggunakan Produk Ini');
    renderBodyLines(displayHowToUse);
    y += 4;
  }

  if (titledChapters.length > 0) {
    ensureSpace(26);
    drawSectionLabel('STRUKTUR MATERI', 'Daftar Isi');
    for (let idx = 0; idx < titledChapters.length; idx++) {
      ensureSpace(8);
      const num = String(idx + 1).padStart(2, '0');
      const heading = stripInlineMarkdown(titledChapters[idx].heading);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...COLORS.accentTeal);
      pdf.text(num, margin, y);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.inkDark);
      const wrapped = pdf.splitTextToSize(heading, usableWidth - 12) as string[];
      pdf.text(wrapped, margin + 10, y);
      y += wrapped.length * 5.2 + 1.8;
    }
    y += 4;
  }

  // ==========================================
  // PAGE 3+: ISI PRODUK UTUH & LENGKAP
  // ==========================================
  const chaptersToRender: DigitalProductChapter[] =
    buyer.chapters.length > 0
      ? buyer.chapters
      : buyer.mainContent
        ? [{ heading: 'Isi Produk Lengkap', body: buyer.mainContent }]
        : [];

  let chapterCounter = 0;
  for (let idx = 0; idx < chaptersToRender.length; idx++) {
    const chapter = chaptersToRender[idx];
    const hasHeading = chapter.heading.trim().length > 0;
    if (hasHeading) {
      chapterCounter++;
      const eyebrow = `BAGIAN ${String(chapterCounter).padStart(2, '0')}`;
      // Start each major chapter on a fresh page for clean book-like pagination
      drawSectionLabel(eyebrow, chapter.heading, true);
    } else if (idx === 0 && (displaySummary || displayHowToUse || titledChapters.length > 0)) {
      drawSectionLabel('ISI PRODUK', 'Materi Utama', true);
    }
    if (chapter.body.trim()) {
      renderBodyLines(chapter.body);
    }
  }

  // ==========================================
  // CLEAN RUNNING HEADER & FOOTER (PAGES 2..N)
  // ==========================================
  const totalPages = pdf.internal.pages.length - 1;
  const headerTitle = displayTitle.length > 68 ? `${displayTitle.slice(0, 65)}...` : displayTitle;

  for (let page = 2; page <= totalPages; page++) {
    pdf.setPage(page);

    // Subtle top running header
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.inkMuted);
    pdf.text(headerTitle, margin, 13);
    pdf.text(displayType.slice(0, 28), pageWidth - margin, 13, { align: 'right' });
    pdf.setDrawColor(...COLORS.hairline);
    pdf.setLineWidth(0.25);
    pdf.line(margin, 16, pageWidth - margin, 16);

    // Clean bottom footer (ZERO internal draft/review watermark)
    pdf.setDrawColor(...COLORS.hairline);
    pdf.setLineWidth(0.25);
    pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.inkMuted);
    pdf.text(`Halaman ${page} dari ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }

  return { pdf, filename: safeFilename(buyer.title || title) };
}
