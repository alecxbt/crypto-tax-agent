import type { RawTransaction, TaxLot, MatchedDisposal, TaxSummary, AccountingMethod, ScenarioResult } from '../types';
import { differenceInDays } from 'date-fns';

// ------- Lot builder -------

function buildLots(buys: RawTransaction[]): TaxLot[] {
  return buys
    .filter(tx => tx.type === 'buy' || tx.type === 'reward' || tx.type === 'convert')
    .map((tx, i) => {
      const costBasisPerUnit = tx.type === 'reward'
        ? tx.priceUSD  // FMV at time of receipt is cost basis for rewards
        : tx.quantity > 0
          ? tx.netUSD / tx.quantity  // includes fees in cost basis
          : 0;
      return {
        lotId: `lot-${tx.id}-${i}`,
        exchange: tx.exchange,
        asset: tx.asset,
        acquiredDate: tx.date,
        quantity: tx.quantity,
        remainingQty: tx.quantity,
        costBasisPerUnit,
        totalCostBasis: tx.quantity * costBasisPerUnit,
        sourceTxId: tx.id,
      };
    });
}

// ------- Main calculation -------

export function calculateTax(
  allTransactions: RawTransaction[],
  method: AccountingMethod,
  taxYear: number
): TaxSummary {
  // Sort all transactions chronologically
  const sorted = [...allTransactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build a mutable lot pool grouped by asset
  const lotsByAsset: Record<string, TaxLot[]> = {};

  // Process all transactions in order
  const disposals: MatchedDisposal[] = [];
  const unmatchedSells: RawTransaction[] = [];

  // First pass: collect all buys into lots
  for (const tx of sorted) {
    if (tx.type === 'buy' || tx.type === 'reward' || tx.type === 'convert') {
      const lot = buildLots([tx])[0];
      if (!lotsByAsset[tx.asset]) lotsByAsset[tx.asset] = [];
      lotsByAsset[tx.asset].push(lot);
    }
  }

  // Reset and do a single chronological pass
  // We need to process in order because sells consume lots from earlier buys
  const lotsTracker: Record<string, TaxLot[]> = {};

  for (const tx of sorted) {
    if (tx.type === 'buy' || tx.type === 'reward') {
      const lot = buildLots([tx])[0];
      if (!lotsTracker[tx.asset]) lotsTracker[tx.asset] = [];
      lotsTracker[tx.asset].push(lot);

    } else if (tx.type === 'sell' || tx.type === 'convert') {
      const assetLots = lotsTracker[tx.asset] ?? [];

      let pool = assetLots.filter(l => l.remainingQty > 1e-10);

      // Apply sorting based on method
      switch (method) {
        case 'FIFO':
          pool.sort((a, b) => a.acquiredDate.getTime() - b.acquiredDate.getTime());
          break;
        case 'LIFO':
          pool.sort((a, b) => b.acquiredDate.getTime() - a.acquiredDate.getTime());
          break;
        case 'HIFO':
        case 'SPECIFIC_ID':
          pool.sort((a, b) => b.costBasisPerUnit - a.costBasisPerUnit);
          break;
      }

      let qtyToDispose = tx.quantity;
      const proceedsPerUnit = tx.priceUSD > 0 ? tx.priceUSD : (tx.quantity > 0 ? tx.netUSD / tx.quantity : 0);

      for (const lot of pool) {
        if (qtyToDispose <= 1e-10) break;

        const take = Math.min(lot.remainingQty, qtyToDispose);
        const proceeds = take * proceedsPerUnit;
        const costBasis = take * lot.costBasisPerUnit;
        const holdingDays = differenceInDays(tx.date, lot.acquiredDate);

        disposals.push({
          disposalId: `disp-${tx.id}-${lot.lotId}`,
          sellTxId: tx.id,
          sellExchange: tx.exchange,
          sellDate: tx.date,
          asset: tx.asset,
          qtyDisposed: take,
          proceedsPerUnit,
          totalProceeds: proceeds,
          buyTxId: lot.sourceTxId,
          buyExchange: lot.exchange,
          acquiredDate: lot.acquiredDate,
          costBasisPerUnit: lot.costBasisPerUnit,
          totalCostBasis: costBasis,
          gainLoss: proceeds - costBasis,
          isLongTerm: holdingDays > 365,
          holdingDays,
        });

        lot.remainingQty -= take;
        qtyToDispose -= take;
      }

      // Update remaining qty in tracker
      if (lotsTracker[tx.asset]) {
        for (const lot of lotsTracker[tx.asset]) {
          const match = pool.find(p => p.lotId === lot.lotId);
          if (match) lot.remainingQty = match.remainingQty;
        }
      }

      if (qtyToDispose > 1e-6) {
        unmatchedSells.push(tx);
      }
    }
  }

  // Filter disposals to the tax year
  const yearDisposals = disposals.filter(d => d.sellDate.getFullYear() === taxYear);

  // Collect unused lots
  const unusedLots: TaxLot[] = [];
  for (const lots of Object.values(lotsTracker)) {
    for (const lot of lots) {
      if (lot.remainingQty > 1e-10) unusedLots.push(lot);
    }
  }

  // Aggregate
  let shortTermGain = 0, shortTermLoss = 0, longTermGain = 0, longTermLoss = 0;
  let totalProceeds = 0, totalCostBasis = 0;

  for (const d of yearDisposals) {
    totalProceeds += d.totalProceeds;
    totalCostBasis += d.totalCostBasis;
    if (d.gainLoss >= 0) {
      if (d.isLongTerm) longTermGain += d.gainLoss;
      else shortTermGain += d.gainLoss;
    } else {
      if (d.isLongTerm) longTermLoss += Math.abs(d.gainLoss);
      else shortTermLoss += Math.abs(d.gainLoss);
    }
  }

  return {
    shortTermGain,
    shortTermLoss,
    longTermGain,
    longTermLoss,
    netShortTerm: shortTermGain - shortTermLoss,
    netLongTerm: longTermGain - longTermLoss,
    netTotal: (shortTermGain - shortTermLoss) + (longTermGain - longTermLoss),
    totalProceeds,
    totalCostBasis,
    disposals: yearDisposals,
    unmatchedSells: unmatchedSells.filter(s => s.date.getFullYear() === taxYear),
    unusedLots,
  };
}

export function runAllScenarios(
  transactions: RawTransaction[],
  taxYear: number
): ScenarioResult[] {
  const methods: AccountingMethod[] = ['FIFO', 'LIFO', 'HIFO', 'SPECIFIC_ID'];
  return methods.map(method => ({
    method,
    summary: calculateTax(transactions, method, taxYear),
  }));
}
