import * as XLSX from 'xlsx';
import type { ScenarioResult, RawTransaction } from '../types';
import { format } from 'date-fns';

function fmt(n: number) {
  return Math.round(n * 100) / 100;
}

function dateStr(d: Date) {
  try { return format(d, 'MM/dd/yyyy'); } catch { return String(d); }
}

export function exportToExcel(
  scenarios: ScenarioResult[],
  allTransactions: RawTransaction[],
  taxYear: number
) {
  const wb = XLSX.utils.book_new();

  // ---- Sheet 1: Scenario Comparison ----
  const comparisonData: (string | number)[][] = [
    ['Crypto Tax Report - Scenario Comparison', '', '', '', '', '', '', ''],
    [`Tax Year: ${taxYear}`, '', '', '', '', '', '', ''],
    ['Generated: ' + dateStr(new Date()), '', '', '', '', '', '', ''],
    [],
    ['Method', 'Short-Term Gain', 'Short-Term Loss', 'Net Short-Term', 'Long-Term Gain', 'Long-Term Loss', 'Net Long-Term', 'NET TOTAL'],
  ];

  for (const s of scenarios) {
    const { summary: sum } = s;
    comparisonData.push([
      s.method,
      fmt(sum.shortTermGain),
      fmt(sum.shortTermLoss),
      fmt(sum.netShortTerm),
      fmt(sum.longTermGain),
      fmt(sum.longTermLoss),
      fmt(sum.netLongTerm),
      fmt(sum.netTotal),
    ]);
  }

  const wsCompare = XLSX.utils.aoa_to_sheet(comparisonData);
  wsCompare['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsCompare, 'Scenario Comparison');

  // ---- Sheet per scenario: detailed disposals ----
  for (const scenario of scenarios) {
    const { method, summary } = scenario;

    const rows: (string | number)[][] = [
      [`${method} - Detailed Disposals (${taxYear})`],
      [],
      [
        'Sell Date', 'Asset', 'Qty Disposed', 'Proceeds/Unit', 'Total Proceeds',
        'Buy Date', 'Cost Basis/Unit', 'Total Cost Basis', 'Gain/(Loss)',
        'Term', 'Days Held', 'Sell Exchange', 'Buy Exchange'
      ],
    ];

    for (const d of summary.disposals) {
      rows.push([
        dateStr(d.sellDate),
        d.asset,
        fmt(d.qtyDisposed),
        fmt(d.proceedsPerUnit),
        fmt(d.totalProceeds),
        dateStr(d.acquiredDate),
        fmt(d.costBasisPerUnit),
        fmt(d.totalCostBasis),
        fmt(d.gainLoss),
        d.isLongTerm ? 'Long-Term' : 'Short-Term',
        d.holdingDays,
        d.sellExchange.toUpperCase(),
        d.buyExchange.toUpperCase(),
      ]);
    }

    rows.push([]);
    rows.push(['TOTALS', '', '', '', fmt(summary.totalProceeds), '', '', fmt(summary.totalCostBasis), fmt(summary.netTotal)]);
    rows.push([]);
    rows.push(['Short-Term Net:', fmt(summary.netShortTerm), '', 'Long-Term Net:', fmt(summary.netLongTerm), '', 'TOTAL:', fmt(summary.netTotal)]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, method.slice(0, 31));
  }

  // ---- Sheet: All Raw Transactions ----
  const rawRows: (string | number)[][] = [
    ['All Transactions'],
    [],
    ['ID', 'Exchange', 'Date', 'Type', 'Asset', 'Quantity', 'Price (USD)', 'Total (USD)', 'Fee (USD)', 'Net (USD)', 'Notes'],
  ];

  const sorted = [...allTransactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const tx of sorted) {
    rawRows.push([
      tx.id, tx.exchange.toUpperCase(), dateStr(tx.date), tx.type.toUpperCase(),
      tx.asset, fmt(tx.quantity), fmt(tx.priceUSD), fmt(tx.totalUSD),
      fmt(tx.feeUSD), fmt(tx.netUSD), tx.notes ?? '',
    ]);
  }

  const wsRaw = XLSX.utils.aoa_to_sheet(rawRows);
  wsRaw['!cols'] = [
    { wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRaw, 'All Transactions');

  // ---- Sheet: Unmatched Sells ----
  const unmatchedRows: (string | number)[][] = [
    ['Unmatched Sells (Missing Buy Legs)'],
    ['These sells could not be matched to a purchase. Verify your import files are complete.'],
    [],
    ['Date', 'Exchange', 'Asset', 'Quantity', 'Price (USD)', 'Total (USD)'],
  ];

  for (const scenario of scenarios) {
    if (scenario.method === 'FIFO') {
      for (const tx of scenario.summary.unmatchedSells) {
        unmatchedRows.push([
          dateStr(tx.date), tx.exchange.toUpperCase(), tx.asset,
          fmt(tx.quantity), fmt(tx.priceUSD), fmt(tx.totalUSD),
        ]);
      }
    }
  }

  const wsUnmatched = XLSX.utils.aoa_to_sheet(unmatchedRows);
  XLSX.utils.book_append_sheet(wb, wsUnmatched, 'Unmatched Sells');

  // Write and download
  const filename = `crypto_tax_${taxYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
