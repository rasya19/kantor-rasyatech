import { prisma } from '../lib/prisma';
import { buildExecutiveReport, jakartaDateKey, jakartaPeriodBounds, type ReportPeriod } from './executiveReport';

const periods: { key: ReportPeriod; label: string }[] = [
  { key: 'day', label: 'HARIAN' },
  { key: 'week', label: 'MINGGUAN' },
  { key: 'month', label: 'BULANAN' },
];

const formatIdr = (amount: number) => `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;

function formatPeriod(label: string, report: ReturnType<typeof buildExecutiveReport>, transactionCount: number): string {
  const range = report.period === 'day' ? report.date : `${report.startDate} s.d. ${report.endDate}`;
  const knownAiCost = `US$${report.aiCostUsdKnown.toFixed(6)}`;
  const netAfterAi = report.netProfitAfterAiIdr === null
    ? 'Belum dapat dihitung (kurs USD/IDR belum tersedia atau ada pemakaian AI tanpa biaya terukur).'
    : formatIdr(report.netProfitAfterAiIdr);
  return [
    `${label} (${range})`,
    `- Pemasukan aktual yang tercatat: ${formatIdr(report.actualRevenueIdr)} dari ${transactionCount} transaksi. Ini bukan jaminan semua pembayaran sudah dicatat.`,
    `- Pemasukan estimasi (bukan uang diterima): ${formatIdr(report.estimatedIncomeIdr)}.`,
    `- Pengeluaran operasional yang tercatat: ${formatIdr(report.expensesIdr)}.`,
    `- Selisih tercatat sebelum biaya AI: ${formatIdr(report.recordedProfitIdr)}.`,
    `- Pemakaian AI: ${report.aiRequestCount} permintaan; biaya terukur ${knownAiCost}; ${report.unpricedAiCalls} permintaan tanpa harga; ${report.usageIncompleteCalls} catatan penggunaan tidak lengkap.`,
    `- Estimasi selisih setelah biaya AI terukur: ${netAfterAi}`,
  ].join('\n');
}

export async function generateFinancialManagerReport(now = new Date()): Promise<string> {
  const date = jakartaDateKey(now);
  const bounds = periods.map(({ key }) => jakartaPeriodBounds(date, key));
  if (bounds.some((period) => !period)) throw new Error('Periode laporan keuangan tidak valid.');
  const validBounds = bounds.filter((period) => period !== null);
  const earliest = validBounds.reduce((start, period) => period.start < start ? period.start : start, validBounds[0].start);
  const latest = validBounds.reduce((end, period) => period.end > end ? period.end : end, validBounds[0].end);
  const startDate = validBounds.reduce((start, period) => period.startDate < start ? period.startDate : start, validBounds[0].startDate);
  const endDate = validBounds.reduce((end, period) => period.endDate > end ? period.endDate : end, validBounds[0].endDate);
  const [transactions, usage] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { date: { gte: startDate, lte: endDate }, voidedAt: null },
      select: { product: true, kind: true, amount: true, date: true },
    }),
    prisma.openRouterUsage.findMany({
      where: { createdAt: { gte: earliest, lt: latest } },
      select: { division: true, product: true, model: true, promptTokens: true, completionTokens: true, costUsd: true, usageAvailable: true, createdAt: true },
    }),
  ]);
  const configuredRate = process.env.OPENROUTER_USD_IDR?.trim();
  const parsedRate = configuredRate ? Number(configuredRate) : null;
  const usdIdr = parsedRate !== null && Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : null;
  const summaries = periods.map(({ key, label }) => {
    const period = jakartaPeriodBounds(date, key);
    if (!period) throw new Error('Periode laporan keuangan tidak valid.');
    const periodTransactions = transactions.filter((transaction) =>
      transaction.date >= period.startDate && transaction.date <= period.endDate);
    const periodUsage = usage.filter((row) => row.createdAt >= period.start && row.createdAt < period.end);
    const report = buildExecutiveReport({
      date, period: key, startDate: period.startDate, endDate: period.endDate,
      transactions: periodTransactions, usage: periodUsage, leads: [], usdIdr,
    });
    const incomeTransactionCount = periodTransactions.filter((transaction) => transaction.kind === 'INCOME').length;
    return formatPeriod(label, report, incomeTransactionCount);
  });
  return [
    `LAPORAN KEUANGAN PT RASYATECH DIGITAL ZENITH`,
    `Dibuat: ${date} WIB`,
    ...summaries,
    'BATAS DATA',
    '- Sumber pemasukan dan pengeluaran adalah transaksi yang dicatat manual di aplikasi; Lynk.id, QRIS, rekening, dan e-wallet belum terhubung.',
    '- Saldo kas/rekening/e-wallet tidak tersedia. Biaya layanan luar dan top-up yang belum dicatat tidak otomatis terhitung.',
    '- Biaya AI disajikan terpisah dari pengeluaran operasional tercatat. Estimasi setelah AI hanya tersedia jika kurs USD/IDR dikonfigurasi dan semua pemakaian memiliki biaya.',
    '- Angka laporan ini dihitung langsung dari database kantor dan tidak dikirim ke provider AI.',
  ].join('\n\n');
}
