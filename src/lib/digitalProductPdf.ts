import { jsPDF } from 'jspdf';

function safeFilename(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${slug || 'produk-digital'}.pdf`;
}

function pdfSafeText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[•·]/g, '-').replace(/→/g, '->')
    .replace(/[^\x20-\x7e\r\n\t]/g, '?');
}

export function createDigitalProductPdf(title: string, content: string): { pdf: jsPDF; filename: string } {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const usableWidth = pageWidth - margin * 2;
  let y = 24;

  const safeTitle = pdfSafeText(title);
  pdf.setProperties({ title: safeTitle, subject: 'Draf produk digital untuk ditinjau', creator: 'Rasyatech' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  const titleLines = pdf.splitTextToSize(safeTitle, usableWidth) as string[];
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 8 + 8;

  const plainContent = pdfSafeText(content.replace(/\*\*/g, '').replace(/```/g, ''));
  for (const rawLine of plainContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      y += 2;
      continue;
    }

    const isHeading = /^(?:Judul Produk|Jenis Produk|Target Pengguna|Ringkasan|Cara Pakai|Isi Produk|Contoh Uji Sintetis|Batasan dan Hal yang Perlu Diverifikasi|Deskripsi Listing Produk)\s*:/i.test(line);
    pdf.setFont('helvetica', isHeading ? 'bold' : 'normal');
    pdf.setFontSize(isHeading ? 11 : 10);
    const wrapped = pdf.splitTextToSize(line, usableWidth) as string[];
    for (const wrappedLine of wrapped) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(wrappedLine, margin, y);
      y += isHeading ? 6 : 5;
    }
  }

  const pages = pdf.internal.pages.length - 1;
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text(`${page} / ${pages} - Tinjau dan sesuaikan sebelum dijual`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }
  return { pdf, filename: safeFilename(title) };
}
