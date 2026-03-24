import Papa from 'papaparse';
import type { RawTransaction, TxType } from '../types';

// Kraken ledger CSV columns:
// txid, refid, time, type, subtype, aclass, asset, amount, fee, balance
//
// Kraken trades CSV columns:
// txid, ordertxid, pair, time, type, ordertype, price, cost, fee, vol, margin, misc, ledgers

const KRAKEN_ASSET_MAP: Record<string, string> = {
  XXBT: 'BTC', XBT: 'BTC', XETH: 'ETH', XLTC: 'LTC',
  XXRP: 'XRP', XXLM: 'XLM', XZEC: 'ZEC', XXMR: 'XMR',
  ZUSD: 'USD', ZEUR: 'EUR', ZGBP: 'GBP',
  ADA: 'ADA', DOT: 'DOT', SOL: 'SOL', AVAX: 'AVAX',
  MATIC: 'MATIC', LINK: 'LINK', UNI: 'UNI', ATOM: 'ATOM',
};

function normalizeKrakenAsset(raw: string): string {
  const clean = raw.trim().toUpperCase();
  return KRAKEN_ASSET_MAP[clean] ?? clean.replace(/^X/, '').replace(/^Z/, '');
}

function parseNum(val: string): number {
  return parseFloat((val ?? '').replace(/[^0-9.\-]/g, '')) || 0;
}

// --- Ledger file parser ---
export function parseKrakenLedgerCSV(csvText: string): RawTransaction[] {
  const lines = csvText.split('\n');
  const headerIdx = lines.findIndex(l => l.includes('"txid"') || l.startsWith('txid,') || l.includes('txid'));
  const dataSection = headerIdx >= 0 ? lines.slice(headerIdx).join('\n') : csvText;

  const result = Papa.parse<Record<string, string>>(dataSection, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/^"|"$/g, ''),
  });

  // Pair up ledger entries by refid — each trade has two entries (asset in/out)
  const byRefId: Record<string, Record<string, string>[]> = {};
  for (const row of result.data) {
    const refid = row['refid']?.trim();
    if (!refid) continue;
    if (!byRefId[refid]) byRefId[refid] = [];
    byRefId[refid].push(row);
  }

  const transactions: RawTransaction[] = [];

  for (const [refid, rows] of Object.entries(byRefId)) {
    const type = (rows[0]?.['type'] ?? '').toLowerCase().trim();
    const subtype = (rows[0]?.['subtype'] ?? '').toLowerCase().trim();

    if (type === 'deposit' || type === 'withdrawal' || type === 'transfer') continue;

    if (type === 'trade' && rows.length === 2) {
      // Find the non-USD/fiat leg
      const leg1 = rows[0];
      const leg2 = rows[1];
      const asset1 = normalizeKrakenAsset(leg1['asset'] ?? '');
      const asset2 = normalizeKrakenAsset(leg2['asset'] ?? '');
      const amount1 = parseNum(leg1['amount'] ?? '0');
      const amount2 = parseNum(leg2['amount'] ?? '0');

      const isFiat = (a: string) => ['USD', 'EUR', 'GBP', 'USDT', 'USDC', 'DAI'].includes(a);

      let cryptoLeg: Record<string, string>;
      let fiatLeg: Record<string, string>;
      let cryptoAsset: string;
      let fiatAmount: number;

      if (!isFiat(asset1) && isFiat(asset2)) {
        cryptoLeg = leg1; cryptoAsset = asset1;
        fiatLeg = leg2; fiatAmount = Math.abs(amount2);
      } else if (isFiat(asset1) && !isFiat(asset2)) {
        cryptoLeg = leg2; cryptoAsset = asset2;
        fiatLeg = leg1; fiatAmount = Math.abs(amount1);
      } else {
        // crypto-to-crypto: treat as sell+buy convert
        // For simplicity, emit both legs
        [leg1, leg2].forEach((leg, i) => {
          const amt = parseNum(leg['amount'] ?? '0');
          const asset = normalizeKrakenAsset(leg['asset'] ?? '');
          const fee = Math.abs(parseNum(leg['fee'] ?? '0'));
          if (asset === 'USD' || amt === 0) return;
          const txType: TxType = amt < 0 ? 'sell' : 'buy';
          const date = parseKrakenDate(leg['time'] ?? '');
          transactions.push({
            id: `kr-${refid}-${i}`,
            exchange: 'kraken',
            date,
            type: txType,
            asset,
            quantity: Math.abs(amt),
            priceUSD: 0, // unknown without price data
            totalUSD: 0,
            feeUSD: fee,
            netUSD: 0,
            rawRow: leg,
          });
        });
        continue;
      }

      const cryptoAmt = parseNum(cryptoLeg['amount'] ?? '0');
      const fee = Math.abs(parseNum(cryptoLeg['fee'] ?? '0')) + Math.abs(parseNum(fiatLeg['fee'] ?? '0'));
      const txType: TxType = cryptoAmt > 0 ? 'buy' : 'sell';
      const quantity = Math.abs(cryptoAmt);
      const priceUSD = quantity > 0 ? fiatAmount / quantity : 0;
      const date = parseKrakenDate(cryptoLeg['time'] ?? '');

      transactions.push({
        id: `kr-${refid}`,
        exchange: 'kraken',
        date,
        type: txType,
        asset: cryptoAsset,
        quantity,
        priceUSD,
        totalUSD: fiatAmount,
        feeUSD: fee,
        netUSD: txType === 'buy' ? fiatAmount + fee : fiatAmount - fee,
        rawRow: cryptoLeg,
      });

    } else if (type === 'staking' || type === 'earn' || subtype === 'stakingfromspot') {
      const row = rows[0];
      const amt = parseNum(row['amount'] ?? '0');
      const asset = normalizeKrakenAsset(row['asset'] ?? '');
      if (asset === 'USD' || amt <= 0) continue;
      const date = parseKrakenDate(row['time'] ?? '');
      transactions.push({
        id: `kr-${refid}`,
        exchange: 'kraken',
        date,
        type: 'reward',
        asset,
        quantity: amt,
        priceUSD: 0,
        totalUSD: 0,
        feeUSD: 0,
        netUSD: 0,
        rawRow: row,
      });
    }
  }

  return transactions;
}

