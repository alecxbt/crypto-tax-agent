import { useState, useMemo } from 'react';
import { FileUploader } from './components/FileUploader';
import { ScenarioCard } from './components/ScenarioCard';
import { DisposalTable } from './components/DisposalTable';
import { SummaryPanel } from './components/SummaryPanel';
import type { RawTransaction, AccountingMethod, ScenarioResult } from './types';
import { runAllScenarios } from './engine/taxEngine';
import { exportToExcel } from './utils/excelExport';
import { Calculator, Download, RefreshCw, ChevronDown } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export default function App() {
  const [coinbaseTxs, setCoinbaseTxs] = useState<RawTransaction[]>([]);
  const [krakenTxs, setKrakenTxs] = useState<RawTransaction[]>([]);
  const [taxYear, setTaxYear] = useState(CURRENT_YEAR - 1);
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [activeMethod, setActiveMethod] = useState<AccountingMethod>('HIFO');
  const [activeTab, setActiveTab] = useState<'summary' | 'disposals' | 'transactions'>('summary');
  const [isCalculating, setIsCalculating] = useState(false);

  const allTransactions = useMemo(
    () => [...coinbaseTxs, ...krakenTxs],
    [coinbaseTxs, krakenTxs]
  );

  const activeScenario = useMemo(
    () => scenarios.find(s => s.method === activeMethod),
    [scenarios, activeMethod]
  );

  function calculate() {
    if (allTransactions.length === 0) return;
    setIsCalculating(true);
    setTimeout(() => {
      const results = runAllScenarios(allTransactions, taxYear);
      setScenarios(results);
      setIsCalculating(false);
    }, 50);
  }

  const bestScenario = useMemo(() => {
    if (scenarios.length === 0) return null;
    return scenarios.reduce((best, cur) =>
      cur.summary.netTotal < best.summary.netTotal ? cur : best
    );
  }, [scenarios]);

  function handleExport() {
    if (scenarios.length === 0) return;
    exportToExcel(scenarios, allTransactions, taxYear);
  }

  const hasData = allTransactions.length > 0;
  const hasResults = scenarios.length > 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f4ff 0%, #fafafa 60%, #f0fff4 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64, boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Calculator size={24} color="#7c83fd" />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
            CryptoTax
          </span>
          <span style={{ color: '#7c83fd', fontWeight: 600, fontSize: 14 }}>Agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hasResults && (
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#28a745', color: '#fff', border: 'none',
                borderRadius: 10, padding: '9px 18px', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}
            >
              <Download size={16} /> Export Excel
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 24px' }}>
        {/* Setup Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 20, marginBottom: 28 }}>
          {/* Coinbase */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
              Coinbase History
            </h3>
            <FileUploader
              exchange="coinbase"
              transactions={coinbaseTxs}
              onLoad={txs => { setCoinbaseTxs(txs); setScenarios([]); }}
              onClear={() => { setCoinbaseTxs([]); setScenarios([]); }}
            />
          </div>

          {/* Kraken */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
              Kraken History
            </h3>
            <FileUploader
              exchange="kraken"
              transactions={krakenTxs}
              onLoad={txs => { setKrakenTxs(txs); setScenarios([]); }}
              onClear={() => { setKrakenTxs([]); setScenarios([]); }}
            />
          </div>

          {/* Controls */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
              Tax Year
            </h3>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <select
                value={taxYear}
                onChange={e => { setTaxYear(Number(e.target.value)); setScenarios([]); }}
                style={{
                  width: '100%', padding: '12px 36px 12px 14px',
                  fontSize: 16, fontWeight: 600, borderRadius: 10,
                  border: '2px solid #e8e8e8', background: '#fafafa',
                  cursor: 'pointer', appearance: 'none',
                }}
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} />
            </div>

            {hasData && (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                {allTransactions.length} total transactions
                ({coinbaseTxs.length} Coinbase, {krakenTxs.length} Kraken)
              </div>
            )}

            <button
              onClick={calculate}
              disabled={!hasData || isCalculating}
              style={{
                width: '100%', padding: '14px',
                background: hasData ? 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)' : '#e8e8e8',
                color: hasData ? '#fff' : '#aaa',
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: hasData ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
            >
              {isCalculating ? (
                <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Calculating...</>
              ) : (
                <><Calculator size={16} /> Calculate Tax</>
              )}
            </button>
          </div>
        </div>

        {/* Scenario Cards */}
        {hasResults && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>
              Accounting Method Scenarios — {taxYear}
              <span style={{ fontSize: 13, fontWeight: 400, color: '#888', marginLeft: 10 }}>
                Click a method to view its detailed results
              </span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {scenarios.map(s => (
                <ScenarioCard
                  key={s.method}
                  scenario={s}
                  isActive={activeMethod === s.method}
                  onClick={() => setActiveMethod(s.method)}
                  isBest={bestScenario?.method === s.method}
                  label={s.summary.netTotal < 0 ? 'Best Loss' : 'Min Gain'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results Panel */}
        {activeScenario && (
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid #f0f0f0',
              padding: '0 24px', background: '#fafafa',
            }}>
              {(['summary', 'disposals', 'transactions'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '16px 20px', fontSize: 14, fontWeight: activeTab === tab ? 700 : 500,
                    color: activeTab === tab ? '#4361ee' : '#888',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: activeTab === tab ? '2px solid #4361ee' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {tab === 'summary' ? 'Summary' : tab === 'disposals' ? `Disposals (${activeScenario.summary.disposals.length})` : `All Transactions (${allTransactions.length})`}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <span style={{ fontSize: 12, color: '#888' }}>Viewing:</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  background: '#4361ee', borderRadius: 20, padding: '4px 12px',
                }}>
                  {activeMethod}
                </span>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {activeTab === 'summary' && (
                <SummaryPanel summary={activeScenario.summary} />
              )}
              {activeTab === 'disposals' && (
                <DisposalTable disposals={activeScenario.summary.disposals} />
              )}
              {activeTab === 'transactions' && (
                <TransactionsTable transactions={allTransactions} />
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasData && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: '#fff', borderRadius: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
            <Calculator size={56} color="#d0d0d0" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ color: '#888', fontWeight: 600, margin: '0 0 8px' }}>
              Upload your transaction history to get started
            </h2>
            <p style={{ color: '#aaa', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
              Upload CSV files from Coinbase and/or Kraken above. The engine will
              match buy/sell legs across both exchanges and calculate your tax position
              under four different accounting methods.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}

function TransactionsTable({ transactions }: { transactions: RawTransaction[] }) {
  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  return (
    <div>
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e8e8e8' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              {['Date', 'Exchange', 'Type', 'Asset', 'Quantity', 'Price (USD)', 'Total (USD)', 'Fee (USD)'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((tx, i) => (
              <tr key={tx.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '9px 12px', fontSize: 13 }}>{tx.date.toLocaleDateString('en-US')}</td>
                <td style={{ padding: '9px 12px', fontSize: 12, color: tx.exchange === 'coinbase' ? '#0052FF' : '#5741D9', fontWeight: 600, textTransform: 'uppercase' }}>{tx.exchange}</td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: tx.type === 'buy' ? '#e8f5e9' : tx.type === 'sell' ? '#ffebee' : '#f3e5f5',
                    color: tx.type === 'buy' ? '#2e7d32' : tx.type === 'sell' ? '#c62828' : '#6a1b9a',
                  }}>
                    {tx.type.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: 13 }}>{tx.asset}</td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                  {tx.quantity.toFixed(8).replace(/\.?0+$/, '')}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 13 }}>
                  {tx.priceUSD > 0 ? '$' + tx.priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 13 }}>
                  {tx.totalUSD > 0 ? '$' + tx.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </td>
                <td style={{ padding: '9px 12px', fontSize: 13, color: '#e85d04' }}>
                  {tx.feeUSD > 0 ? '$' + tx.feeUSD.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #ddd', cursor: page === 0 ? 'not-allowed' : 'pointer' }}>Prev</button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: '#555' }}>Page {page + 1} of {totalPages}</span>
          <button disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #ddd', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer' }}>Next</button>
        </div>
      )}
    </div>
  );
}
