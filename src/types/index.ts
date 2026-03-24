export type Exchange = 'coinbase' | 'kraken';
export type TxType = 'buy' | 'sell' | 'convert' | 'reward' | 'transfer' | 'fee';
export type AccountingMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC_ID';

export interface RawTransaction {
  id: string;
  exchange: Exchange;
  date: Date;
  type: TxType;
  asset: string;          // e.g. "BTC", "ETH"
  quantity: number;       // always positive
  priceUSD: number;       // price per unit in USD at time of tx
  totalUSD: number;       // quantity * price (before fees)
  feeUSD: number;
  netUSD: number;         // totalUSD +/- feeUSD depending on buy/sell
  notes?: string;
  rawRow: Record<string, string>;
}

export interface TaxLot {
  lotId: string;
  exchange: Exchange;
  asset: string;
  acquiredDate: Date;
  quantity: number;           // original quantity acquired
  remainingQty: number;       // after partial sells
  costBasisPerUnit: number;   // USD per unit (including fees)
  totalCostBasis: number;     // remainingQty * costBasisPerUnit
  sourceTxId: string;
}

export interface MatchedDisposal {
  disposalId: string;
  sellTxId: string;
  sellExchange: Exchange;
  sellDate: Date;
  asset: string;
  qtyDisposed: number;
  proceedsPerUnit: number;
  totalProceeds: number;

  buyTxId: string;
  buyExchange: Exchange;
  acquiredDate: Date;
  costBasisPerUnit: number;
  totalCostBasis: number;

  gainLoss: number;           // totalProceeds - totalCostBasis
  isLongTerm: boolean;        // held > 365 days
  holdingDays: number;
}

export interface TaxSummary {
  shortTermGain: number;
  shortTermLoss: number;
  longTermGain: number;
  longTermLoss: number;
  netShortTerm: number;
  netLongTerm: number;
  netTotal: number;
  totalProceeds: number;
  totalCostBasis: number;
  disposals: MatchedDisposal[];
  unmatchedSells: RawTransaction[];
  unusedLots: TaxLot[];
}

export interface ScenarioResult {
  method: AccountingMethod;
  summary: TaxSummary;
}

export interface AppState {
  coinbaseTransactions: RawTransaction[];
  krakenTransactions: RawTransaction[];
  taxYear: number;
  scenarios: ScenarioResult[];
  activeMethod: AccountingMethod;
}
