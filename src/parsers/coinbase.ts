import Papa from 'papaparse';
import type { RawTransaction, TxType } from '../types';

// Coinbase Taxes report CSV columns:
// Transaction ID, Transaction Type, Date & time,
// Asset Acquired, Quantity Acquired (Bought, Received, etc), Cost Basis (incl. fees and/or spread) (USD),
// Data Source,
// Asset Disposed (Sold, Sent, etc), Quantity Disposed, Proceeds (excl. fees and/or spread) (USD)

function mapTxType(type: string): TxType {
  const t = type.toLowerCase().trim();
  if (t.includes('sell') || t.includes('dispos')) return 'sell';
  if (t.includes('buy') || t.includes('purchas')) return 'buy';
  if (t.includes('convert') || t.includes('swap')) return 'convert';
  if (t.includes('reward') || t.includes('earn') || t.includes('interest') || t.includes('staking') || t.includes('learn')) return 'reward';
  if (t.includes('receive')) return 'buy';
  if (t.includes('send')) return 'transfer';
  return 'buy';
}

function parseUSD(val: string | undefined): number {
  if (!val) return 0;
  return parseFloat(val.replace(/[^0-9.\-]/g, '')) || 0;
}

function parseQty(val: string | undefined): number {
  if (!val) return 0;
  return Math.abs(parseFloat(val.replace(/[^0-9.\-]/g, '')) || 0);
}

export function parseCoinbaseCSV(csvText: string): RawTransaction[] {
  const lines = csvText.split('\n');

  // Find the header row — try both Taxes format and Transaction History format
  let headerIdx = lines.findIndex(l =>
    l.includes('Transaction ID') || l.includes('transaction id') ||
    (l.includes('Timestamp') && l.includes('Transaction Type')) ||
    (l.includes('Date') && l.includes('Type'))
  );
  if (headerIdx === -1) {
    headerIdx = lines.findIndex(l => l.includes(',') && !/^\d/.test(l.trim()));
  }
  if (headerIdx === -1) headerIdx = 0;

  const dataSection = lines.slice(headerIdx).join('\n');

  const result = Papa.parse<Record<string, string>>(dataSection, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/\uFEFF/g, ''),
  });

  console.log('[Coinbase parser] Detected headers:', result.meta?.fields);

  const transactions: RawTransaction[] = [];

  for (const row of result.data) {
    const txId = row['Transaction ID'] ?? row['ID'] ?? '';
    const txTypeRaw = row['Transaction Type'] ?? row['Type'] ?? row['type'] ?? '';
    const dateStr = row['Date & time'] ?? row['Date & Time'] ?? row['Timestamp'] ?? row['Date'] ?? '';

    let date: Date;
    try {
      date = new Date(dateStr);
      if (isNaN(date.getTime())) date = new Date();
    } catch { date = new Date(); }

    // ---- Taxes report format (acquired + disposed in same row) ----
    const assetAcquired = (row['Asset Acquired'] ?? '').trim().toUpperCase();
    const qtyAcquired = parseQty(row['Quantity Acquired (Bought, Received, etc)'] ?? row['Quantity Acquired'] ?? '');
    const costBasis = parseUSD(row['Cost Basis (incl. fees and/or spread) (USD)'] ?? row['Cost Basis (USD)'] ?? row['Cost Basis'] ?? '');

    const assetDisposed = (row['Asset Disposed (Sold, Sent, etc)'] ?? row['Asset Disposed'] ?? '').trim().toUpperCase();
    const qtyDisposed = parseQty(row['Quantity Disposed'] ?? '');
    const proceeds = parseUSD(row['Proceeds (excl. fees and/or spread) (USD)'] ?? row['Proceeds (USD)'] ?? row['Proceeds'] ?? '');

    // Emit a BUY transaction if there's an acquired leg
    if (assetAcquired && qtyAcquired > 0) {
      const pricePerUnit = costBasis > 0 && qtyAcquired > 0 ? costBasis / qtyAcquired : 0;
      const type = mapTxType(txTypeRaw);
      const emitType: TxType = (type === 'sell' || type === 'transfer') ? 'buy' : type;

      transactions.push({
        id: `cb-buy-${txId || Date.now()}-${Math.random().toString(36).slice(2)}`,
        exchange: 'coinbase',
        date,
        type: emitType,
        asset: assetAcquired,
        quantity: qtyAcquired,
        priceUSD: pricePerUnit,
        totalUSD: costBasis,
        feeUSD: 0, // already included in cost basis per Coinbase
        netUSD: costBasis,
        notes: txTypeRaw,
        rawRow: row,
      });
    }

    // Emit a SELL transaction if there's a disposed leg
    if (assetDisposed && qtyDisposed > 0) {
      const pricePerUnit = proceeds > 0 && qtyDisposed > 0 ? proceeds / qtyDisposed : 0;

      transactions.push({
        id: `cb-sell-${txId || Date.now()}-${Math.random().toString(36).slice(2)}`,
        exchange: 'coinbase',
        date,
        type: 'sell',
        asset: assetDisposed,
        quantity: qtyDisposed,
        priceUSD: pricePerUnit,
        totalUSD: proceeds,
        feeUSD: 0,
        netUSD: proceeds,
        notes: txTypeRaw,
        rawRow: row,
      });
    }

    // ---- Legacy Transaction History format fallback ----
    // (columns: Timestamp, Transaction Type, Asset, Quantity Transacted, Spot Price at Transaction, Subtotal, Total, Fees)
    if (!assetAcquired && !assetDisposed) {
      const asset = (row['Asset'] ?? row['Currency'] ?? '').trim().toUpperCase();
      const quantity = parseQty(row['Quantity Transacted'] ?? row['Amount'] ?? '0');
      const spotPrice = parseUSD(row['Spot Price at Transaction'] ?? row['Spot Price (USD)'] ?? row['Price'] ?? '0');
      const subtotal = parseUSD(row['Subtotal'] ?? '0');
      const total = parseUSD(row['Total (inclusive of fees and/or spread)'] ?? row['Total'] ?? '0');
      const fee = parseUSD(row['Fees and/or Spread'] ?? row['Fees'] ?? row['Fee'] ?? '0');

      if (!asset || quantity === 0) continue;

      const type = mapTxType(txTypeRaw);
      if (type === 'transfer') continue;

      const totalUSD = subtotal > 0 ? subtotal : Math.abs(total);
      const priceUSD = spotPrice > 0 ? spotPrice : (quantity > 0 ? totalUSD / quantity : 0);
      const netUSD = type === 'buy' ? totalUSD + fee : totalUSD - fee;

      transactions.push({
        id: `cb-${txId || Date.now()}-${Math.random().toString(36).slice(2)}`,
        exchange: 'coinbase',
        date,
        type,
        asset,
        quantity,
        priceUSD,
        totalUSD,
        feeUSD: fee,
        netUSD,
        notes: row['Notes'] ?? '',
        rawRow: row,
      });
    }
  }

  return transactions;
}
