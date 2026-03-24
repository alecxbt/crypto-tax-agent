import type { TaxSummary } from '../types';
import { AlertTriangle } from 'lucide-react';

interface Props {
  summary: TaxSummary;
}

function fmtUSD(n: number, showSign = false) {
  const sign = showSign ? (n < 0 ? '-' : n > 0 ? '+' : '') : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatBox({
  label, value, sub, color, bg
}: { label: string; value: string; sub?: string; color: string; bg: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: '16px 20px',
      flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function SummaryPanel({ summary: s }: Props) {
  return (
    <div>
      {/* Big net total */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: 16, padding: '28px 28px',
        marginBottom: 20, color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#aab', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
            Net Tax Position
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: s.netTotal < 0 ? '#52b788' : '#ff6b6b' }}>
            {fmtUSD(s.netTotal, true)}
          </div>
          <div style={{ fontSize: 13, color: '#99a', marginTop: 6 }}>
            {s.disposals.length} taxable events &nbsp;|&nbsp;
            Proceeds: {fmtUSD(s.totalProceeds)} &nbsp;|&nbsp;
            Basis: {fmtUSD(s.totalCostBasis)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {s.netTotal < 0 && (
            <div style={{
              background: '#52b78820', border: '1px solid #52b788',
              borderRadius: 10, padding: '10px 16px',
            }}>
              <div style={{ fontSize: 12, color: '#52b788', fontWeight: 600 }}>Tax Loss Harvesting</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#52b788' }}>{fmtUSD(s.netTotal)}</div>
              <div style={{ fontSize: 11, color: '#888' }}>potential deduction</div>
            </div>
          )}
          {s.netTotal > 0 && (
            <div style={{
              background: '#ff6b6b20', border: '1px solid #ff6b6b',
              borderRadius: 10, padding: '10px 16px',
            }}>
              <div style={{ fontSize: 12, color: '#ff6b6b', fontWeight: 600 }}>Taxable Gain</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ff6b6b' }}>{fmtUSD(s.netTotal)}</div>
              <div style={{ fontSize: 11, color: '#888' }}>owed on gain</div>
            </div>
          )}
        </div>
      </div>

      {/* Short vs Long term breakdown */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatBox
          label="Short-Term Gain" value={fmtUSD(s.shortTermGain)}
          bg="#fff8f0" color="#e85d04"
          sub="Taxed as ordinary income"
        />
        <StatBox
          label="Short-Term Loss" value={fmtUSD(s.shortTermLoss)}
          bg="#fff8f0" color="#2d6a4f"
          sub="Offsets short-term gains first"
        />
        <StatBox
          label="Net Short-Term" value={fmtUSD(s.netShortTerm, true)}
          bg={s.netShortTerm < 0 ? '#f0faf3' : '#fff3f3'}
          color={s.netShortTerm < 0 ? '#2d6a4f' : '#e63946'}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatBox
          label="Long-Term Gain" value={fmtUSD(s.longTermGain)}
          bg="#f0f8ff" color="#2196f3"
          sub="0%, 15%, or 20% rate"
        />
        <StatBox
          label="Long-Term Loss" value={fmtUSD(s.longTermLoss)}
          bg="#f0f8ff" color="#2d6a4f"
          sub="Offsets long-term gains first"
        />
        <StatBox
          label="Net Long-Term" value={fmtUSD(s.netLongTerm, true)}
          bg={s.netLongTerm < 0 ? '#f0faf3' : '#e8f4f8'}
          color={s.netLongTerm < 0 ? '#2d6a4f' : '#0077b6'}
        />
      </div>

      {/* Unmatched sells warning */}
      {s.unmatchedSells.length > 0 && (
        <div style={{
          background: '#fffbee', border: '1px solid #ffc107',
          borderRadius: 12, padding: '14px 18px',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <AlertTriangle size={20} color="#e6a817" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#956200' }}>
              {s.unmatchedSells.length} Unmatched Sell(s) Detected
            </div>
            <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>
              These disposals couldn't be matched to a purchase lot. This may indicate missing transaction history
              from one exchange. The cost basis for these is assumed to be $0. Upload complete history from both
              exchanges to resolve.
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>
              Assets: {[...new Set(s.unmatchedSells.map(t => t.asset))].join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Unused lots note */}
      {s.unusedLots.length > 0 && (
        <div style={{
          background: '#f8f9ff', border: '1px solid #c5cae9',
          borderRadius: 12, padding: '12px 16px', marginTop: 12, fontSize: 13, color: '#555',
        }}>
          <strong>{s.unusedLots.length}</strong> tax lots with remaining balance
          (${s.unusedLots.reduce((sum, l) => sum + l.remainingQty * l.costBasisPerUnit, 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} unrealized basis).
          These will carry forward to future tax years.
        </div>
      )}
    </div>
  );
}