// --- Trades file parser ---
// Supports the extended Kraken trades export:
// txid, ordertxid, pair, aclass, subclass, time, type, ordertype,
// price, cost, fee, vol, margin, misc, ledgers, posttxid, posstatusc,
// cprice, ccost, cfee, cvol, cmargin, net, costusd, trades
export function parseKrakenTradesCSV(csvText: string): RawTransaction[] {
  const lines = csvText.split('\n');
  // Skip any preamble lines — find the header row
  let headerIdx = lines.findIndex(l =>
    l.includes('txid') || l.includes('pair') || l.includes('time')
  );
  if (headerIdx === -1) headerIdx = 0;
  const dataSection = lines.slice(headerIdx).join('\n');

  const result = Papa.parse<Record<string, string>>(dataSection, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/\uFEFF/g, ''),
  });

  console.log('[Kraken trades parser] Detected headers:', result.meta?.fields);

  const transactions: RawTransaction[] = [];

  for (const row of result.data) {
    const pair = (row['pair'] ?? '').toUpperCase();
    const typeRaw = (row['type'] ?? '').toLowerCase().trim();

    // Skip margin/settlement rows
    const subclass = (row['subclass'] ?? '').toLowerCase();
    if (subclass === 'settlement' || subclass === 'closing') continue;

    const txType: TxType = typeRaw === 'buy' ? 'buy' : typeRaw === 'sell' ? 'sell' : 'buy';
    const vol = parseNum(row['vol'] ?? '0');
    const date = parseKrakenDate(row['time'] ?? '');

    const asset = extractAssetFromPair(pair);
    if (!asset || vol === 0) continue;

    // Prefer costusd (explicit USD value) over cost (which may be in EUR/GBP)
    const costUSD = parseNum(row['costusd'] ?? '0');
    const cost = parseNum(row['cost'] ?? '0');
    const totalUSD = costUSD > 0 ? costUSD : cost;

    // For fee: cfee is in quote currency; try to convert using costusd/cost ratio
    const feeRaw = parseNum(row['fee'] ?? '0');
    let feeUSD = feeRaw;
    if (costUSD > 0 && cost > 0 && cost !== costUSD) {
      // cost is in non-USD, costusd is in USD — scale fee proportionally
      feeUSD = feeRaw * (costUSD / cost);
    }

    const priceUSD = vol > 0 ? totalUSD / vol : parseNum(row['price'] ?? '0');
    const netUSD = txType === 'buy' ? totalUSD + feeUSD : totalUSD - feeUSD;

    transactions.push({
      id: `kr-${row['txid'] ?? Date.now()}-${Math.random().toString(36).slice(2)}`,
      exchange: 'kraken',
      date,
      type: txType,
      asset,
      quantity: vol,
      priceUSD,
      totalUSD,
      feeUSD,
      netUSD,
      rawRow: row,
    });
  }

  return transactions;
}

function parseKrakenDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  try {
    const d = new Date(dateStr.trim());
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

function extractAssetFromPair(pair: string): string {
  // Handle slash-separated format: "BTC/USD", "ETH/EUR", "SOL/USDT"
  if (pair.includes('/')) {
    const base = pair.split('/')[0];
    return normalizeKrakenAsset(base);
  }

  const fiatSuffixes = ['USDT', 'USDC', 'USD', 'EUR', 'GBP'];
  for (const fiat of fiatSuffixes) {
    if (pair.endsWith(fiat)) {
      const base = pair.slice(0, pair.length - fiat.length);
      return normalizeKrakenAsset(base);
    }
  }

  // Legacy Kraken format: "XXBTZUSD", "XETHZUSD"
  const fiatPrefixes = ['ZUSD', 'ZEUR', 'ZGBP'];
  for (const fp of fiatPrefixes) {
    if (pair.includes(fp)) {
      const base = pair.replace(fp, '');
      return normalizeKrakenAsset(base);
    }
  }

  return normalizeKrakenAsset(pair.slice(0, 3));
}

export function detectKrakenFileType(csvText: string): 'ledger' | 'trades' {
  // Scan first few lines for header row (may have preamble)
  const firstLines = csvText.split('\n').slice(0, 5).join('\n').toLowerCase();
  if (firstLines.includes('ordertxid') || firstLines.includes('costusd') ||
      (firstLines.includes('pair') && firstLines.includes('vol'))) {
    return 'trades';
  }
  return 'ledger';
}
